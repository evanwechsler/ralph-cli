import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─────────────────────────────────────────────────────────────
// Timestamp Helpers (reusable across tables)
// ─────────────────────────────────────────────────────────────

export const timestamps = {
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
	deletedAt: integer("deleted_at", { mode: "timestamp" }), // soft delete (null = not deleted)
};

// ─────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────

export const epics = sqliteTable("epics", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	description: text("description").notNull(), // stores app_spec
	progressLog: text("progress_log").default(""),
	...timestamps,
});

export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	epicId: integer("epic_id")
		.notNull()
		.references(() => epics.id, { onDelete: "cascade" }),
	category: text("category", {
		enum: ["functional", "style", "integration", "infrastructure", "testing"],
	}).notNull(),
	description: text("description").notNull(),
	steps: text("steps", { mode: "json" }).notNull().$type<string[]>(),
	passes: integer("passes", { mode: "boolean" }).notNull().default(false),
	order: integer("order").notNull().default(0),
	...timestamps,
});

export const agentSessions = sqliteTable("agent_sessions", {
	id: text("id").primaryKey(), // UUID
	epicId: integer("epic_id").references(() => epics.id, {
		onDelete: "set null",
	}),
	claudeSessionId: text("claude_session_id").notNull(),
	status: text("status", {
		enum: ["running", "paused", "completed", "failed"],
	}).notNull(),
	currentTaskId: integer("current_task_id").references(() => tasks.id, {
		onDelete: "set null",
	}),
	lastMessageUuid: text("last_message_uuid"),
	...timestamps,
});

export const epicDrafts = sqliteTable("epic_drafts", {
	id: integer("id").primaryKey(), // Always 1 for single-draft constraint
	wizardStep: text("wizard_step").notNull(), // JSON: { type: "description" } etc.
	description: text("description").notNull().default(""),
	specContent: text("spec_content").notNull().default(""),
	sessionId: text("session_id"), // AgentSessionId or null
	feedback: text("feedback").notNull().default(""),
	openQuestions: text("open_questions").notNull().default("[]"), // JSON array
	questionAnswers: text("question_answers").notNull().default("{}"), // JSON object
	currentQuestionIndex: integer("current_question_index").notNull().default(0),
	customInputMode: integer("custom_input_mode", { mode: "boolean" })
		.notNull()
		.default(false),
	...timestamps,
});

// ─────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────

export const epicsRelations = relations(epics, ({ many }) => ({
	tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	epic: one(epics, { fields: [tasks.epicId], references: [epics.id] }),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
	epic: one(epics, { fields: [agentSessions.epicId], references: [epics.id] }),
	currentTask: one(tasks, {
		fields: [agentSessions.currentTaskId],
		references: [tasks.id],
	}),
}));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Epic = typeof epics.$inferSelect;
export type NewEpic = typeof epics.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskCategory =
	| "functional"
	| "style"
	| "integration"
	| "infrastructure"
	| "testing";

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;

export type AgentSessionStatus = "running" | "paused" | "completed" | "failed";

export type EpicDraft = typeof epicDrafts.$inferSelect;
export type NewEpicDraft = typeof epicDrafts.$inferInsert;
