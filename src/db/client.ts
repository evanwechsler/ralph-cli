import {
	layer as drizzleLayer,
	SqliteDrizzle,
} from "@effect/sql-drizzle/Sqlite";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import { DbConfig } from "./config.js";

// ─────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────

export { SqliteDrizzle };

// ─────────────────────────────────────────────────────────────
// SQLite Client Layer
// ─────────────────────────────────────────────────────────────

export const SqlClientLayer = Layer.unwrapEffect(
	Effect.gen(function* () {
		const config = yield* DbConfig;
		return SqliteClient.layer({
			filename: config.filename,
			disableWAL: config.disableWAL,
		});
	}),
);

// ─────────────────────────────────────────────────────────────
// Drizzle Layer
// ─────────────────────────────────────────────────────────────

export const DrizzleLayer = drizzleLayer;

// ─────────────────────────────────────────────────────────────
// Combined Database Layer
// ─────────────────────────────────────────────────────────────

// Database layer: SqlClient -> Drizzle
export const DatabaseLayer = Layer.provideMerge(DrizzleLayer, SqlClientLayer);

// Full layer including config from environment
export const LiveDatabaseLayer = DatabaseLayer.pipe(
	Layer.provide(DbConfig.Default),
);

// Test layer using in-memory database
export const TestDatabaseLayer = DatabaseLayer.pipe(
	Layer.provide(DbConfig.testLayer),
);
