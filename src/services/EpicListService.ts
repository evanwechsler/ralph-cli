import type { SqlError } from "@effect/sql/SqlError";
import { Effect } from "effect";
import { EpicRepository, type EpicId } from "./EpicRepository.js";
import { TaskRepository } from "./TaskRepository.js";
import { AgentSessionRepository } from "./AgentSessionRepository.js";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Status of an epic in the list
 * - active: Agent session is currently running for this epic
 * - idle: No active agent session
 */
export type EpicStatus = "active" | "idle";

/**
 * Enriched epic data for list display
 */
export interface EpicListItem {
	id: EpicId;
	title: string;
	status: EpicStatus;
	taskProgress: {
		completed: number;
		total: number;
	};
	updatedAt: Date;
	isDeleted: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

const makeEpicListService = Effect.gen(function* () {
	const epicRepo = yield* EpicRepository;
	const taskRepo = yield* TaskRepository;
	const sessionRepo = yield* AgentSessionRepository;

	/**
	 * Get enriched epic list items with status and progress.
	 * Always fetches all epics (including deleted) for client-side filtering.
	 */
	const getEpicListItems = (): Effect.Effect<EpicListItem[], SqlError> =>
		Effect.gen(function* () {
			// 1. Fetch all epics (including deleted)
			const epics = yield* epicRepo.findAll({ includeDeleted: true });

			// 2. Fetch running sessions to determine active status
			const runningSessions = yield* sessionRepo.findByStatus("running");
			const activeEpicIds = new Set(
				runningSessions
					.filter((s) => s.epicId !== null)
					.map((s) => s.epicId as number),
			);

			// 3. Build enriched list items
			const items: EpicListItem[] = yield* Effect.all(
				epics.map((epic) =>
					Effect.gen(function* () {
						// Fetch tasks for this epic to compute progress
						const tasks = yield* taskRepo.findByEpicId(epic.id as EpicId);
						const completed = tasks.filter((t) => t.passes).length;
						const total = tasks.length;

						const item: EpicListItem = {
							id: epic.id as EpicId,
							title: epic.title,
							status: activeEpicIds.has(epic.id) ? "active" : "idle",
							taskProgress: {
								completed,
								total,
							},
							updatedAt: epic.updatedAt,
							isDeleted: epic.deletedAt !== null,
						};

						return item;
					}),
				),
				{ concurrency: "unbounded" },
			);

			// Sort by updatedAt descending (most recent first)
			return items.sort(
				(a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
			);
		});

	return {
		getEpicListItems,
	};
});

export class EpicListService extends Effect.Service<EpicListService>()(
	"@ralph/EpicListService",
	{
		effect: makeEpicListService,
	},
) {}
