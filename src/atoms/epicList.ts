import { Atom } from "@effect-atom/atom-react";
import { Effect, pipe } from "effect";
import { appRuntime } from "./runtime.js";
import { EpicRepository, type EpicId } from "../services/EpicRepository.js";
import { EpicListService } from "../services/EpicListService.js";
import type { SqlError } from "@effect/sql/SqlError";

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

/**
 * List state discriminated union
 */
export type EpicListState =
	| { type: "loading" }
	| { type: "loaded"; items: EpicListItem[] }
	| { type: "error"; message: string };

/**
 * Filter options for epic list
 * - active: In progress or not started (has incomplete tasks or no tasks)
 * - completed: All tasks marked as passing
 * - deleted: Soft-deleted epics
 * - all: Everything including deleted
 */
export type EpicListFilter = "active" | "completed" | "deleted" | "all";

/**
 * Tab options for detail view
 */
export type DetailViewTab = "overview" | "kanban";

// ─────────────────────────────────────────────────────────────
// State Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Epic list loading/loaded/error state (stores ALL epics)
 */
export const epicListStateAtom = pipe(
	Atom.make<EpicListState>({ type: "loading" }),
	Atom.keepAlive,
);

/**
 * Current filter selection (default: "active")
 */
export const epicListFilterAtom = pipe(
	Atom.make<EpicListFilter>("active"),
	Atom.keepAlive,
);

/**
 * Search query string (default: "")
 */
export const epicSearchQueryAtom = pipe(Atom.make<string>(""), Atom.keepAlive);

/**
 * Whether search input is active (default: false)
 */
export const searchModeAtom = pipe(Atom.make<boolean>(false), Atom.keepAlive);

/**
 * Currently selected epic ID for detail view
 */
export const selectedEpicIdAtom = pipe(
	Atom.make<EpicId | null>(null),
	Atom.keepAlive,
);

/**
 * Tab state for detail view ("overview" | "kanban")
 */
export const detailViewTabAtom = pipe(
	Atom.make<DetailViewTab>("overview"),
	Atom.keepAlive,
);

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Filter epics by status filter AND search query.
 * Use this in components to compute filtered list from state.
 */
export function filterEpics(
	state: EpicListState,
	filter: EpicListFilter,
	searchQuery: string,
): EpicListItem[] {
	if (state.type !== "loaded") {
		return [];
	}

	let filtered = state.items;
	const query = searchQuery.toLowerCase();

	// Apply status filter
	switch (filter) {
		case "active":
			// Active = not deleted AND (no tasks OR has incomplete tasks)
			filtered = filtered.filter(
				(epic: EpicListItem) =>
					!epic.isDeleted &&
					(epic.taskProgress.total === 0 ||
						epic.taskProgress.completed < epic.taskProgress.total),
			);
			break;
		case "completed":
			// Completed = not deleted AND has tasks AND all tasks complete
			filtered = filtered.filter(
				(epic: EpicListItem) =>
					!epic.isDeleted &&
					epic.taskProgress.total > 0 &&
					epic.taskProgress.completed === epic.taskProgress.total,
			);
			break;
		case "deleted":
			// Only deleted epics
			filtered = filtered.filter((epic: EpicListItem) => epic.isDeleted);
			break;
		case "all":
			// No filter
			break;
	}

	// Apply search filter (case-insensitive title match)
	if (query) {
		filtered = filtered.filter((epic: EpicListItem) =>
			epic.title.toLowerCase().includes(query),
		);
	}

	return filtered;
}

// ─────────────────────────────────────────────────────────────
// Function Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Function atom that loads the epic list from the service.
 * Fetches all epics (including deleted) for client-side filtering.
 */
export const loadEpicListFn = appRuntime.fn<SqlError, EpicListItem[], void>(
	(_, ctx) =>
		Effect.gen(function* () {
			const service = yield* EpicListService;

			// Set loading state
			ctx.set(epicListStateAtom, { type: "loading" });

			// Fetch epic list items
			const items = yield* service.getEpicListItems();

			// Set loaded state
			ctx.set(epicListStateAtom, { type: "loaded", items });

			return items;
		}).pipe(
			Effect.catchAll((error: SqlError) =>
				Effect.sync(() => {
					ctx.set(epicListStateAtom, {
						type: "error",
						message: error.message ?? "Failed to load epics",
					});
					return [] as EpicListItem[];
				}),
			),
		),
);

/**
 * Function atom that soft-deletes an epic.
 */
export const deleteEpicFn = appRuntime.fn<SqlError, void, EpicId>(
	(epicId, ctx) =>
		Effect.gen(function* () {
			const repo = yield* EpicRepository;

			// Soft delete the epic
			yield* repo.softDelete(epicId);

			// Refresh the list
			const service = yield* EpicListService;
			const items = yield* service.getEpicListItems();
			ctx.set(epicListStateAtom, { type: "loaded", items });
		}).pipe(
			Effect.catchAll((error: SqlError) =>
				Effect.sync(() => {
					ctx.set(epicListStateAtom, {
						type: "error",
						message: error.message ?? "Failed to delete epic",
					});
				}),
			),
		),
);
