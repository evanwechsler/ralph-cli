import { Atom } from "@effect-atom/atom-react";
import { Effect, Stream, pipe } from "effect";
import { appRuntime } from "./runtime.js";
import {
	AgentClient,
	type AgentClientError,
	type AgentSessionId,
} from "../services/index.js";

// ─────────────────────────────────────────────────────────────
// Wizard Step Type
// ─────────────────────────────────────────────────────────────

export type WizardStep =
	| { type: "description" }
	| { type: "generating" }
	| { type: "review" };

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
    [Unresolved items that may need revisiting]
    - [Question]
  </open_questions>

  <success_criteria>
    [How we know this is complete and working]
    - [Criterion]
  </success_criteria>
</specification>
\`\`\`

Generate the specification now, including only the sections relevant to this project.
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
									ctx.set(wizardStepAtom, { type: "review" });
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
};
