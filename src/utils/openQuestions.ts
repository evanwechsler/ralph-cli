import { Schema } from "effect";

// ─────────────────────────────────────────────────────────────
// Branded Types
// ─────────────────────────────────────────────────────────────

export const QuestionId = Schema.String.pipe(Schema.brand("QuestionId"));
export type QuestionId = typeof QuestionId.Type;

export const OptionId = Schema.String.pipe(Schema.brand("OptionId"));
export type OptionId = typeof OptionId.Type;

// ─────────────────────────────────────────────────────────────
// Schema Classes
// ─────────────────────────────────────────────────────────────

export class QuestionOption extends Schema.Class<QuestionOption>(
	"QuestionOption",
)({
	id: OptionId,
	label: Schema.String,
	description: Schema.String,
	recommended: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

export class OpenQuestion extends Schema.Class<OpenQuestion>("OpenQuestion")({
	id: QuestionId,
	text: Schema.String,
	context: Schema.String,
	options: Schema.Array(QuestionOption).pipe(Schema.minItems(2)),
}) {}

export class QuestionAnswer extends Schema.Class<QuestionAnswer>(
	"QuestionAnswer",
)({
	questionId: QuestionId,
	selectedOptionId: OptionId,
	customResponse: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────
// XML Parsing Functions
// ─────────────────────────────────────────────────────────────

/**
 * Quick check if spec content has any open questions
 */
export function hasOpenQuestions(specContent: string): boolean {
	return /<open_questions>[\s\S]*?<question[\s\S]*?<\/open_questions>/i.test(
		specContent,
	);
}

/**
 * Extract text content from an XML tag
 */
function extractTagContent(xml: string, tagName: string): string | null {
	const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
	const match = xml.match(regex);
	return match?.[1]?.trim() ?? null;
}

/**
 * Extract attribute value from an XML tag
 */
function extractAttribute(xml: string, attrName: string): string | null {
	const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
	const match = xml.match(regex);
	return match?.[1] ?? null;
}

/**
 * Parse a single option element
 */
function parseOption(optionXml: string): QuestionOption | null {
	const id = extractAttribute(optionXml, "id");
	const label = extractTagContent(optionXml, "label");
	const description = extractTagContent(optionXml, "description");
	const recommendedAttr = extractAttribute(optionXml, "recommended");

	if (!id || !label || !description) {
		return null;
	}

	return new QuestionOption({
		id: id as OptionId,
		label,
		description,
		recommended: recommendedAttr === "true",
	});
}

/**
 * Parse a single question element
 */
function parseQuestion(questionXml: string): OpenQuestion | null {
	const id = extractAttribute(questionXml, "id");
	const text = extractTagContent(questionXml, "text");
	const context = extractTagContent(questionXml, "context");
	const optionsSection = extractTagContent(questionXml, "options");

	if (!id || !text || !context || !optionsSection) {
		return null;
	}

	// Extract all option elements
	const optionRegex = /<option[\s\S]*?<\/option>/gi;
	const optionMatches = optionsSection.match(optionRegex) ?? [];

	const options: QuestionOption[] = [];
	for (const optionXml of optionMatches) {
		const option = parseOption(optionXml);
		if (option) {
			options.push(option);
		}
	}

	// Need at least 2 options (including custom)
	if (options.length < 2) {
		return null;
	}

	return new OpenQuestion({
		id: id as QuestionId,
		text,
		context,
		options,
	});
}

/**
 * Parse open questions from spec content
 * Returns empty array if no questions found or parsing fails
 */
export function parseOpenQuestions(specContent: string): OpenQuestion[] {
	// Extract the open_questions section
	const openQuestionsSection = extractTagContent(specContent, "open_questions");
	if (!openQuestionsSection) {
		return [];
	}

	// Extract all question elements
	const questionRegex = /<question[\s\S]*?<\/question>/gi;
	const questionMatches = openQuestionsSection.match(questionRegex) ?? [];

	const questions: OpenQuestion[] = [];
	for (const questionXml of questionMatches) {
		const question = parseQuestion(questionXml);
		if (question) {
			questions.push(question);
		}
	}

	return questions;
}

/**
 * Format answers for the patch prompt
 */
export function formatAnswersForPrompt(
	questions: OpenQuestion[],
	answers: Map<string, QuestionAnswer>,
): string {
	const lines: string[] = [];

	for (const question of questions) {
		const answer = answers.get(question.id);
		if (!answer) continue;

		const selectedOption = question.options.find(
			(opt) => opt.id === answer.selectedOptionId,
		);

		lines.push(`## ${question.text}`);
		if (answer.selectedOptionId === "custom" && answer.customResponse) {
			lines.push(`**User's answer:** ${answer.customResponse}`);
		} else if (selectedOption) {
			lines.push(`**Selected:** ${selectedOption.label}`);
			lines.push(`**Description:** ${selectedOption.description}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Spec Patching Types and Functions
// ─────────────────────────────────────────────────────────────

/**
 * A single find/replace patch
 */
export interface SpecPatchItem {
	find: string;
	replace: string;
}

/**
 * Collection of patches to apply to a spec
 */
export interface SpecPatch {
	patches: SpecPatchItem[];
}

/**
 * Apply search/replace patches to spec content
 */
export function applyPatches(spec: string, patch: SpecPatch): string {
	let result = spec;
	for (const item of patch.patches) {
		// Use replace to apply each patch (only first occurrence)
		result = result.replace(item.find, item.replace);
	}
	return result;
}

/**
 * Remove answered questions from the spec by their IDs.
 * If all questions are removed, removes the entire open_questions section.
 */
export function removeAnsweredQuestions(
	spec: string,
	answeredQuestionIds: string[],
): string {
	let result = spec;

	// Remove each answered question by ID
	for (const questionId of answeredQuestionIds) {
		// Match the entire question element with this ID
		// Using a regex that matches <question id="X">...</question>
		const questionRegex = new RegExp(
			`\\s*<question\\s+id=["']${escapeRegex(questionId)}["'][^>]*>[\\s\\S]*?<\\/question>`,
			"gi",
		);
		result = result.replace(questionRegex, "");
	}

	// Check if open_questions section is now empty (no more question tags)
	const openQuestionsContent = extractTagContent(result, "open_questions");
	if (openQuestionsContent !== null) {
		// Check if there are any remaining question elements
		const hasRemainingQuestions = /<question[\s\S]*?<\/question>/i.test(
			openQuestionsContent,
		);

		if (!hasRemainingQuestions) {
			// Remove the entire open_questions section (including any whitespace before it)
			result = result.replace(
				/\s*<open_questions>[\s\S]*?<\/open_questions>/gi,
				"",
			);
		}
	}

	return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse JSON patch response from AI, with fallback for malformed JSON
 */
export function parsePatchResponse(response: string): SpecPatch | null {
	// Try to extract JSON from the response (it might be wrapped in markdown code blocks)
	const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
	const jsonStr = jsonMatch?.[1]?.trim() ?? response.trim();

	try {
		const parsed = JSON.parse(jsonStr);
		if (parsed && Array.isArray(parsed.patches)) {
			return parsed as SpecPatch;
		}
		return null;
	} catch {
		return null;
	}
}
