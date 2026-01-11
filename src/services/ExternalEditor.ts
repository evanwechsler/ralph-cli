import { Data, Effect } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { suspendRenderer, resumeRenderer } from "../renderer.js";

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export class ExternalEditorError extends Data.TaggedError(
	"ExternalEditorError",
)<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

const makeExternalEditor = Effect.gen(function* () {
	/**
	 * Opens the user's preferred editor ($EDITOR or $VISUAL) with initial content.
	 * Returns the edited content when the editor closes.
	 */
	const openEditor = (
		initialContent: string,
	): Effect.Effect<string, ExternalEditorError> =>
		Effect.gen(function* () {
			const editor = process.env.EDITOR || process.env.VISUAL || "vim";
			const tmpDir = os.tmpdir();
			const tmpFile = path.join(tmpDir, `ralph-spec-${Date.now()}.md`);

			// Write initial content to temp file
			yield* Effect.tryPromise({
				try: () => fs.writeFile(tmpFile, initialContent, "utf-8"),
				catch: (e) =>
					new ExternalEditorError({
						message: "Failed to write temp file",
						cause: e,
					}),
			});

			// Suspend TUI before opening editor
			yield* Effect.sync(() => suspendRenderer());

			// Open editor and wait for it to close
			yield* Effect.async<void, ExternalEditorError>((resume) => {
				const child = spawn(editor, [tmpFile], {
					stdio: "inherit",
				});

				child.on("close", (code) => {
					// Resume TUI after editor closes
					resumeRenderer();

					if (code === 0) {
						resume(Effect.void);
					} else {
						resume(
							Effect.fail(
								new ExternalEditorError({
									message: `Editor exited with code ${code}`,
								}),
							),
						);
					}
				});

				child.on("error", (err) => {
					// Resume TUI on error too
					resumeRenderer();

					resume(
						Effect.fail(
							new ExternalEditorError({
								message: "Failed to spawn editor",
								cause: err,
							}),
						),
					);
				});
			});

			// Read edited content from temp file
			const content = yield* Effect.tryPromise({
				try: () => fs.readFile(tmpFile, "utf-8"),
				catch: (e) =>
					new ExternalEditorError({
						message: "Failed to read temp file",
						cause: e,
					}),
			});

			// Clean up temp file (ignore errors)
			yield* Effect.tryPromise({
				try: () => fs.unlink(tmpFile),
				catch: () =>
					new ExternalEditorError({
						message: "Failed to delete temp file",
					}),
			}).pipe(Effect.ignore);

			return content;
		});

	return { openEditor };
});

// ─────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────

export class ExternalEditor extends Effect.Service<ExternalEditor>()(
	"@ralph/ExternalEditor",
	{
		effect: makeExternalEditor,
	},
) {}
