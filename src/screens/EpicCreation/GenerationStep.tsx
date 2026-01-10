import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { Atom } from "@effect-atom/atom-react";
import * as Result from "@effect-atom/atom/Result";
import {
	specContentAtom,
	generationStatusAtom,
	generateSpecFn,
	wizardStepAtom,
	type GenerationStatus,
} from "../../atoms/epicCreation.js";
import { StreamingOutput } from "../../components/StreamingOutput.js";

export function GenerationStep() {
	const content = useAtomValue(specContentAtom);
	const status = useAtomValue(generationStatusAtom);
	const generationResult = useAtomValue(generateSpecFn);
	const setGenerateSpec = useAtomSet(generateSpecFn);
	const setWizardStep = useAtomSet(wizardStepAtom);
	const setStatus = useAtomSet(generationStatusAtom);

	// Handle keyboard shortcuts
	useKeyboard((key) => {
		if (key.name === "escape") {
			// Interrupt the generation and go back to description
			setGenerateSpec(Atom.Interrupt);
			setStatus({ type: "idle" });
			setWizardStep({ type: "description" });
		}
	});

	// Check for Effect-level errors from the function atom
	const effectError = Result.isFailure(generationResult)
		? Result.cause(generationResult)
		: null;

	return (
		<box flexDirection="column" flexGrow={1}>
			<StatusIndicator status={status} effectError={effectError} />
			<box border marginTop={1} flexGrow={1} width="100%" padding={1}>
				<StreamingOutput content={content} autoScroll />
			</box>
			<text attributes={TextAttributes.DIM} marginTop={1}>
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
			<box flexDirection="column">
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
				<box flexDirection="column">
					<box>
						<text fg="cyan">● </text>
						<text>{status.currentActivity}</text>
					</box>
					<text attributes={TextAttributes.DIM}>
						Tokens received: {status.tokenCount}
					</text>
				</box>
			);

		case "complete":
			return (
				<box flexDirection="column">
					<box>
						<text fg="green">✓ </text>
						<text>Generation complete</text>
					</box>
					<text attributes={TextAttributes.DIM}>
						Total tokens: {status.tokenCount}
					</text>
				</box>
			);

		case "error":
			return (
				<box flexDirection="column">
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
