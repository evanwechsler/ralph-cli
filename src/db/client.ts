import {
	layer as drizzleLayer,
	SqliteDrizzle,
} from "@effect/sql-drizzle/Sqlite";
import { SqlClient } from "@effect/sql";
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
const BaseTestDatabaseLayer = DatabaseLayer.pipe(
	Layer.provide(DbConfig.testLayer),
);

// Schema initialization for tests - creates tables in-memory
const initTestSchema = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	// Create tables manually since we can't use drizzle-kit push in-memory
	yield* sql`
		CREATE TABLE IF NOT EXISTS epics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			progress_log TEXT DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER
		)
	`;

	yield* sql`
		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			epic_id INTEGER NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
			category TEXT NOT NULL CHECK(category IN ('functional', 'style', 'integration', 'infrastructure', 'testing')),
			description TEXT NOT NULL,
			steps TEXT NOT NULL,
			passes INTEGER NOT NULL DEFAULT 0,
			"order" INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER
		)
	`;

	yield* sql`
		CREATE TABLE IF NOT EXISTS agent_sessions (
			id TEXT PRIMARY KEY,
			epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL,
			claude_session_id TEXT NOT NULL,
			status TEXT NOT NULL CHECK(status IN ('running', 'paused', 'completed', 'failed')),
			current_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
			last_message_uuid TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER
		)
	`;

	yield* sql`
		CREATE TABLE IF NOT EXISTS epic_drafts (
			id INTEGER PRIMARY KEY,
			wizard_step TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			spec_content TEXT NOT NULL DEFAULT '',
			session_id TEXT,
			feedback TEXT NOT NULL DEFAULT '',
			open_questions TEXT NOT NULL DEFAULT '[]',
			question_answers TEXT NOT NULL DEFAULT '{}',
			current_question_index INTEGER NOT NULL DEFAULT 0,
			custom_input_mode INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			deleted_at INTEGER
		)
	`;
});

// Layer that initializes schema on startup
const SchemaInitLayer = Layer.effectDiscard(initTestSchema);

export const TestDatabaseLayer = Layer.provideMerge(
	SchemaInitLayer,
	BaseTestDatabaseLayer,
);
