import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import type { SqlError } from "@effect/sql/SqlError";
import { eq, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";
import {
	agentSessions,
	type AgentSession,
	type AgentSessionStatus,
	type NewAgentSession,
} from "../db/schema.js";
import type { AgentSessionId } from "./AgentEvent.js";
import type { EpicId } from "./EpicRepository.js";
import type { TaskId } from "./TaskRepository.js";

// ─────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────

export class CreateAgentSessionInput extends Schema.Class<CreateAgentSessionInput>(
	"CreateAgentSessionInput",
)({
	id: Schema.String, // UUID generated externally
	epicId: Schema.optional(Schema.Int),
	claudeSessionId: Schema.String,
	status: Schema.Literal("running", "paused", "completed", "failed"),
	currentTaskId: Schema.optional(Schema.Int),
	lastMessageUuid: Schema.optional(Schema.String),
}) {}

export class UpdateAgentSessionInput extends Schema.Class<UpdateAgentSessionInput>(
	"UpdateAgentSessionInput",
)({
	id: Schema.String,
	epicId: Schema.optional(Schema.Int),
	claudeSessionId: Schema.optional(Schema.String),
	status: Schema.optional(
		Schema.Literal("running", "paused", "completed", "failed"),
	),
	currentTaskId: Schema.optional(Schema.Int),
	lastMessageUuid: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────────────────────

const makeAgentSessionRepository = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	const create = (
		input: CreateAgentSessionInput,
	): Effect.Effect<AgentSessionId, SqlError> =>
		Effect.gen(function* () {
			yield* db.insert(agentSessions).values({
				id: input.id,
				epicId: input.epicId,
				claudeSessionId: input.claudeSessionId,
				status: input.status,
				currentTaskId: input.currentTaskId,
				lastMessageUuid: input.lastMessageUuid,
			} satisfies NewAgentSession);

			return input.id as AgentSessionId;
		});

	const findById = (
		id: AgentSessionId,
	): Effect.Effect<AgentSession | null, SqlError> =>
		Effect.gen(function* () {
			const results = yield* db
				.select()
				.from(agentSessions)
				.where(eq(agentSessions.id, id));
			return results[0] ?? null;
		});

	const findByEpicId = (
		epicId: EpicId,
		options?: { includeDeleted?: boolean },
	): Effect.Effect<readonly AgentSession[], SqlError> =>
		Effect.gen(function* () {
			if (options?.includeDeleted) {
				return yield* db
					.select()
					.from(agentSessions)
					.where(eq(agentSessions.epicId, epicId))
					.orderBy(agentSessions.createdAt);
			}
			return yield* db
				.select()
				.from(agentSessions)
				.where(eq(agentSessions.epicId, epicId))
				.orderBy(agentSessions.createdAt);
		});

	const findByStatus = (
		status: AgentSessionStatus,
	): Effect.Effect<readonly AgentSession[], SqlError> =>
		Effect.gen(function* () {
			return yield* db
				.select()
				.from(agentSessions)
				.where(eq(agentSessions.status, status))
				.orderBy(agentSessions.createdAt);
		});

	const findAll = (options?: {
		includeDeleted?: boolean;
	}): Effect.Effect<readonly AgentSession[], SqlError> =>
		Effect.gen(function* () {
			if (options?.includeDeleted) {
				return yield* db
					.select()
					.from(agentSessions)
					.orderBy(agentSessions.createdAt);
			}
			return yield* db
				.select()
				.from(agentSessions)
				.where(isNull(agentSessions.deletedAt))
				.orderBy(agentSessions.createdAt);
		});

	const update = (
		input: UpdateAgentSessionInput,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			const updates: Partial<NewAgentSession> = {};
			if (input.epicId !== undefined) updates.epicId = input.epicId;
			if (input.claudeSessionId !== undefined)
				updates.claudeSessionId = input.claudeSessionId;
			if (input.status !== undefined) updates.status = input.status;
			if (input.currentTaskId !== undefined)
				updates.currentTaskId = input.currentTaskId;
			if (input.lastMessageUuid !== undefined)
				updates.lastMessageUuid = input.lastMessageUuid;

			if (Object.keys(updates).length > 0) {
				yield* db
					.update(agentSessions)
					.set(updates)
					.where(eq(agentSessions.id, input.id));
			}
		});

	const updateStatus = (
		id: AgentSessionId,
		status: AgentSessionStatus,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(agentSessions)
				.set({ status })
				.where(eq(agentSessions.id, id));
		});

	const updateCurrentTask = (
		id: AgentSessionId,
		taskId: TaskId | null,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(agentSessions)
				.set({ currentTaskId: taskId })
				.where(eq(agentSessions.id, id));
		});

	const updateLastMessageUuid = (
		id: AgentSessionId,
		lastMessageUuid: string,
	): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(agentSessions)
				.set({ lastMessageUuid })
				.where(eq(agentSessions.id, id));
		});

	const softDelete = (id: AgentSessionId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(agentSessions)
				.set({ deletedAt: new Date() })
				.where(eq(agentSessions.id, id));
		});

	const restore = (id: AgentSessionId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db
				.update(agentSessions)
				.set({ deletedAt: null })
				.where(eq(agentSessions.id, id));
		});

	const hardDelete = (id: AgentSessionId): Effect.Effect<void, SqlError> =>
		Effect.gen(function* () {
			yield* db.delete(agentSessions).where(eq(agentSessions.id, id));
		});

	return {
		create,
		findById,
		findByEpicId,
		findByStatus,
		findAll,
		update,
		updateStatus,
		updateCurrentTask,
		updateLastMessageUuid,
		softDelete,
		restore,
		hardDelete,
	};
});

export class AgentSessionRepository extends Effect.Service<AgentSessionRepository>()(
	"@ralph/AgentSessionRepository",
	{
		effect: makeAgentSessionRepository,
	},
) {}
