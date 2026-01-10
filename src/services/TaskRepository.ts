import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import type { SqlError } from "@effect/sql/SqlError";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";
import {
	tasks,
	type NewTask,
	type Task,
	type TaskCategory,
} from "../db/schema.js";
import { EpicId } from "./EpicRepository.js";

// ─────────────────────────────────────────────────────────────
// Branded ID Type
// ─────────────────────────────────────────────────────────────

export const TaskId = Schema.Int.pipe(Schema.brand("TaskId"));
export type TaskId = typeof TaskId.Type;

// ─────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────

export class CreateTaskInput extends Schema.Class<CreateTaskInput>(
	"CreateTaskInput",
)({
	epicId: EpicId,
	category: Schema.Literal(
		"functional",
		"style",
		"integration",
		"infrastructure",
		"testing",
	),
	description: Schema.String.pipe(Schema.minLength(1)),
	steps: Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
		Schema.minItems(1),
	),
	passes: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	order: Schema.optionalWith(Schema.Int, { default: () => 0 }),
}) {}

export class UpdateTaskInput extends Schema.Class<UpdateTaskInput>(
	"UpdateTaskInput",
)({
	id: TaskId,
	category: Schema.optional(
		Schema.Literal(
			"functional",
			"style",
			"integration",
			"infrastructure",
			"testing",
		),
	),
	description: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
	steps: Schema.optional(
		Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
			Schema.minItems(1),
		),
	),
	passes: Schema.optional(Schema.Boolean),
	order: Schema.optional(Schema.Int),
}) {}

// ─────────────────────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────────────────────

const makeTaskRepository = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	const create = (input: CreateTaskInput): Effect.Effect<TaskId, SqlError> =>
		Effect.gen(function* () {
			const result = yield* db
				.insert(tasks)
				.values({
					epicId: input.epicId,
					category: input.category as TaskCategory,
					description: input.description,
					steps: [...input.steps], // Convert readonly to mutable
					passes: input.passes,
					order: input.order,
				} satisfies NewTask)
				.returning({ id: tasks.id });

			const insertedId = result[0]?.id;
			if (insertedId === undefined) {
				return yield* Effect.die("Failed to create task");
			}
			return insertedId as TaskId;
		});

	const findById = (id: TaskId): Effect.Effect<Task | null, SqlError> =>
		Effect.gen(function* () {
			const results = yield* db.select().from(tasks).where(eq(tasks.id, id));
			return results[0] ?? null;
		});

	const findByEpicId = (
		epicId: EpicId,
		options?: { includeDeleted?: boolean },
	): Effect.Effect<readonly Task[], SqlError> =>
		Effect.gen(function* () {
			if (options?.includeDeleted) {
				return yield* db
					.select()
					.from(tasks)
					.where(eq(tasks.epicId, epicId))
					.orderBy(asc(tasks.order));
			}
			return yield* db
				.select()
				.from(tasks)
				.where(and(eq(tasks.epicId, epicId), isNull(tasks.deletedAt)))
				.orderBy(asc(tasks.order));
		});

	const update = (input: UpdateTaskInput): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			const updates: Partial<NewTask> = {};
			if (input.category !== undefined)
				updates.category = input.category as TaskCategory;
			if (input.description !== undefined)
				updates.description = input.description;
			if (input.steps !== undefined) updates.steps = [...input.steps]; // Convert readonly to mutable
			if (input.passes !== undefined) updates.passes = input.passes;
			if (input.order !== undefined) updates.order = input.order;

			if (Object.keys(updates).length > 0) {
				yield* db.update(tasks).set(updates).where(eq(tasks.id, input.id));
			}
		});

	const markPassing = (
		id: TaskId,
		passes: boolean,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.update(tasks).set({ passes }).where(eq(tasks.id, id));
		});

	const softDelete = (id: TaskId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(tasks)
				.set({ deletedAt: new Date() })
				.where(eq(tasks.id, id));
		});

	const restore = (id: TaskId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, id));
		});

	const hardDelete = (id: TaskId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.delete(tasks).where(eq(tasks.id, id));
		});

	const hardDeleteByEpicId = (epicId: EpicId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.delete(tasks).where(eq(tasks.epicId, epicId));
		});

	return {
		create,
		findById,
		findByEpicId,
		update,
		markPassing,
		softDelete,
		restore,
		hardDelete,
		hardDeleteByEpicId,
	};
});

export class TaskRepository extends Effect.Service<TaskRepository>()(
	"@ralph/TaskRepository",
	{
		effect: makeTaskRepository,
	},
) {}
