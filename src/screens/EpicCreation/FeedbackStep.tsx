import { TextAttributes, type TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useRef } from "react";
import { useAtomSet } from "@effect-atom/atom-react";
import {
	wizardStepAtom,
	regenerateWithFeedbackFn,
	feedbackAtom,
} from "../../atoms/epicCreation.js";

export function FeedbackStep() {
	const textareaRef = useRef<TextareaRenderable>(null);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const setFeedback = useAtomSet(feedbackAtom);
	const triggerRegenerate = useAtomSet(regenerateWithFeedbackFn);

	useKeyboard((key) => {
		// Escape to go back to review
		if (key.name === "escape") {
			setWizardStep({ type: "review" });
		}
		// Ctrl+Enter to submit feedback
		if (key.ctrl && key.name === "return") {
			handleSubmit();
		}
	});

	const handleSubmit = () => {
		const feedback = textareaRef.current?.plainText ?? "";
		if (feedback.trim().length > 0) {
			setFeedback(feedback);
			triggerRegenerate("");
		}
	};

	return (
		<box flexDirection="column" flexGrow={1}>
			<text>What changes would you like to make?</text>
			<text attributes={TextAttributes.DIM}>
				Describe what should be added, removed, or changed in the specification.
			</text>

			<box border marginTop={1} flexGrow={1} width="100%">
				<textarea
					ref={textareaRef}
					focused
					placeholder="e.g., 'Add more detail about error handling' or 'Remove the testing section'"
					wrapMode="word"
					flexGrow={1}
				/>
			</box>

			<box marginTop={1} flexDirection="column">
				<text attributes={TextAttributes.DIM}>
					[Ctrl+Enter] Regenerate [Escape] Back to Review
				</text>
			</box>
		</box>
	);
}
