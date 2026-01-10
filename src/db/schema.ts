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

// ─────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────

export const epicsRelations = relations(epics, ({ many }) => ({
	tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	epic: one(epics, { fields: [tasks.epicId], references: [epics.id] }),
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
