import {
	TextAttributes,
	type SelectOption,
	type TextareaRenderable,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useRef, useMemo } from "react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import {
	openQuestionsAtom,
	questionAnswersAtom,
	currentQuestionIndexAtom,
	customInputModeAtom,
	wizardStepAtom,
	patchSpecWithAnswersFn,
} from "../../atoms/epicCreation.js";
import {
	QuestionAnswer,
	type OptionId,
	type QuestionId,
} from "../../utils/openQuestions.js";

export function QuestionsStep() {
	const questions = useAtomValue(openQuestionsAtom);
	const currentIndex = useAtomValue(currentQuestionIndexAtom);
	const answers = useAtomValue(questionAnswersAtom);
	const customInputMode = useAtomValue(customInputModeAtom);

	const setCurrentIndex = useAtomSet(currentQuestionIndexAtom);
	const setAnswers = useAtomSet(questionAnswersAtom);
	const setCustomInputMode = useAtomSet(customInputModeAtom);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const triggerPatch = useAtomSet(patchSpecWithAnswersFn);

	const textareaRef = useRef<TextareaRenderable>(null);

	const currentQuestion = questions[currentIndex];
	const isLastQuestion = currentIndex === questions.length - 1;

	// Convert question options to SelectOption format
	const selectOptions: SelectOption[] = useMemo(() => {
		if (!currentQuestion) return [];
		return currentQuestion.options.map((opt) => ({
			name: opt.label + (opt.recommended ? " (recommended)" : ""),
			description: opt.description,
			value: opt.id,
		}));
	}, [currentQuestion]);

	const handleOptionSelect = (_index: number, option: SelectOption | null) => {
		if (!option || !currentQuestion) return;

		const optionId = option.value as OptionId;

		// If custom selected, switch to textarea mode
		if (optionId === ("custom" as OptionId)) {
			setCustomInputMode(true);
			return;
		}

		// Save answer
		const answer = new QuestionAnswer({
			questionId: currentQuestion.id as QuestionId,
			selectedOptionId: optionId,
		});
		const newAnswers = new Map(answers);
		newAnswers.set(currentQuestion.id, answer);
		setAnswers(newAnswers);

		// Move to next question or trigger patching
		if (isLastQuestion) {
			triggerPatch("");
		} else {
			setCurrentIndex(currentIndex + 1);
		}
	};

	const handleCustomSubmit = () => {
		const customText = textareaRef.current?.plainText ?? "";
		if (!customText.trim() || !currentQuestion) return;

		const answer = new QuestionAnswer({
			questionId: currentQuestion.id as QuestionId,
			selectedOptionId: "custom" as OptionId,
			customResponse: customText,
		});
		const newAnswers = new Map(answers);
		newAnswers.set(currentQuestion.id, answer);
		setAnswers(newAnswers);
		setCustomInputMode(false);

		// Move to next question or trigger patching
		if (isLastQuestion) {
			triggerPatch("");
		} else {
			setCurrentIndex(currentIndex + 1);
		}
	};

	useKeyboard((key) => {
		if (key.name === "escape") {
			if (customInputMode) {
				// Exit custom input mode
				setCustomInputMode(false);
			} else if (currentIndex > 0) {
				// Go back to previous question
				setCurrentIndex(currentIndex - 1);
			} else {
				// Skip questions entirely, go to review
				setWizardStep({ type: "review" });
			}
		}
		// Ctrl+Enter to submit custom response
		if (customInputMode && key.ctrl && key.name === "return") {
			handleCustomSubmit();
		}
	});

	if (!currentQuestion) {
		return <text>No questions to answer.</text>;
	}

	return (
		<box flexDirection="column" flexGrow={1}>
			{/* Progress indicator */}
			<box marginBottom={1}>
				<text fg="cyan">
					Question {currentIndex + 1} of {questions.length}
				</text>
			</box>

			{/* Question text */}
			<text>{currentQuestion.text}</text>

			{/* Context */}
			<text attributes={TextAttributes.DIM} marginTop={1}>
				{currentQuestion.context}
			</text>

			{customInputMode ? (
				/* Custom input textarea */
				<box flexDirection="column" marginTop={1} flexGrow={1}>
					<text fg="cyan">Enter your custom response:</text>
					<box border marginTop={1} flexGrow={1} width="100%">
						<textarea
							ref={textareaRef}
							focused
							placeholder="Type your answer..."
							wrapMode="word"
							flexGrow={1}
						/>
					</box>
					<text attributes={TextAttributes.DIM} marginTop={1}>
						[Ctrl+Enter] Submit [Escape] Back to options
					</text>
				</box>
			) : (
				/* Options select */
				<box flexDirection="column" marginTop={1} flexGrow={1}>
					<box border flexGrow={1} width={70}>
						<select
							options={selectOptions}
							focused
							onSelect={handleOptionSelect}
							textColor="white"
							selectedTextColor="cyan"
							descriptionColor="gray"
							selectedDescriptionColor="white"
							flexGrow={1}
						/>
					</box>
					<text attributes={TextAttributes.DIM} marginTop={1}>
						{currentIndex > 0
							? "[Escape] Previous question"
							: "[Escape] Skip all questions"}
					</text>
				</box>
			)}
		</box>
	);
}
