CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`epic_id` integer,
	`claude_session_id` text NOT NULL,
	`status` text NOT NULL,
	`current_task_id` integer,
	`last_message_uuid` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`epic_id`) REFERENCES `epics`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `epic_drafts` (
	`id` integer PRIMARY KEY NOT NULL,
	`wizard_step` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`spec_content` text DEFAULT '' NOT NULL,
	`session_id` text,
	`feedback` text DEFAULT '' NOT NULL,
	`open_questions` text DEFAULT '[]' NOT NULL,
	`question_answers` text DEFAULT '{}' NOT NULL,
	`current_question_index` integer DEFAULT 0 NOT NULL,
	`custom_input_mode` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `epics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`progress_log` text DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`epic_id` integer NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`steps` text NOT NULL,
	`passes` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`epic_id`) REFERENCES `epics`(`id`) ON UPDATE no action ON DELETE cascade
);
