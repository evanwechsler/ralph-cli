import { TextAttributes, type SelectOption } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { useEffect, useState, useRef } from "react";
import { screenAtom } from "../../atoms/navigation.js";
import {
	epicListStateAtom,
	epicListFilterAtom,
	epicSearchQueryAtom,
	searchModeAtom,
	selectedEpicIdAtom,
	loadEpicListFn,
	deleteEpicFn,
	filterEpics,
	type EpicListItem,
	type EpicListFilter,
} from "../../atoms/epicList.js";
import { exitApp } from "../../renderer.js";
import type { EpicId } from "../../services/EpicRepository.js";

// Filter configuration
const FILTER_ORDER: EpicListFilter[] = [
	"active",
	"completed",
	"deleted",
	"all",
];

const FILTER_LABELS: Record<EpicListFilter, string> = {
	active: "Active",
	completed: "Completed",
	deleted: "Deleted",
	all: "All",
};

function getNextFilter(current: EpicListFilter): EpicListFilter {
	const currentIndex = FILTER_ORDER.indexOf(current);
	const nextIndex = (currentIndex + 1) % FILTER_ORDER.length;
	// Safe access since nextIndex is always within bounds due to modulo
	return FILTER_ORDER[nextIndex] ?? "active";
}

// Helper functions for display formatting
function truncateTitle(title: string, maxLength = 30): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength - 3)}...`;
}

function formatEpicName(epic: EpicListItem): string {
	const status = epic.status === "active" ? "[ACTIVE]" : "[IDLE]";
	return `${status} ${truncateTitle(epic.title)}`;
}

function formatEpicProgress(epic: EpicListItem): string {
	const { completed, total } = epic.taskProgress;
	const checkmark = total > 0 && completed === total ? " ✓" : "";
	return `${completed}/${total}${checkmark}`;
}

export function EpicListScreen() {
	// Atom state
	const listState = useAtomValue(epicListStateAtom);
	const filter = useAtomValue(epicListFilterAtom);
	const searchQuery = useAtomValue(epicSearchQueryAtom);
	const searchMode = useAtomValue(searchModeAtom);
	const selectedEpicId = useAtomValue(selectedEpicIdAtom);

	// Atom setters
	const setScreen = useAtomSet(screenAtom);
	const setFilter = useAtomSet(epicListFilterAtom);
	const setSearchQuery = useAtomSet(epicSearchQueryAtom);
	const setSearchMode = useAtomSet(searchModeAtom);
	const setSelectedEpicId = useAtomSet(selectedEpicIdAtom);
	const loadEpicList = useAtomSet(loadEpicListFn);
	const deleteEpic = useAtomSet(deleteEpicFn);

	// Local state for delete confirmation
	const [deleteConfirmId, setDeleteConfirmId] = useState<EpicId | null>(null);
	const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Compute filtered epics
	const filteredEpics = filterEpics(listState, filter, searchQuery);

	// Load epic list on mount
	useEffect(() => {
		loadEpicList(undefined);
	}, [loadEpicList]);

	// Clear delete confirmation helper
	const clearDeleteConfirm = () => {
		if (deleteTimeoutRef.current) {
			clearTimeout(deleteTimeoutRef.current);
			deleteTimeoutRef.current = null;
		}
		setDeleteConfirmId(null);
	};

	// Handle delete with confirmation
	const handleDelete = () => {
		if (!selectedEpicId) return;

		if (deleteConfirmId === selectedEpicId) {
			// Second D press - execute delete
			deleteEpic(selectedEpicId);
			clearDeleteConfirm();
		} else {
			// First D press - start confirmation
			clearDeleteConfirm();
			setDeleteConfirmId(selectedEpicId);
			deleteTimeoutRef.current = setTimeout(() => {
				setDeleteConfirmId(null);
			}, 2000);
		}
	};

	// Keyboard handler
	useKeyboard((key) => {
		if (searchMode) {
			// Search mode keyboard handling
			if (key.name === "return") {
				// Exit search mode, keep query
				setSearchMode(false);
			} else if (key.name === "escape") {
				// Clear search and exit mode
				setSearchQuery("");
				setSearchMode(false);
			} else if (key.name === "backspace") {
				setSearchQuery(searchQuery.slice(0, -1));
			} else if (
				key.sequence &&
				key.sequence.length === 1 &&
				!key.ctrl &&
				!key.meta
			) {
				// Append printable characters
				setSearchQuery(searchQuery + key.sequence);
			}
		} else {
			// Normal mode keyboard handling
			if (key.name === "return" && selectedEpicId) {
				setScreen({ type: "epic-detail", epicId: selectedEpicId });
			} else if (key.name === "c") {
				setScreen({ type: "epic-creation" });
				clearDeleteConfirm();
			} else if (key.name === "d") {
				handleDelete();
			} else if (key.name === "f") {
				setFilter(getNextFilter(filter));
				clearDeleteConfirm();
			} else if (key.sequence === "/") {
				setSearchMode(true);
				clearDeleteConfirm();
			} else if (key.name === "q") {
				exitApp(0);
			} else {
				// Any other key clears delete confirmation
				clearDeleteConfirm();
			}
		}
	});

	// Handle select from list
	const handleSelect = (_index: number, option: SelectOption | null) => {
		if (option?.value) {
			const epicId = option.value as EpicId;
			setSelectedEpicId(epicId);
			setScreen({ type: "epic-detail", epicId });
		}
	};

	// Convert filtered epics to select options
	const options: SelectOption[] = filteredEpics.map((epic) => ({
		name: formatEpicName(epic),
		description: formatEpicProgress(epic),
		value: epic.id,
	}));

	// Track selected index when list changes
	useEffect(() => {
		const firstEpic = filteredEpics[0];
		if (firstEpic && !selectedEpicId) {
			setSelectedEpicId(firstEpic.id);
		} else if (
			firstEpic &&
			selectedEpicId &&
			!filteredEpics.find((e) => e.id === selectedEpicId)
		) {
			// Selected epic no longer in filtered list, select first
			setSelectedEpicId(firstEpic.id);
		} else if (filteredEpics.length === 0) {
			setSelectedEpicId(null);
		}
	}, [filteredEpics, selectedEpicId, setSelectedEpicId]);

	// Render content based on state
	const renderContent = () => {
		// Loading state
		if (listState.type === "loading") {
			return (
				<box padding={1}>
					<text attributes={TextAttributes.DIM}>Loading epics...</text>
				</box>
			);
		}

		// Error state
		if (listState.type === "error") {
			return (
				<box padding={1}>
					<text fg="red">Error: {listState.message}</text>
				</box>
			);
		}

		// Empty state (no epics at all)
		if (listState.items.length === 0) {
			return (
				<box flexDirection="column" padding={1}>
					<text attributes={TextAttributes.DIM}>No epics yet.</text>
					<text attributes={TextAttributes.DIM}>Press C to create one.</text>
				</box>
			);
		}

		// Empty filter result
		if (filteredEpics.length === 0) {
			return (
				<box padding={1}>
					<text attributes={TextAttributes.DIM}>
						No epics match current filter
						{searchQuery ? ` and search "${searchQuery}"` : ""}.
					</text>
				</box>
			);
		}

		// Normal list display
		return (
			<select
				options={options}
				focused={!searchMode}
				onSelect={handleSelect}
				textColor="white"
				selectedTextColor="cyan"
				descriptionColor="gray"
				selectedDescriptionColor="white"
				flexGrow={1}
			/>
		);
	};

	// Render footer with keyboard hints
	const renderFooter = () => {
		if (searchMode) {
			return (
				<text attributes={TextAttributes.DIM}>
					[Enter] Apply [Esc] Clear search
				</text>
			);
		}

		// Show delete confirmation message if pending
		if (deleteConfirmId) {
			return (
				<text fg="yellow">
					Press D again to confirm delete, or any other key to cancel
				</text>
			);
		}

		return (
			<text attributes={TextAttributes.DIM}>
				[Enter] View [C] Create [D] Delete [F] Filter [/] Search [Q] Quit
			</text>
		);
	};

	return (
		<box flexDirection="column" padding={1} flexGrow={1}>
			{/* Header */}
			<ascii-font font="tiny" text="Ralph" />

			{/* Search/Filter Header Row */}
			{searchMode ? (
				<box marginTop={1}>
					<text>Search: </text>
					<text fg="cyan">{searchQuery}</text>
					<text fg="cyan">_</text>
				</box>
			) : (
				<box marginTop={1}>
					<text>Your Epics:</text>
					<box flexGrow={1} />
					<text attributes={TextAttributes.DIM}>
						[{FILTER_LABELS[filter]} ▼]
					</text>
					<text attributes={TextAttributes.DIM}> [/ Search]</text>
				</box>
			)}

			{/* List Content */}
			<box border marginTop={1} flexGrow={1}>
				{renderContent()}
			</box>

			{/* Footer with keyboard hints */}
			<box marginTop={1}>{renderFooter()}</box>
		</box>
	);
}
