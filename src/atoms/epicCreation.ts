import { Atom } from "@effect-atom/atom-react";
import { Effect, Stream, pipe } from "effect";
import { appRuntime } from "./runtime.js";
import {
	AgentClient,
	type AgentClientError,
	type AgentSessionId,
	EpicRepository,
	CreateEpicInput,
	type EpicId,
	ExternalEditor,
	type ExternalEditorError,
} from "../services/index.js";
// Import directly to avoid circular dependency through services/index.js
import { EpicDraftRepository } from "../services/EpicDraftRepository.js";
import type { SqlError } from "@effect/sql/SqlError";
import { extractTitleFromSpec } from "../utils/specParser.js";
import {
	type OpenQuestion,
	type QuestionAnswer,
	parseOpenQuestions,
	formatAnswersForPrompt,
	applyPatches,
	removeAnsweredQuestions,
	parsePatchResponse,
} from "../utils/openQuestions.js";

// ─────────────────────────────────────────────────────────────
// Wizard Step Type
// ─────────────────────────────────────────────────────────────

export type WizardStep =
	| { type: "description" }
	| { type: "generating" }
	| { type: "questions" }
	| { type: "patching" }
	| { type: "review" }
	| { type: "feedback" }
	| { type: "saving" }
	| { type: "success"; epicId: EpicId }
	| { type: "error"; message: string };

// ─────────────────────────────────────────────────────────────
// Generation Status with Progress Details
// ─────────────────────────────────────────────────────────────

export type GenerationStatus =
	| { type: "idle" }
	| {
			type: "generating";
			tokenCount: number;
			currentActivity: string;
			lastUpdate: number;
	  }
	| { type: "complete"; result: string; tokenCount: number }
	| { type: "error"; message: string; details?: readonly string[] };

// ─────────────────────────────────────────────────────────────
// Core State Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Current wizard step - starts at description input
 */
export const wizardStepAtom = pipe(
	Atom.make<WizardStep>({ type: "description" }),
	Atom.keepAlive,
);

/**
 * User's description input text
 */
export const descriptionAtom = pipe(Atom.make<string>(""), Atom.keepAlive);

/**
 * Generated spec content - accumulates tokens
 */
export const specContentAtom = pipe(Atom.make<string>(""), Atom.keepAlive);

/**
 * Generation status indicator with progress details
 */
export const generationStatusAtom = pipe(
	Atom.make<GenerationStatus>({ type: "idle" }),
	Atom.keepAlive,
);

/**
 * Claude session ID for potential resume capability
 */
export const sessionIdAtom = pipe(
	Atom.make<AgentSessionId | null>(null),
	Atom.keepAlive,
);

/**
 * Feedback input text for iteration
 */
export const feedbackAtom = pipe(Atom.make<string>(""), Atom.keepAlive);

/**
 * Error message to display in review step
 */
export const errorMessageAtom = pipe(
	Atom.make<string | null>(null),
	Atom.keepAlive,
);

/**
 * Saved epic ID after successful save
 */
export const savedEpicIdAtom = pipe(
	Atom.make<EpicId | null>(null),
	Atom.keepAlive,
);

// ─────────────────────────────────────────────────────────────
// Open Questions State Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Parsed open questions from the spec
 */
export const openQuestionsAtom = pipe(
	Atom.make<OpenQuestion[]>([]),
	Atom.keepAlive,
);

/**
 * User's answers to open questions
 * Map from QuestionId to QuestionAnswer
 */
export const questionAnswersAtom = pipe(
	Atom.make<Map<string, QuestionAnswer>>(new Map()),
	Atom.keepAlive,
);

/**
 * Current question index (for step-by-step navigation)
 */
export const currentQuestionIndexAtom = pipe(
	Atom.make<number>(0),
	Atom.keepAlive,
);

/**
 * Whether custom input mode is active for current question
 */
export const customInputModeAtom = pipe(
	Atom.make<boolean>(false),
	Atom.keepAlive,
);

// ─────────────────────────────────────────────────────────────
// Prompt Templates
// ─────────────────────────────────────────────────────────────

const SPEC_SYSTEM_PROMPT = `You are a senior software architect. Your task is to transform unstructured requirements into a clear, comprehensive specification that an AI coding agent can follow to implement the solution.

IMPORTANT: Generate the specification directly without using any tools.
Do not read files, search the web, or execute commands.
Simply write the specification based on the user's description.

## Guidelines

1. **Adapt the structure**: Include only sections relevant to this specific project. A small feature might just need overview, requirements, and implementation steps.

2. **Be concrete**: Avoid vague language. "Handle errors gracefully" → "Display error message with retry option when API returns 4xx/5xx"

3. **Be complete but not excessive**: Include everything needed to implement without further questions, but don't pad with unnecessary detail.

4. **Think like the implementer**: What would a developer need to know? What decisions should be made upfront vs. left flexible?

5. **Highlight the non-obvious**: Don't waste space on obvious things. Focus on decisions, edge cases, and anything that could cause confusion.`;

const buildSpecPrompt = (description: string): string => `
## User's Input

${description}

---

## Your Task

Generate a specification using the XML structure below. Include **only the sections that apply** to this specific project - not every project needs every section.

\`\`\`xml
<specification>
  <name>[Clear, descriptive name]</name>

  <overview>
    [Concise description of what this is, why it's needed, and what success looks like.
    Include enough context that someone unfamiliar could understand the goal.]
  </overview>

  <!-- Include sections below ONLY if relevant to this specific project -->

  <context>
    [If this is part of a larger system: describe how it fits in, what it interacts with,
    relevant existing code/patterns to follow, constraints from the existing architecture]
  </context>

  <requirements>
    <functional>
      [What the system must DO - concrete, testable requirements]
      - [Requirement]
    </functional>

    <non_functional>
      [Quality attributes: performance, security, accessibility, etc. - only if relevant]
      - [Requirement]
    </non_functional>

    <constraints>
      [Technical constraints, compatibility requirements, things that limit solutions]
      - [Constraint]
    </constraints>

    <out_of_scope>
      [Explicitly what this does NOT include to prevent scope creep]
      - [Item]
    </out_of_scope>
  </requirements>

  <technology>
    [Only if technology choices need to be specified or explained]
    <stack>
      - [Technology]: [Why/how it's used]
    </stack>

    <dependencies>
      [External services, APIs, libraries required]
    </dependencies>
  </technology>

  <architecture>
    [Only for complex systems - describe high-level structure]
    <components>
      [Major components and their responsibilities]
    </components>

    <data_flow>
      [How data moves through the system]
    </data_flow>

    <integration_points>
      [External systems and how we connect to them]
    </integration_points>
  </architecture>

  <data_model>
    [Only if there's meaningful data to model]
    <entities>
      <[entity_name]>
        - [field]: [type] - [description]
      </[entity_name]>
    </entities>
  </data_model>

  <interfaces>
    [Define the interfaces this system exposes or consumes - include only relevant subsections]

    <api>
      [REST endpoints, GraphQL schema, RPC methods, etc.]
    </api>

    <cli>
      [Commands, flags, arguments, input/output formats]
    </cli>

    <ui>
      [Screens, components, user interactions]
    </ui>

    <events>
      [Events emitted or consumed, webhooks, pub/sub]
    </events>
  </interfaces>

  <user_flows>
    [Key user journeys or system workflows]
    <flow name="[name]">
      1. [Step]
      2. [Step]

      <error_cases>
        - [What could go wrong and how it's handled]
      </error_cases>
    </flow>
  </user_flows>

  <implementation>
    <approach>
      [High-level implementation strategy, key decisions, patterns to use]
    </approach>

    <phases>
      [Break into logical chunks of work]
      <phase number="1">
        <goal>[What this phase accomplishes]</goal>
        <tasks>
          - [Concrete task]
        </tasks>
      </phase>
    </phases>

    <files>
      [If helpful: key files to create or modify]
      - [path]: [purpose]
    </files>
  </implementation>

  <testing>
    [Testing strategy - only if non-obvious]
    <approach>[How to verify this works]</approach>
    <key_scenarios>
      - [Critical test case]
    </key_scenarios>
  </testing>

  <edge_cases>
    [Important edge cases and how to handle them]
    - [Edge case]: [Handling approach]
  </edge_cases>

  <open_questions>
    <!-- For each unresolved decision that needs user input, provide structured options -->
    <!-- Include this section ONLY if there are genuine open questions -->
    <question id="[unique-id]">
      <text>[Clear question about an unresolved decision]</text>
      <context>[Why this matters and what depends on this decision]</context>
      <options>
        <!-- Provide 2-4 concrete options, mark your recommended one -->
        <option id="a" recommended="true">
          <label>[Short option name]</label>
          <description>[Detailed explanation and trade-offs]</description>
        </option>
        <option id="b">
          <label>[Alternative option]</label>
          <description>[When this makes sense and trade-offs]</description>
        </option>
        <!-- Always include custom option as the last option -->
        <option id="custom">
          <label>Custom response</label>
          <description>Provide your own answer to this question.</description>
        </option>
      </options>
    </question>
  </open_questions>

  <success_criteria>
    [How we know this is complete and working]
    - [Criterion]
  </success_criteria>
</specification>
\`\`\`

Generate the specification now, including only the sections relevant to this project.
`;

const buildFeedbackPrompt = (
	originalDescription: string,
	previousSpec: string,
	feedback: string,
): string => `
## Original Request

${originalDescription}

## Previous Specification

${previousSpec}

## User Feedback

${feedback}

---

Please regenerate the specification incorporating the feedback above.
Use the same XML structure as before. Focus on addressing the user's specific feedback while maintaining the quality and completeness of the specification.
`;

// ─────────────────────────────────────────────────────────────
// Spec Generation Function Atom
// ─────────────────────────────────────────────────────────────

/**
 * Function atom that runs spec generation with streaming.
 *
 * Uses appRuntime.fn to:
 * 1. Accept description as input argument
 * 2. Run Effect stream consuming AgentClient
 * 3. Accumulate tokens into specContentAtom
 * 4. Update status based on events with progress tracking
 * 5. Return final spec content
 */
export const generateSpecFn = appRuntime.fn<AgentClientError, string, string>(
	(description, ctx) =>
		Effect.gen(function* () {
			const client = yield* AgentClient;

			// Reset state for new generation
			ctx.set(specContentAtom, "");
			ctx.set(generationStatusAtom, {
				type: "generating",
				tokenCount: 0,
				currentActivity: "Starting...",
				lastUpdate: Date.now(),
			});
			ctx.set(wizardStepAtom, { type: "generating" });

			const prompt = buildSpecPrompt(description);

			// Track token count across stream
			let tokenCount = 0;

			const stream = client.runQuery(prompt, {
				cwd: process.cwd(),
				systemPromptAppend: SPEC_SYSTEM_PROMPT,
				// Remove maxTurns limit - let it complete naturally
				// For spec generation, we expect just 1 turn but don't want to error if more
				maxTurns: 10,
			});

			// Process stream events, updating atoms as side effects
			yield* stream.pipe(
				Stream.tap((event) =>
					Effect.sync(() => {
						switch (event.type) {
							case "token": {
								tokenCount++;
								const current = ctx(specContentAtom);
								ctx.set(specContentAtom, current + event.content);
								// Update status with progress
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: "Generating specification...",
									lastUpdate: Date.now(),
								});
								break;
							}
							case "session_init":
								ctx.set(sessionIdAtom, event.sessionId as AgentSessionId);
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: "Session initialized",
									lastUpdate: Date.now(),
								});
								break;
							case "tool_start":
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: `Using tool: ${event.tool}`,
									lastUpdate: Date.now(),
								});
								break;
							case "tool_end":
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: `Tool completed: ${event.tool}`,
									lastUpdate: Date.now(),
								});
								break;
							case "turn_complete":
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: "Processing turn...",
									lastUpdate: Date.now(),
								});
								break;
							case "result":
								if (event.success) {
									ctx.set(generationStatusAtom, {
										type: "complete",
										result: event.result,
										tokenCount,
									});

									// Check for open questions in the generated spec
									const specContent = ctx(specContentAtom);
									const questions = parseOpenQuestions(specContent);

									if (questions.length > 0) {
										// Found questions - transition to questions step
										ctx.set(openQuestionsAtom, questions);
										ctx.set(currentQuestionIndexAtom, 0);
										ctx.set(questionAnswersAtom, new Map());
										ctx.set(customInputModeAtom, false);
										ctx.set(wizardStepAtom, { type: "questions" });
									} else {
										// No questions - go directly to review
										ctx.set(wizardStepAtom, { type: "review" });
									}
								} else {
									ctx.set(generationStatusAtom, {
										type: "error",
										message: "Generation failed",
										details: [event.result],
									});
								}
								break;
							case "error": {
								const errorStatus: GenerationStatus = {
									type: "error",
									message: event.message,
								};
								if (event.errors) {
									(errorStatus as { details: readonly string[] }).details =
										event.errors;
								}
								ctx.set(generationStatusAtom, errorStatus);
								break;
							}
						}
					}),
				),
				Stream.runDrain,
			);

			// Return final spec content
			return ctx(specContentAtom);
		}),
);

// ─────────────────────────────────────────────────────────────
// Save Epic Function Atom
// ─────────────────────────────────────────────────────────────

/**
 * Function atom that saves the epic to the database.
 * Extracts title from spec content and creates a new epic.
 */
export const saveEpicFn = appRuntime.fn<SqlError, EpicId, string>((_, ctx) =>
	Effect.gen(function* () {
		const repo = yield* EpicRepository;
		const draftRepo = yield* EpicDraftRepository;
		const specContent = ctx(specContentAtom);

		// Set saving state
		ctx.set(wizardStepAtom, { type: "saving" });

		// Extract title from spec
		const title = extractTitleFromSpec(specContent);

		// Create epic with spec as description
		const epicId = yield* repo.create(
			new CreateEpicInput({
				title,
				description: specContent,
			}),
		);

		// Clear draft after successful save
		yield* draftRepo.clear();

		// Update atoms
		ctx.set(savedEpicIdAtom, epicId);
		ctx.set(wizardStepAtom, { type: "success", epicId });

		return epicId;
	}).pipe(
		Effect.catchAll((error) =>
			Effect.sync(() => {
				ctx.set(
					errorMessageAtom,
					`Database error: ${error.message ?? "Unknown error"}`,
				);
				ctx.set(wizardStepAtom, { type: "review" });
				return null as unknown as EpicId;
			}),
		),
	),
);

// ─────────────────────────────────────────────────────────────
// Edit in External Editor Function Atom
// ─────────────────────────────────────────────────────────────

/**
 * Function atom that opens the spec in an external editor.
 * Updates specContentAtom with edited content on success.
 */
export const editInEditorFn = appRuntime.fn<
	ExternalEditorError,
	string,
	string
>((_, ctx) =>
	Effect.gen(function* () {
		const editor = yield* ExternalEditor;
		const currentSpec = ctx(specContentAtom);

		// Open editor - TUI will be suspended while editor is open
		const editedContent = yield* editor.openEditor(currentSpec);

		// Update spec content with edited version
		ctx.set(specContentAtom, editedContent);

		// Stay in review step
		ctx.set(wizardStepAtom, { type: "review" });

		return editedContent;
	}).pipe(
		Effect.catchAll((error) =>
			Effect.sync(() => {
				ctx.set(errorMessageAtom, `Editor error: ${error.message}`);
				// Stay in review step, spec unchanged
				return ctx(specContentAtom); // Return current spec
			}),
		),
	),
);

// ─────────────────────────────────────────────────────────────
// Regenerate with Feedback Function Atom
// ─────────────────────────────────────────────────────────────

/**
 * Function atom that regenerates the spec with user feedback.
 * Creates a new session with the original description, previous spec, and feedback.
 */
export const regenerateWithFeedbackFn = appRuntime.fn<
	AgentClientError,
	string,
	string
>((_, ctx) =>
	Effect.gen(function* () {
		const client = yield* AgentClient;

		const originalDescription = ctx(descriptionAtom);
		const previousSpec = ctx(specContentAtom);
		const feedback = ctx(feedbackAtom);

		// Reset generation state
		ctx.set(specContentAtom, "");
		ctx.set(generationStatusAtom, {
			type: "generating",
			tokenCount: 0,
			currentActivity: "Incorporating feedback...",
			lastUpdate: Date.now(),
		});
		ctx.set(wizardStepAtom, { type: "generating" });
		ctx.set(feedbackAtom, ""); // Clear feedback after capturing

		const prompt = buildFeedbackPrompt(
			originalDescription,
			previousSpec,
			feedback,
		);

		let tokenCount = 0;

		const stream = client.runQuery(prompt, {
			cwd: process.cwd(),
			systemPromptAppend: SPEC_SYSTEM_PROMPT,
			maxTurns: 10,
		});

		// Process stream events (same pattern as generateSpecFn)
		yield* stream.pipe(
			Stream.tap((event) =>
				Effect.sync(() => {
					switch (event.type) {
						case "token": {
							tokenCount++;
							const current = ctx(specContentAtom);
							ctx.set(specContentAtom, current + event.content);
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: "Regenerating specification...",
								lastUpdate: Date.now(),
							});
							break;
						}
						case "session_init":
							ctx.set(sessionIdAtom, event.sessionId as AgentSessionId);
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: "Session initialized",
								lastUpdate: Date.now(),
							});
							break;
						case "tool_start":
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: `Using tool: ${event.tool}`,
								lastUpdate: Date.now(),
							});
							break;
						case "tool_end":
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: `Tool completed: ${event.tool}`,
								lastUpdate: Date.now(),
							});
							break;
						case "turn_complete":
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: "Processing turn...",
								lastUpdate: Date.now(),
							});
							break;
						case "result":
							if (event.success) {
								ctx.set(generationStatusAtom, {
									type: "complete",
									result: event.result,
									tokenCount,
								});
								ctx.set(wizardStepAtom, { type: "review" });
							} else {
								ctx.set(generationStatusAtom, {
									type: "error",
									message: "Regeneration failed",
									details: [event.result],
								});
							}
							break;
						case "error": {
							const errorStatus: GenerationStatus = {
								type: "error",
								message: event.message,
							};
							if (event.errors) {
								(errorStatus as { details: readonly string[] }).details =
									event.errors;
							}
							ctx.set(generationStatusAtom, errorStatus);
							break;
						}
					}
				}),
			),
			Stream.runDrain,
		);

		return ctx(specContentAtom);
	}),
);

// ─────────────────────────────────────────────────────────────
// Patch Spec with Answers Function Atom
// ─────────────────────────────────────────────────────────────

const PATCH_SYSTEM_PROMPT = `You are generating search/replace patches for a specification based on user decisions.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON - no explanations, no markdown outside the JSON
2. The JSON must have a "patches" array with find/replace objects
3. Each patch must have exact "find" text that exists in the spec and "replace" text
4. Keep patches minimal - only change what's necessary for the user's decisions
5. Do NOT include patches for removing questions - that's handled automatically`;

const buildPatchPrompt = (
	specContent: string,
	questions: OpenQuestion[],
	answers: Map<string, QuestionAnswer>,
): string => `
## Current Specification

${specContent}

## User Decisions for Open Questions

${formatAnswersForPrompt(questions, answers)}

---

## Your Task

Generate JSON patches to update the specification based on the user's decisions.

Output format (JSON only, no explanation):
\`\`\`json
{
  "patches": [
    {
      "find": "exact text to find in the spec",
      "replace": "replacement text"
    }
  ]
}
\`\`\`

Rules:
- Each "find" must be an EXACT substring from the current specification
- Only include patches for sections that need to change based on the answers
- Keep patches focused and minimal
- If no changes are needed to the spec content, return {"patches": []}
- Do NOT include patches for the <open_questions> section - that's handled automatically

Output the JSON now:
`;

/**
 * Function atom that patches the spec with user's answers to open questions.
 * Uses JSON patches for efficiency - only generates the diffs, not the full spec.
 */
export const patchSpecWithAnswersFn = appRuntime.fn<
	AgentClientError,
	string,
	string
>((_, ctx) =>
	Effect.gen(function* () {
		const client = yield* AgentClient;

		const specContent = ctx(specContentAtom);
		const questions = ctx(openQuestionsAtom);
		const answersMap = ctx(questionAnswersAtom);

		// Set patching state
		ctx.set(generationStatusAtom, {
			type: "generating",
			tokenCount: 0,
			currentActivity: "Generating patches...",
			lastUpdate: Date.now(),
		});
		ctx.set(wizardStepAtom, { type: "patching" });

		const prompt = buildPatchPrompt(specContent, questions, answersMap);

		let tokenCount = 0;
		let patchResponse = "";

		const stream = client.runQuery(prompt, {
			cwd: process.cwd(),
			systemPromptAppend: PATCH_SYSTEM_PROMPT,
			maxTurns: 3, // Patching should be very quick
		});

		// Collect the response (should be small JSON)
		yield* stream.pipe(
			Stream.tap((event) =>
				Effect.sync(() => {
					switch (event.type) {
						case "token": {
							tokenCount++;
							patchResponse += event.content;
							ctx.set(generationStatusAtom, {
								type: "generating",
								tokenCount,
								currentActivity: "Generating patches...",
								lastUpdate: Date.now(),
							});
							break;
						}
						case "session_init":
							ctx.set(sessionIdAtom, event.sessionId as AgentSessionId);
							break;
						case "result":
							if (event.success) {
								// Parse and apply patches
								ctx.set(generationStatusAtom, {
									type: "generating",
									tokenCount,
									currentActivity: "Applying patches...",
									lastUpdate: Date.now(),
								});

								let updatedSpec = specContent;

								// Parse the JSON patch response
								const patches = parsePatchResponse(patchResponse);
								if (patches && patches.patches.length > 0) {
									updatedSpec = applyPatches(updatedSpec, patches);
								}

								// Remove answered questions programmatically
								const answeredIds = Array.from(answersMap.keys());
								updatedSpec = removeAnsweredQuestions(updatedSpec, answeredIds);

								// Update spec content
								ctx.set(specContentAtom, updatedSpec);
								ctx.set(generationStatusAtom, {
									type: "complete",
									result: "Patches applied",
									tokenCount,
								});

								// Clear questions state and go to review
								ctx.set(openQuestionsAtom, []);
								ctx.set(questionAnswersAtom, new Map());
								ctx.set(wizardStepAtom, { type: "review" });
							} else {
								ctx.set(generationStatusAtom, {
									type: "error",
									message: "Patching failed",
									details: [event.result],
								});
							}
							break;
						case "error": {
							const errorStatus: GenerationStatus = {
								type: "error",
								message: event.message,
							};
							if (event.errors) {
								(errorStatus as { details: readonly string[] }).details =
									event.errors;
							}
							ctx.set(generationStatusAtom, errorStatus);
							// On error, go back to questions step so user can try again
							ctx.set(wizardStepAtom, { type: "questions" });
							break;
						}
					}
				}),
			),
			Stream.runDrain,
		);

		return ctx(specContentAtom);
	}),
);

// ─────────────────────────────────────────────────────────────
// Reset Function
// ─────────────────────────────────────────────────────────────

/**
 * Resets the wizard to initial state
 */
export const resetWizard = (ctx: {
	set: <_R, W>(atom: { write: unknown } & { read: unknown }, value: W) => void;
}) => {
	ctx.set(wizardStepAtom, { type: "description" });
	ctx.set(descriptionAtom, "");
	ctx.set(specContentAtom, "");
	ctx.set(generationStatusAtom, { type: "idle" });
	ctx.set(sessionIdAtom, null);
	ctx.set(feedbackAtom, "");
	ctx.set(errorMessageAtom, null);
	ctx.set(savedEpicIdAtom, null);
	// Clear open questions state
	ctx.set(openQuestionsAtom, []);
	ctx.set(questionAnswersAtom, new Map());
	ctx.set(currentQuestionIndexAtom, 0);
	ctx.set(customInputModeAtom, false);
};
