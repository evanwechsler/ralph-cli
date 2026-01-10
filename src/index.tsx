import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
	RegistryProvider,
	useAtomValue,
	useAtomSet,
} from "@effect-atom/atom-react";
import { screenAtom } from "./atoms/navigation.js";
import { MainMenuScreen } from "./screens/MainMenu/MainMenuScreen.js";
import { EpicCreationScreen } from "./screens/EpicCreation/EpicCreationScreen.js";

function Router() {
	const screen = useAtomValue(screenAtom);
	const setScreen = useAtomSet(screenAtom);

	useKeyboard((key) => {
		if (key.name === "escape" && screen.type !== "main-menu") {
			setScreen({ type: "main-menu" });
		}
	});

	switch (screen.type) {
		case "main-menu":
			return <MainMenuScreen />;
		case "epic-creation":
			return <EpicCreationScreen />;
	}
}

function App() {
	return (
		<RegistryProvider>
			<Router />
		</RegistryProvider>
	);
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
