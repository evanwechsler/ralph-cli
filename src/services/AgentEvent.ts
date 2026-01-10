import { Schema } from "effect";

// ─────────────────────────────────────────────────────────────
// Branded ID Type
// ─────────────────────────────────────────────────────────────

export const AgentSessionId = Schema.String.pipe(
	Schema.brand("AgentSessionId"),
);
export type AgentSessionId = typeof AgentSessionId.Type;

// ─────────────────────────────────────────────────────────────
// Agent Event Types (Domain Events)
// ─────────────────────────────────────────────────────────────

export type TokenEvent = {
	readonly type: "token";
	readonly content: string;
};

export type ToolStartEvent = {
	readonly type: "tool_start";
	readonly tool: string;
	readonly toolUseId: string;
	readonly input: unknown;
};

export type ToolEndEvent = {
	readonly type: "tool_end";
	readonly tool: string;
	readonly toolUseId: string;
	readonly result: unknown;
};

export type TurnCompleteEvent = {
	readonly type: "turn_complete";
	readonly usage: {
		readonly inputTokens: number;
		readonly outputTokens: number;
		readonly cacheReadInputTokens: number;
		readonly cacheCreationInputTokens: number;
	};
};

export type SessionInitEvent = {
	readonly type: "session_init";
	readonly sessionId: string;
	readonly model: string;
	readonly tools: readonly string[];
};

export type ResultEvent = {
	readonly type: "result";
	readonly success: boolean;
	readonly result: string;
	readonly totalCostUsd: number;
	readonly durationMs: number;
	readonly numTurns: number;
};

export type ErrorEvent = {
	readonly type: "error";
	readonly message: string;
	readonly errors?: readonly string[];
};

export type AgentEvent =
	| TokenEvent
	| ToolStartEvent
	| ToolEndEvent
	| TurnCompleteEvent
	| SessionInitEvent
	| ResultEvent
	| ErrorEvent;

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

export const isTokenEvent = (event: AgentEvent): event is TokenEvent =>
	event.type === "token";

export const isToolStartEvent = (event: AgentEvent): event is ToolStartEvent =>
	event.type === "tool_start";

export const isToolEndEvent = (event: AgentEvent): event is ToolEndEvent =>
	event.type === "tool_end";

export const isTurnCompleteEvent = (
	event: AgentEvent,
): event is TurnCompleteEvent => event.type === "turn_complete";

export const isSessionInitEvent = (
	event: AgentEvent,
): event is SessionInitEvent => event.type === "session_init";

export const isResultEvent = (event: AgentEvent): event is ResultEvent =>
	event.type === "result";

export const isErrorEvent = (event: AgentEvent): event is ErrorEvent =>
	event.type === "error";
