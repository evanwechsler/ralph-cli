import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
	AgentSessionRepository,
	CreateAgentSessionInput,
	UpdateAgentSessionInput,
} from "./AgentSessionRepository.js";
import { TestServicesLayer } from "./index.js";
import type { AgentSessionId } from "./AgentEvent.js";

// Helper to run Effect tests with bun's test runner
// Note: @effect/vitest doesn't work with bun test, and vitest doesn't work with bun:sqlite
const runEffect = <A, E>(effect: Effect.Effect<A, E, AgentSessionRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(TestServicesLayer)));

describe("AgentSessionRepository", () => {
	describe("create", () => {
		it("should create a new agent session", async () => {
			const result = await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					const input = new CreateAgentSessionInput({
						id: "test-session-1",
						claudeSessionId: "claude-abc123",
						status: "running",
					});

					const id = yield* repo.create(input);
					expect(id).toBe("test-session-1");

					const session = yield* repo.findById(id);
					expect(session).not.toBeNull();
					expect(session?.claudeSessionId).toBe("claude-abc123");
					expect(session?.status).toBe("running");

					return id;
				}),
			);

			expect(result).toBe("test-session-1");
		});

		it("should create a session with optional fields", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					const input = new CreateAgentSessionInput({
						id: "test-session-2",
						claudeSessionId: "claude-def456",
						status: "paused",
						epicId: 1,
						currentTaskId: 5,
						lastMessageUuid: "msg-uuid-123",
					});

					const id = yield* repo.create(input);
					const session = yield* repo.findById(id);

					expect(session?.epicId).toBe(1);
					expect(session?.currentTaskId).toBe(5);
					expect(session?.lastMessageUuid).toBe("msg-uuid-123");
				}),
			);
		});
	});

	describe("findById", () => {
		it("should return null for non-existent session", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;
					const session = yield* repo.findById(
						"non-existent" as AgentSessionId,
					);
					expect(session).toBeNull();
				}),
			);
		});

		it("should find session by id", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "test-session-find",
							claudeSessionId: "claude-xyz",
							status: "running",
						}),
					);

					const session = yield* repo.findById(
						"test-session-find" as AgentSessionId,
					);
					expect(session).not.toBeNull();
					expect(session?.id).toBe("test-session-find");
				}),
			);
		});
	});

	describe("findByStatus", () => {
		it("should find sessions by status", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "running-1",
							claudeSessionId: "claude-1",
							status: "running",
						}),
					);

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "paused-1",
							claudeSessionId: "claude-2",
							status: "paused",
						}),
					);

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "running-2",
							claudeSessionId: "claude-3",
							status: "running",
						}),
					);

					const runningSessions = yield* repo.findByStatus("running");
					expect(runningSessions.length).toBe(2);
					expect(runningSessions.every((s) => s.status === "running")).toBe(
						true,
					);

					const pausedSessions = yield* repo.findByStatus("paused");
					expect(pausedSessions.length).toBe(1);
					expect(pausedSessions[0]?.status).toBe("paused");
				}),
			);
		});
	});

	describe("updateStatus", () => {
		it("should update session status", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "status-update-test",
							claudeSessionId: "claude-status",
							status: "running",
						}),
					);

					yield* repo.updateStatus(
						"status-update-test" as AgentSessionId,
						"completed",
					);

					const session = yield* repo.findById(
						"status-update-test" as AgentSessionId,
					);
					expect(session?.status).toBe("completed");
				}),
			);
		});
	});

	describe("updateLastMessageUuid", () => {
		it("should update last message uuid", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "msg-uuid-test",
							claudeSessionId: "claude-msg",
							status: "running",
						}),
					);

					yield* repo.updateLastMessageUuid(
						"msg-uuid-test" as AgentSessionId,
						"new-msg-uuid-456",
					);

					const session = yield* repo.findById(
						"msg-uuid-test" as AgentSessionId,
					);
					expect(session?.lastMessageUuid).toBe("new-msg-uuid-456");
				}),
			);
		});
	});

	describe("update", () => {
		it("should update multiple fields at once", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "multi-update-test",
							claudeSessionId: "claude-multi",
							status: "running",
						}),
					);

					yield* repo.update(
						new UpdateAgentSessionInput({
							id: "multi-update-test",
							status: "paused",
							lastMessageUuid: "updated-uuid",
							currentTaskId: 10,
						}),
					);

					const session = yield* repo.findById(
						"multi-update-test" as AgentSessionId,
					);
					expect(session?.status).toBe("paused");
					expect(session?.lastMessageUuid).toBe("updated-uuid");
					expect(session?.currentTaskId).toBe(10);
				}),
			);
		});
	});

	describe("softDelete and restore", () => {
		it("should soft delete and restore sessions", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "soft-delete-test",
							claudeSessionId: "claude-delete",
							status: "completed",
						}),
					);

					// Soft delete
					yield* repo.softDelete("soft-delete-test" as AgentSessionId);

					// Should not appear in findAll (without includeDeleted)
					const allSessions = yield* repo.findAll();
					expect(allSessions.find((s) => s.id === "soft-delete-test")).toBe(
						undefined,
					);

					// Should appear with includeDeleted
					const allWithDeleted = yield* repo.findAll({ includeDeleted: true });
					expect(
						allWithDeleted.find((s) => s.id === "soft-delete-test"),
					).not.toBe(undefined);

					// Restore
					yield* repo.restore("soft-delete-test" as AgentSessionId);

					// Should appear again
					const afterRestore = yield* repo.findAll();
					expect(
						afterRestore.find((s) => s.id === "soft-delete-test"),
					).not.toBe(undefined);
				}),
			);
		});
	});

	describe("hardDelete", () => {
		it("should permanently delete session", async () => {
			await runEffect(
				Effect.gen(function* () {
					const repo = yield* AgentSessionRepository;

					yield* repo.create(
						new CreateAgentSessionInput({
							id: "hard-delete-test",
							claudeSessionId: "claude-hard",
							status: "failed",
						}),
					);

					yield* repo.hardDelete("hard-delete-test" as AgentSessionId);

					const session = yield* repo.findById(
						"hard-delete-test" as AgentSessionId,
					);
					expect(session).toBeNull();

					// Even with includeDeleted, it should not exist
					const allWithDeleted = yield* repo.findAll({ includeDeleted: true });
					expect(allWithDeleted.find((s) => s.id === "hard-delete-test")).toBe(
						undefined,
					);
				}),
			);
		});
	});
});
