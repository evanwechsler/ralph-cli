import { Config, Effect, Layer, Schema } from "effect";

// ─────────────────────────────────────────────────────────────
// Branded Types
// ─────────────────────────────────────────────────────────────

export const DbFilePath = Schema.String.pipe(Schema.brand("DbFilePath"));
export type DbFilePath = typeof DbFilePath.Type;

// ─────────────────────────────────────────────────────────────
// Database Configuration Service
// ─────────────────────────────────────────────────────────────

export class DbConfig extends Effect.Service<DbConfig>()("@ralph/DbConfig", {
	effect: Effect.gen(function* () {
		const filename = yield* Config.string("DB_FILE_NAME").pipe(
			Config.map((s) => s as DbFilePath),
		);
		const disableWAL = yield* Config.boolean("DB_DISABLE_WAL").pipe(
			Config.withDefault(false),
		);

		return { filename, disableWAL };
	}),
}) {
	// Test layer - uses in-memory SQLite database
	static readonly testLayer = Layer.succeed(DbConfig, {
		_tag: "@ralph/DbConfig" as const,
		filename: ":memory:" as DbFilePath,
		disableWAL: true,
	});
}
