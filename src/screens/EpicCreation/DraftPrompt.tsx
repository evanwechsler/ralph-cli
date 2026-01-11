import { TextAttributes, type SelectOption } from "@opentui/core";
import { useAtomSet } from "@effect-atom/atom-react";
import {
	loadDraftFn,
	clearDraftAndResetFn,
} from "../../atoms/draftPersistence.js";

const draftOptions: SelectOption[] = [
	{
		name: "Resume Draft",
		description: "Continue where you left off",
		value: "resume",
	},
	{
		name: "Start Fresh",
		description: "Discard draft and start over",
		value: "fresh",
	},
];

export function DraftPrompt() {
	const loadDraft = useAtomSet(loadDraftFn);
	const clearDraft = useAtomSet(clearDraftAndResetFn);

	const handleSelect = (_index: number, option: SelectOption | null) => {
		if (!option?.value) return;

		if (option.value === "resume") {
			// Loads draft and sets draftCheckStateAtom to "empty"
			loadDraft(undefined);
		} else {
			// Clears draft, resets wizard, and sets draftCheckStateAtom to "empty"
			clearDraft(undefined);
		}
	};

	return (
		<box flexDirection="column" flexGrow={1}>
			<text fg="yellow">A draft epic was found.</text>
			<text attributes={TextAttributes.DIM} marginTop={1}>
				Would you like to resume or start fresh?
			</text>
			<box border marginTop={2} height={8} width={50}>
				<select
					options={draftOptions}
					focused
					onSelect={handleSelect}
					textColor="white"
					selectedTextColor="cyan"
					descriptionColor="gray"
					selectedDescriptionColor="white"
					flexGrow={1}
				/>
			</box>
		</box>
	);
}
