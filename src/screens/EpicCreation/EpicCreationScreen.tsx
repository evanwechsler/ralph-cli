import { TextAttributes } from "@opentui/core";
import { useAtomValue } from "@effect-atom/atom-react";
import { wizardStepAtom, type WizardStep } from "../../atoms/epicCreation.js";
import { DescriptionStep } from "./DescriptionStep.js";
import { GenerationStep } from "./GenerationStep.js";

export function EpicCreationScreen() {
	const step = useAtomValue(wizardStepAtom);

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
		case "review":
			return (
				<box border padding={1}>
					<text>Review Step (Coming in Phase 3)</text>
				</box>
			);
	}
}
