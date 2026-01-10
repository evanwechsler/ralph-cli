import { TextAttributes, type SelectOption } from "@opentui/core";
import { useAtomSet } from "@effect-atom/atom-react";
import { screenAtom } from "../../atoms/navigation.js";

const menuOptions: SelectOption[] = [
	{
		name: "Create New Epic",
		description: "Start a new development epic",
		value: "create",
	},
	{
		name: "List Epics",
		description: "View existing epics (coming soon)",
		value: "list",
	},
	{
		name: "Exit",
		description: "Quit Ralph",
		value: "exit",
	},
];

export function MainMenuScreen() {
	const setScreen = useAtomSet(screenAtom);

	const handleSelect = (_index: number, option: SelectOption | null) => {
		if (!option) return;

		switch (option.value) {
			case "create":
				setScreen({ type: "epic-creation" });
				break;
			case "exit":
				process.exit(0);
				break;
		}
	};

	return (
		<box flexDirection="column" padding={1}>
			<ascii-font font="tiny" text="Ralph" />
			<text attributes={TextAttributes.DIM}>What will you build?</text>
			<box border marginTop={1} height={12} width={50}>
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
		</box>
	);
}
