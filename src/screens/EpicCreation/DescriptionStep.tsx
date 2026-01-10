import { TextAttributes, type TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useRef } from "react";
import { useAtomSet } from "@effect-atom/atom-react";
import { generateSpecFn } from "../../atoms/epicCreation.js";
import { screenAtom } from "../../atoms/navigation.js";

export function DescriptionStep() {
	const textareaRef = useRef<TextareaRenderable>(null);
	const triggerGeneration = useAtomSet(generateSpecFn);
	const setScreen = useAtomSet(screenAtom);

	// Handle keyboard shortcuts
	useKeyboard((key) => {
		if (key.name === "escape") {
			setScreen({ type: "main-menu" });
		}
		// Ctrl+Enter to submit
		if (key.ctrl && key.name === "return") {
			handleSubmit();
		}
	});

	const handleSubmit = () => {
		const description = textareaRef.current?.plainText ?? "";
		if (description.trim().length > 0) {
			triggerGeneration(description);
		}
	};

	return (
		<box flexDirection="column" flexGrow={1}>
			<text>Describe your epic:</text>
			<box border marginTop={1} flexGrow={1} width="100%">
				<textarea
					ref={textareaRef}
					focused
					placeholder="Enter a description of your epic..."
					wrapMode="word"
					flexGrow={1}
				/>
			</box>
			<box marginTop={1} flexDirection="column">
				<text attributes={TextAttributes.DIM}>
					[Ctrl+Enter] Generate Spec [Escape] Back to Menu
				</text>
			</box>
		</box>
	);
}
