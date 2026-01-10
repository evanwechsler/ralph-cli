import { TextAttributes } from "@opentui/core";

export function EpicCreationScreen() {
	return (
		<box flexDirection="column" padding={1}>
			<ascii-font font="tiny" text="Ralph" />
			<text attributes={TextAttributes.DIM}>Epic Creation</text>
			<box border marginTop={1} padding={1}>
				<text>Coming in Phase 2</text>
			</box>
			<text attributes={TextAttributes.DIM} marginTop={1}>
				Press Escape to return to main menu
			</text>
		</box>
	);
}
