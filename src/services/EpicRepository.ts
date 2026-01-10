import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import type { SqlError } from "@effect/sql/SqlError";
import { eq, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { epics, type Epic, type NewEpic } from "../db/schema.js";

// ─────────────────────────────────────────────────────────────
// Branded ID Type
// ─────────────────────────────────────────────────────────────

export const EpicId = Schema.Int.pipe(Schema.brand("EpicId"));
export type EpicId = typeof EpicId.Type;

// ─────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────

export class CreateEpicInput extends Schema.Class<CreateEpicInput>(
	"CreateEpicInput",
)({
	title: Schema.String.pipe(Schema.minLength(1)),
	description: Schema.String,
}) {}

export class UpdateEpicInput extends Schema.Class<UpdateEpicInput>(
	"UpdateEpicInput",
)({
	id: EpicId,
	title: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
	description: Schema.optional(Schema.String),
	progressLog: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────────────────────

const makeEpicRepository = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	const create = (input: CreateEpicInput): Effect.Effect<EpicId, SqlError> =>
		Effect.gen(function* () {
			const result = yield* db
				.insert(epics)
				.values({
					title: input.title,
					description: input.description,
					progressLog: "",
				} satisfies NewEpic)
				.returning({ id: epics.id });

			const insertedId = result[0]?.id;
			if (insertedId === undefined) {
				return yield* Effect.die("Failed to create epic");
			}
			return insertedId as EpicId;
		});

	const findById = (id: EpicId): Effect.Effect<Epic | null, SqlError> =>
		Effect.gen(function* () {
			const results = yield* db.select().from(epics).where(eq(epics.id, id));
			return results[0] ?? null;
		});

	const findAll = (options?: {
		includeDeleted?: boolean;
	}): Effect.Effect<readonly Epic[], SqlError> =>
		Effect.gen(function* () {
			if (options?.includeDeleted) {
				return yield* db.select().from(epics).orderBy(epics.createdAt);
			}
			return yield* db
				.select()
				.from(epics)
				.where(isNull(epics.deletedAt))
				.orderBy(epics.createdAt);
		});

	const update = (input: UpdateEpicInput): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			const updates: Partial<NewEpic> = {};
			if (input.title !== undefined) updates.title = input.title;
			if (input.description !== undefined)
				updates.description = input.description;
			if (input.progressLog !== undefined)
				updates.progressLog = input.progressLog;

			if (Object.keys(updates).length > 0) {
				yield* db.update(epics).set(updates).where(eq(epics.id, input.id));
			}
		});

	const updateProgress = (
		id: EpicId,
		log: string,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.update(epics).set({ progressLog: log }).where(eq(epics.id, id));
		});

	const softDelete = (id: EpicId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(epics)
				.set({ deletedAt: new Date() })
				.where(eq(epics.id, id));
		});

	const restore = (id: EpicId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.update(epics).set({ deletedAt: null }).where(eq(epics.id, id));
		});

	const hardDelete = (id: EpicId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.delete(epics).where(eq(epics.id, id));
		});

	return {
		create,
		findById,
		findAll,
		update,
		updateProgress,
		softDelete,
		restore,
		hardDelete,
	};
});

export class EpicRepository extends Effect.Service<EpicRepository>()(
	"@ralph/EpicRepository",
	{
		effect: makeEpicRepository,
	},
) {}
