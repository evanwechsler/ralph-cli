import { TextAttributes, type SelectOption } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import {
	savedEpicIdAtom,
	specContentAtom,
	wizardStepAtom,
	descriptionAtom,
	generationStatusAtom,
	sessionIdAtom,
	feedbackAtom,
	errorMessageAtom,
} from "../../atoms/epicCreation.js";
import { screenAtom } from "../../atoms/navigation.js";
import { extractTitleFromSpec } from "../../utils/specParser.js";

const menuOptions: SelectOption[] = [
	{
		name: "Create Another Epic",
		description: "Start a new epic",
		value: "create",
	},
	{
		name: "Back to Menu",
		description: "Return to main menu",
		value: "menu",
	},
];

export function SuccessStep() {
	const epicId = useAtomValue(savedEpicIdAtom);
	const specContent = useAtomValue(specContentAtom);
	const setScreen = useAtomSet(screenAtom);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const setDescription = useAtomSet(descriptionAtom);
	const setSpecContent = useAtomSet(specContentAtom);
	const setGenerationStatus = useAtomSet(generationStatusAtom);
	const setSessionId = useAtomSet(sessionIdAtom);
	const setFeedback = useAtomSet(feedbackAtom);
	const setErrorMessage = useAtomSet(errorMessageAtom);
	const setSavedEpicId = useAtomSet(savedEpicIdAtom);

	const title = extractTitleFromSpec(specContent);

	const resetWizard = () => {
		setWizardStep({ type: "description" });
		setDescription("");
		setSpecContent("");
		setGenerationStatus({ type: "idle" });
		setSessionId(null);
		setFeedback("");
		setErrorMessage(null);
		setSavedEpicId(null);
	};

	useKeyboard((key) => {
		if (key.name === "escape") {
			handleAction("menu");
		}
	});

	const handleAction = (action: string) => {
		switch (action) {
			case "create":
				resetWizard();
				// Stays in epic-creation screen, now at description step
				break;
			case "menu":
				resetWizard();
				setScreen({ type: "main-menu" });
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
			<box flexDirection="column" padding={1}>
				<box>
					<text fg="green">✓ </text>
					<text>Epic saved successfully!</text>
				</box>

				<box marginTop={1}>
					<text attributes={TextAttributes.DIM}>ID: </text>
					<text>{epicId}</text>
				</box>

				<box marginTop={0}>
					<text attributes={TextAttributes.DIM}>Title: </text>
					<text>{title}</text>
				</box>
			</box>

			{/* Action menu */}
			<box marginTop={1} border height={8} width={50}>
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

			<text attributes={TextAttributes.DIM} marginTop={1}>
				[Escape] Back to Menu
			</text>
		</box>
	);
}
