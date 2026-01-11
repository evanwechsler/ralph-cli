import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { useEffect } from "react";
import {
	wizardStepAtom,
	descriptionAtom,
	specContentAtom,
	feedbackAtom,
	openQuestionsAtom,
	questionAnswersAtom,
	currentQuestionIndexAtom,
	customInputModeAtom,
	type WizardStep,
} from "../../atoms/epicCreation.js";
import {
	checkDraftExistsFn,
	saveDraftDebounced,
	draftCheckStateAtom,
} from "../../atoms/draftPersistence.js";
import { DescriptionStep } from "./DescriptionStep.js";
import { GenerationStep } from "./GenerationStep.js";
import { QuestionsStep } from "./QuestionsStep.js";
import { PatchingStep } from "./PatchingStep.js";
import { ReviewStep } from "./ReviewStep.js";
import { FeedbackStep } from "./FeedbackStep.js";
import { SuccessStep } from "./SuccessStep.js";
import { DraftPrompt } from "./DraftPrompt.js";

export function EpicCreationScreen() {
	const step = useAtomValue(wizardStepAtom);
	const draftCheckState = useAtomValue(draftCheckStateAtom);

	const checkDraftExists = useAtomSet(checkDraftExistsFn);
	const triggerSave = useAtomSet(saveDraftDebounced);

	// Watch all saveable atoms for auto-save
	const description = useAtomValue(descriptionAtom);
	const specContent = useAtomValue(specContentAtom);
	const feedback = useAtomValue(feedbackAtom);
	const openQuestions = useAtomValue(openQuestionsAtom);
	const questionAnswers = useAtomValue(questionAnswersAtom);
	const currentQuestionIndex = useAtomValue(currentQuestionIndexAtom);
	const customInputMode = useAtomValue(customInputModeAtom);

	// Check for existing draft on mount
	useEffect(() => {
		if (draftCheckState === "pending") {
			checkDraftExists(undefined);
		}
	}, [draftCheckState, checkDraftExists]);

	// Auto-save on atom changes (after draft prompt is resolved)
	// We intentionally include all state values as dependencies to trigger saves on changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally trigger on state changes for auto-save
	useEffect(() => {
		// Don't save until draft check is complete and resolved
		if (draftCheckState !== "empty") return;

		// Trigger debounced save (it internally skips transient states)
		triggerSave(undefined);
	}, [
		draftCheckState,
		triggerSave,
		step,
		description,
		specContent,
		feedback,
		openQuestions,
		questionAnswers,
		currentQuestionIndex,
		customInputMode,
	]);

	// Show loading/checking state
	if (draftCheckState === "pending" || draftCheckState === "checking") {
		return (
			<box flexDirection="column" padding={1} flexGrow={1}>
				<ascii-font font="tiny" text="Ralph" />
				<text attributes={TextAttributes.DIM}>Epic Creation</text>
				<box marginTop={1} flexGrow={1}>
					<text attributes={TextAttributes.DIM}>Checking for draft...</text>
				</box>
			</box>
		);
	}

	// Show draft prompt if draft exists
	if (draftCheckState === "exists") {
		return (
			<box flexDirection="column" padding={1} flexGrow={1}>
				<ascii-font font="tiny" text="Ralph" />
				<text attributes={TextAttributes.DIM}>Epic Creation</text>
				<box marginTop={1} flexGrow={1}>
					<DraftPrompt />
				</box>
			</box>
		);
	}

	// Normal wizard flow (draftCheckState === "empty")
	return (
		<box flexDirection="column" padding={1} flexGrow={1}>
			<ascii-font font="tiny" text="Ralph" />
			<text attributes={TextAttributes.DIM}>Epic Creation</text>
			<box marginTop={1} flexGrow={1}>
				{renderStep(step)}
			</box>
		</box>
	);
}

function renderStep(step: WizardStep) {
	switch (step.type) {
		case "description":
			return <DescriptionStep />;
		case "generating":
			return <GenerationStep />;
		case "questions":
			return <QuestionsStep />;
		case "patching":
			return <PatchingStep />;
		case "review":
			return <ReviewStep />;
		case "feedback":
			return <FeedbackStep />;
		case "saving":
			return <SavingIndicator />;
		case "success":
			return <SuccessStep />;
		case "error":
			return <ErrorStep message={step.message} />;
	}
}

function SavingIndicator() {
	return (
		<box flexDirection="column" padding={1}>
			<text fg="cyan">● Saving epic...</text>
		</box>
	);
}

function ErrorStep({ message }: { message: string }) {
	const setWizardStep = useAtomSet(wizardStepAtom);

	useKeyboard((key) => {
		if (key.name === "escape") {
			setWizardStep({ type: "review" });
		}
	});

	return (
		<box flexDirection="column" padding={1}>
			<text fg="red">✗ Error: {message}</text>
			<text attributes={TextAttributes.DIM} marginTop={1}>
				Press Escape to go back
			</text>
		</box>
	);
}
