import { Atom } from "@effect-atom/atom-react";
import { Effect, Fiber, pipe } from "effect";
import type { SqlError } from "@effect/sql/SqlError";
import { appRuntime } from "./runtime.js";
import {
	wizardStepAtom,
	descriptionAtom,
	specContentAtom,
	sessionIdAtom,
	feedbackAtom,
	openQuestionsAtom,
	questionAnswersAtom,
	currentQuestionIndexAtom,
	customInputModeAtom,
	type WizardStep,
} from "./epicCreation.js";
import {
	EpicDraftRepository,
	EpicDraftState,
} from "../services/EpicDraftRepository.js";
import type { OpenQuestion, QuestionAnswer } from "../utils/openQuestions.js";
// Import type directly to avoid circular dependency
import type { AgentSessionId } from "../services/AgentEvent.js";

// ─────────────────────────────────────────────────────────────
// Draft Check State Atom
// ─────────────────────────────────────────────────────────────

/**
 * Draft check state:
 * - "pending": Not yet checked
 * - "checking": Currently checking
 * - "exists": Draft exists
 * - "empty": No draft exists
 */
export type DraftCheckState = "pending" | "checking" | "exists" | "empty";

export const draftCheckStateAtom = pipe(
	Atom.make<DraftCheckState>("pending"),
	Atom.keepAlive,
);

// ─────────────────────────────────────────────────────────────
// Draft State Collection/Restoration
// ─────────────────────────────────────────────────────────────

// FnContext type from effect-atom - use loose typing to avoid complex generic constraints
// biome-ignore lint/suspicious/noExplicitAny: FnContext has complex generics
type FnContext = any;

/**
 * Collect current draft state from all atoms into a serializable format.
 */
const collectDraftState = (ctx: FnContext): EpicDraftState => {
	const answersMap = ctx(questionAnswersAtom) as Map<string, QuestionAnswer>;

	// Convert Map to plain object for JSON serialization
	const answersObj: Record<string, unknown> = {};
	for (const [key, value] of answersMap) {
		answersObj[key] = value;
	}

	return new EpicDraftState({
		wizardStep: ctx(wizardStepAtom) as WizardStep,
		description: ctx(descriptionAtom) as string,
		specContent: ctx(specContentAtom) as string,
		sessionId: ctx(sessionIdAtom) as string | null,
		feedback: ctx(feedbackAtom) as string,
		openQuestions: ctx(openQuestionsAtom) as OpenQuestion[],
		questionAnswers: answersObj,
		currentQuestionIndex: ctx(currentQuestionIndexAtom) as number,
		customInputMode: ctx(customInputModeAtom) as boolean,
	});
};

/**
 * Restore draft state from saved state to all atoms.
 */
const restoreDraftState = (ctx: FnContext, state: EpicDraftState): void => {
	ctx.set(wizardStepAtom, state.wizardStep as WizardStep);
	ctx.set(descriptionAtom, state.description);
	ctx.set(specContentAtom, state.specContent);
	ctx.set(sessionIdAtom, state.sessionId as AgentSessionId | null);
	ctx.set(feedbackAtom, state.feedback);
	ctx.set(openQuestionsAtom, state.openQuestions as OpenQuestion[]);

	// Convert object back to Map
	const answersMap = new Map<string, QuestionAnswer>();
	for (const [key, value] of Object.entries(state.questionAnswers)) {
		answersMap.set(key, value as QuestionAnswer);
	}
	ctx.set(questionAnswersAtom, answersMap);
	ctx.set(currentQuestionIndexAtom, state.currentQuestionIndex);
	ctx.set(customInputModeAtom, state.customInputMode);
};

// ─────────────────────────────────────────────────────────────
// Debounced Save
// ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;

// Track pending save fiber for cancellation
let pendingSaveFiber: Fiber.RuntimeFiber<void, SqlError> | null = null;

/**
 * Save draft with debounce - cancels any pending save.
 * Does NOT save during transient states (generating, patching, saving).
 */
export const saveDraftDebounced = appRuntime.fn<SqlError, void, void>(
	(_, ctx) =>
		Effect.gen(function* () {
			// Check if we're in a transient state that shouldn't be saved
			const step = ctx(wizardStepAtom) as WizardStep;
			if (
				step.type === "generating" ||
				step.type === "patching" ||
				step.type === "saving" ||
				step.type === "success"
			) {
				return;
			}

			// Cancel any pending save
			if (pendingSaveFiber) {
				yield* Fiber.interrupt(pendingSaveFiber);
				pendingSaveFiber = null;
			}

			// Create debounced save effect
			const saveEffect = Effect.gen(function* () {
				yield* Effect.sleep(DEBOUNCE_MS);
				const repo = yield* EpicDraftRepository;
				const state = collectDraftState(ctx);
				yield* repo.save(state);
			});

			// Fork and track the fiber (scoped to avoid leaking)
			pendingSaveFiber = yield* Effect.fork(saveEffect);
		}),
);

/**
 * Save draft immediately (no debounce) - for use when exiting the screen.
 * Also resets draftCheckStateAtom to "pending" so it rechecks next time.
 */
export const saveDraftImmediateFn = appRuntime.fn<SqlError, void, void>(
	(_, ctx) =>
		Effect.gen(function* () {
			// Cancel any pending debounced save
			if (pendingSaveFiber) {
				yield* Fiber.interrupt(pendingSaveFiber);
				pendingSaveFiber = null;
			}

			// Check if we're in a transient state that shouldn't be saved
			const step = ctx(wizardStepAtom) as WizardStep;
			if (
				step.type === "generating" ||
				step.type === "patching" ||
				step.type === "saving" ||
				step.type === "success"
			) {
				// Reset check state for next entry
				ctx.set(draftCheckStateAtom, "pending");
				return;
			}

			// Save immediately
			const repo = yield* EpicDraftRepository;
			const state = collectDraftState(ctx);
			yield* repo.save(state);

			// Reset check state so it rechecks next time screen is entered
			ctx.set(draftCheckStateAtom, "pending");
		}),
);

// ─────────────────────────────────────────────────────────────
// Load/Clear/Check Draft Effects
// ─────────────────────────────────────────────────────────────

/**
 * Load draft and restore to atoms if it exists.
 * Also sets draftCheckStateAtom to "empty" after loading.
 */
export const loadDraftFn = appRuntime.fn<SqlError, void, void>((_, ctx) =>
	Effect.gen(function* () {
		const repo = yield* EpicDraftRepository;
		const state = yield* repo.load();

		if (state) {
			restoreDraftState(ctx, state);
		}
		// Mark draft check as resolved
		ctx.set(draftCheckStateAtom, "empty");
	}),
);

/**
 * Check if a draft exists and update draftCheckStateAtom.
 */
export const checkDraftExistsFn = appRuntime.fn<SqlError, void, void>(
	(_, ctx) =>
		Effect.gen(function* () {
			ctx.set(draftCheckStateAtom, "checking");
			const repo = yield* EpicDraftRepository;
			const exists = yield* repo.exists();
			ctx.set(draftCheckStateAtom, exists ? "exists" : "empty");
		}),
);

/**
 * Clear draft from database.
 */
export const clearDraftFn = appRuntime.fn<SqlError, void, void>((_, _ctx) =>
	Effect.gen(function* () {
		const repo = yield* EpicDraftRepository;
		yield* repo.clear();
	}),
);

/**
 * Clear draft and reset wizard state to initial values.
 * Also sets draftCheckStateAtom to "empty".
 */
export const clearDraftAndResetFn = appRuntime.fn<SqlError, void, void>(
	(_, ctx) =>
		Effect.gen(function* () {
			const repo = yield* EpicDraftRepository;
			yield* repo.clear();
			// Reset wizard state inline (same logic as resetWizard function)
			ctx.set(wizardStepAtom, { type: "description" });
			ctx.set(descriptionAtom, "");
			ctx.set(specContentAtom, "");
			ctx.set(sessionIdAtom, null);
			ctx.set(feedbackAtom, "");
			ctx.set(openQuestionsAtom, []);
			ctx.set(questionAnswersAtom, new Map());
			ctx.set(currentQuestionIndexAtom, 0);
			ctx.set(customInputModeAtom, false);
			ctx.set(draftCheckStateAtom, "empty");
		}),
);
