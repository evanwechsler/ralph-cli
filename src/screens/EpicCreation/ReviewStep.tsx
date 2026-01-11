import { TextAttributes, type SelectOption } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import {
	specContentAtom,
	wizardStepAtom,
	errorMessageAtom,
	saveEpicFn,
	editInEditorFn,
} from "../../atoms/epicCreation.js";
import {
	saveDraftImmediateFn,
	clearDraftAndResetFn,
} from "../../atoms/draftPersistence.js";
import { screenAtom } from "../../atoms/navigation.js";
import { StreamingOutput } from "../../components/StreamingOutput.js";

const menuOptions: SelectOption[] = [
	{
		name: "Save Epic",
		description: "Save to database (Ctrl+S)",
		value: "save",
	},
	{
		name: "Give Feedback",
		description: "Iterate with suggestions",
		value: "feedback",
	},
	{
		name: "Edit in Editor",
		description: "Open in $EDITOR",
		value: "edit",
	},
	{
		name: "Back to Menu",
		description: "Save draft & exit (Escape)",
		value: "exit",
	},
	{
		name: "Start Over",
		description: "Clear draft & restart",
		value: "discard",
	},
];

export function ReviewStep() {
	const content = useAtomValue(specContentAtom);
	const errorMessage = useAtomValue(errorMessageAtom);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const triggerSave = useAtomSet(saveEpicFn);
	const triggerEdit = useAtomSet(editInEditorFn);
	const setError = useAtomSet(errorMessageAtom);
	const saveDraftImmediate = useAtomSet(saveDraftImmediateFn);
	const clearDraftAndReset = useAtomSet(clearDraftAndResetFn);
	const setScreen = useAtomSet(screenAtom);

	useKeyboard((key) => {
		// Ctrl+S to save
		if (key.ctrl && key.name === "s") {
			handleAction("save");
		}
		// Escape to save draft and exit to menu
		if (key.name === "escape") {
			handleAction("exit");
		}
	});

	const handleAction = (action: string) => {
		setError(null); // Clear any previous error

		switch (action) {
			case "save":
				triggerSave("");
				break;
			case "feedback":
				setWizardStep({ type: "feedback" });
				break;
			case "edit":
				triggerEdit("");
				break;
			case "exit":
				// Save draft and exit to main menu
				saveDraftImmediate(undefined);
				setScreen({ type: "epic-list" });
				break;
			case "discard":
				// Clear draft and start over
				clearDraftAndReset(undefined);
				break;
		}
	};

	const handleSelect = (_index: number, option: SelectOption | null) => {
		if (option?.value) {
			handleAction(option.value as string);
		}
	};

	return (
		<box flexDirection="column" flexGrow={1}>
			{/* Error banner if present */}
			{errorMessage && (
				<box marginBottom={1}>
					<text fg="red">Error: {errorMessage}</text>
				</box>
			)}

			{/* Spec content in scrollable box */}
			<box border flexGrow={1} padding={1}>
				<StreamingOutput content={content} autoScroll={false} />
			</box>

			{/* Action menu */}
			<box marginTop={1} border height={10} width={50}>
				<select
					options={menuOptions}
					focused
					onSelect={handleSelect}
					textColor="white"
					selectedTextColor="cyan"
					descriptionColor="gray"
					selectedDescriptionColor="white"
					flexGrow={1}
				/>
			</box>

			{/* Keyboard hints */}
			<text attributes={TextAttributes.DIM} marginTop={1}>
				[Ctrl+S] Save [Escape] Back to Menu
			</text>
		</box>
	);
}
