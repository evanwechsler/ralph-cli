import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { Atom } from "@effect-atom/atom-react";
import * as Result from "@effect-atom/atom/Result";
import {
	generationStatusAtom,
	patchSpecWithAnswersFn,
	wizardStepAtom,
	type GenerationStatus,
} from "../../atoms/epicCreation.js";

export function PatchingStep() {
	const status = useAtomValue(generationStatusAtom);
	const patchingResult = useAtomValue(patchSpecWithAnswersFn);
	const setPatchSpec = useAtomSet(patchSpecWithAnswersFn);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const setStatus = useAtomSet(generationStatusAtom);

	// Handle keyboard shortcuts
	useKeyboard((key) => {
		if (key.name === "escape") {
			// Interrupt the patching and go back to questions
			setPatchSpec(Atom.Interrupt);
			setStatus({ type: "idle" });
			setWizardStep({ type: "questions" });
		}
	});

	// Check for Effect-level errors from the function atom
	const effectError = Result.isFailure(patchingResult)
		? Result.cause(patchingResult)
		: null;

	return (
		<box
			flexDirection="column"
			flexGrow={1}
			justifyContent="center"
			alignItems="center"
		>
			<StatusIndicator status={status} effectError={effectError} />
			<text attributes={TextAttributes.DIM} marginTop={2}>
				[Escape] Cancel
			</text>
		</box>
	);
}

function StatusIndicator({
	status,
	effectError,
}: {
	status: GenerationStatus;
	effectError: unknown;
}) {
	// If there's an Effect-level error, show it
	if (effectError) {
		const errorMessage =
			effectError instanceof Error ? effectError.message : String(effectError);
		return (
			<box flexDirection="column" alignItems="center">
				<box>
					<text fg="red">✗ </text>
					<text>Error: {errorMessage}</text>
				</box>
			</box>
		);
	}

	switch (status.type) {
		case "idle":
			return <text attributes={TextAttributes.DIM}>Ready</text>;

		case "generating":
			return (
				<box flexDirection="column" alignItems="center">
					<box>
						<text fg="cyan">● </text>
						<text>{status.currentActivity}</text>
					</box>
					<text attributes={TextAttributes.DIM} marginTop={1}>
						Tokens: {status.tokenCount}
					</text>
				</box>
			);

		case "complete":
			return (
				<box flexDirection="column" alignItems="center">
					<box>
						<text fg="green">✓ </text>
						<text>Specification updated</text>
					</box>
					<text attributes={TextAttributes.DIM} marginTop={1}>
						Total tokens: {status.tokenCount}
					</text>
				</box>
			);

		case "error":
			return (
				<box flexDirection="column" alignItems="center">
					<box>
						<text fg="red">✗ </text>
						<text>Error: {status.message}</text>
					</box>
					{status.details?.map((detail, i) => (
						<text
							key={`error-${i}-${detail.slice(0, 20)}`}
							attributes={TextAttributes.DIM}
						>
							{detail}
						</text>
					))}
				</box>
			);
	}
}
