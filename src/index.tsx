import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
	RegistryProvider,
	useAtomValue,
	useAtomSet,
} from "@effect-atom/atom-react";
import { screenAtom } from "./atoms/navigation.js";
import { MainMenuScreen } from "./screens/MainMenu/MainMenuScreen.js";
import { EpicCreationScreen } from "./screens/EpicCreation/EpicCreationScreen.js";

// Global renderer reference for cleanup
let appRenderer: CliRenderer | null = null;

/**
 * Gracefully exit the application, ensuring terminal is restored
 */
export function exitApp(code = 0): void {
	if (appRenderer) {
		appRenderer.destroy();
		appRenderer = null;
	}
	process.exit(code);
}

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
appRenderer = renderer;

// Handle unexpected exits gracefully
process.on("SIGINT", () => exitApp(0));
process.on("SIGTERM", () => exitApp(0));

createRoot(renderer).render(<App />);
