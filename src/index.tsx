import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
	RegistryProvider,
	useAtomValue,
	useAtomSet,
} from "@effect-atom/atom-react";
import { screenAtom } from "./atoms/navigation.js";
import { EpicCreationScreen } from "./screens/EpicCreation/EpicCreationScreen.js";
import { EpicListScreen } from "./screens/EpicList/index.js";
import {
	setRenderer,
	exitApp,
	suspendRenderer,
	resumeRenderer,
} from "./renderer.js";

// Re-export for backwards compatibility
export { exitApp, suspendRenderer, resumeRenderer };

function Router() {
	const screen = useAtomValue(screenAtom);
	const setScreen = useAtomSet(screenAtom);

	useKeyboard((key) => {
		// Escape returns to epic-list from epic-detail screen only
		// (epic-creation handles its own escape, epic-list is root)
		if (key.name === "escape" && screen.type === "epic-detail") {
			setScreen({ type: "epic-list" });
		}
	});

	switch (screen.type) {
		case "epic-list":
			return <EpicListScreen />;
		case "epic-detail":
			// TODO: Implement EpicDetailScreen in Phase 3
			return (
				<box flexDirection="column" padding={1}>
					<text>Epic Detail (Coming in Phase 3)</text>
					<text>[Esc] Back</text>
				</box>
			);
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
setRenderer(renderer);

// Handle unexpected exits gracefully
process.on("SIGINT", () => exitApp(0));
process.on("SIGTERM", () => exitApp(0));

createRoot(renderer).render(<App />);
