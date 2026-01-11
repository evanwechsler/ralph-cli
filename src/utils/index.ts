export { extractTitleFromSpec } from "./specParser.js";
export {
	QuestionId,
	OptionId,
	QuestionOption,
	OpenQuestion,
	QuestionAnswer,
	hasOpenQuestions,
	parseOpenQuestions,
	formatAnswersForPrompt,
	type SpecPatch,
	type SpecPatchItem,
	applyPatches,
	removeAnsweredQuestions,
	parsePatchResponse,
} from "./openQuestions.js";
