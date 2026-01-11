import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import type { SqlError } from "@effect/sql/SqlError";
import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { epicDrafts, type NewEpicDraft } from "../db/schema.js";

// ─────────────────────────────────────────────────────────────
// Draft State Schema (for serialization/deserialization)
// ─────────────────────────────────────────────────────────────

/**
 * Represents the serializable state of the epic creation wizard.
 * Complex types (Map, Schema classes) are stored as plain JSON.
 */
export class EpicDraftState extends Schema.Class<EpicDraftState>(
	"EpicDraftState",
)({
	wizardStep: Schema.Unknown, // WizardStep type (JSON object)
	description: Schema.String,
	specContent: Schema.String,
	sessionId: Schema.NullOr(Schema.String),
	feedback: Schema.String,
	openQuestions: Schema.Array(Schema.Unknown), // OpenQuestion[] as plain objects
	questionAnswers: Schema.Record({ key: Schema.String, value: Schema.Unknown }), // Map as object
	currentQuestionIndex: Schema.Number,
	customInputMode: Schema.Boolean,
}) {}

// Fixed ID for single-draft constraint
const DRAFT_ID = 1;

// ─────────────────────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────────────────────

const makeEpicDraftRepository = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	/**
	 * Save or update the draft state.
	 * Uses upsert pattern: delete existing and insert new.
	 */
	const save = (state: EpicDraftState): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			// Serialize complex types to JSON strings
			const values: NewEpicDraft = {
				id: DRAFT_ID,
				wizardStep: JSON.stringify(state.wizardStep),
				description: state.description,
				specContent: state.specContent,
				sessionId: state.sessionId,
				feedback: state.feedback,
				openQuestions: JSON.stringify(state.openQuestions),
				questionAnswers: JSON.stringify(state.questionAnswers),
				currentQuestionIndex: state.currentQuestionIndex,
				customInputMode: state.customInputMode,
			};

			// Upsert: delete existing and insert new
			yield* db.delete(epicDrafts).where(eq(epicDrafts.id, DRAFT_ID));
			yield* db.insert(epicDrafts).values(values);
		});

	/**
	 * Load the draft state if it exists.
	 * Returns null if no draft is saved.
	 */
	const load = (): Effect.Effect<EpicDraftState | null, SqlError> =>
		Effect.gen(function* () {
			const results = yield* db
				.select()
				.from(epicDrafts)
				.where(eq(epicDrafts.id, DRAFT_ID));
			const row = results[0];
			if (!row) return null;

			// Deserialize JSON fields back to objects
			return new EpicDraftState({
				wizardStep: JSON.parse(row.wizardStep),
				description: row.description,
				specContent: row.specContent,
				sessionId: row.sessionId,
				feedback: row.feedback,
				openQuestions: JSON.parse(row.openQuestions),
				questionAnswers: JSON.parse(row.questionAnswers),
				currentQuestionIndex: row.currentQuestionIndex,
				customInputMode: row.customInputMode,
			});
		});

	/**
	 * Check if a draft exists without loading the full state.
	 */
	const exists = (): Effect.Effect<boolean, SqlError> =>
		Effect.gen(function* () {
			const results = yield* db
				.select({ id: epicDrafts.id })
				.from(epicDrafts)
				.where(eq(epicDrafts.id, DRAFT_ID));
			return results.length > 0;
		});

	/**
	 * Delete the draft.
	 */
	const clear = (): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.delete(epicDrafts).where(eq(epicDrafts.id, DRAFT_ID));
		});

	return { save, load, exists, clear };
});

export class EpicDraftRepository extends Effect.Service<EpicDraftRepository>()(
	"@ralph/EpicDraftRepository",
	{
		effect: makeEpicDraftRepository,
	},
) {}
