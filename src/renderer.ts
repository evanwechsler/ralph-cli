import type { CliRenderer } from "@opentui/core";

// Global renderer reference for cleanup and suspend/resume
let appRenderer: CliRenderer | null = null;

/**
 * Set the global renderer reference
 */
export function setRenderer(renderer: CliRenderer): void {
	appRenderer = renderer;
}

/**
 * Get the global renderer reference
 */
export function getRenderer(): CliRenderer | null {
	return appRenderer;
}

/**
 * Clear the global renderer reference
 */
export function clearRenderer(): void {
	appRenderer = null;
}

/**
 * Suspend the TUI renderer (for external editor usage)
 */
export function suspendRenderer(): void {
	if (appRenderer) {
		appRenderer.suspend();
	}
}

/**
 * Resume the TUI renderer (after external editor closes)
 */
export function resumeRenderer(): void {
	if (appRenderer) {
		appRenderer.resume();
	}
}

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
