import { describe, expect, it } from "vitest";
import {
	isTokenEvent,
	isToolStartEvent,
	isToolEndEvent,
	isTurnCompleteEvent,
	isSessionInitEvent,
	isResultEvent,
	isErrorEvent,
	type AgentEvent,
	type TokenEvent,
	type ToolStartEvent,
	type ToolEndEvent,
	type TurnCompleteEvent,
	type SessionInitEvent,
	type ResultEvent,
	type ErrorEvent,
} from "./AgentEvent.js";

describe("AgentEvent type guards", () => {
	const tokenEvent: TokenEvent = {
		type: "token",
		content: "Hello world",
	};

	const toolStartEvent: ToolStartEvent = {
		type: "tool_start",
		tool: "Read",
		toolUseId: "tool-123",
		input: { file_path: "/test.ts" },
	};

	const toolEndEvent: ToolEndEvent = {
		type: "tool_end",
		tool: "Read",
		toolUseId: "tool-123",
		result: "file contents",
	};

	const turnCompleteEvent: TurnCompleteEvent = {
		type: "turn_complete",
		usage: {
			inputTokens: 100,
			outputTokens: 50,
			cacheReadInputTokens: 10,
			cacheCreationInputTokens: 5,
		},
	};

	const sessionInitEvent: SessionInitEvent = {
		type: "session_init",
		sessionId: "session-abc",
		model: "claude-3-sonnet",
		tools: ["Read", "Write", "Bash"],
	};

	const resultEvent: ResultEvent = {
		type: "result",
		success: true,
		result: "Task completed successfully",
		totalCostUsd: 0.05,
		durationMs: 10000,
		numTurns: 5,
	};

	const errorEvent: ErrorEvent = {
		type: "error",
		message: "Something went wrong",
		errors: ["Error 1", "Error 2"],
	};

	describe("isTokenEvent", () => {
		it("should return true for token events", () => {
			expect(isTokenEvent(tokenEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isTokenEvent(toolStartEvent)).toBe(false);
			expect(isTokenEvent(resultEvent)).toBe(false);
		});
	});

	describe("isToolStartEvent", () => {
		it("should return true for tool_start events", () => {
			expect(isToolStartEvent(toolStartEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isToolStartEvent(tokenEvent)).toBe(false);
			expect(isToolStartEvent(toolEndEvent)).toBe(false);
		});
	});

	describe("isToolEndEvent", () => {
		it("should return true for tool_end events", () => {
			expect(isToolEndEvent(toolEndEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isToolEndEvent(toolStartEvent)).toBe(false);
			expect(isToolEndEvent(tokenEvent)).toBe(false);
		});
	});

	describe("isTurnCompleteEvent", () => {
		it("should return true for turn_complete events", () => {
			expect(isTurnCompleteEvent(turnCompleteEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isTurnCompleteEvent(tokenEvent)).toBe(false);
			expect(isTurnCompleteEvent(resultEvent)).toBe(false);
		});
	});

	describe("isSessionInitEvent", () => {
		it("should return true for session_init events", () => {
			expect(isSessionInitEvent(sessionInitEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isSessionInitEvent(tokenEvent)).toBe(false);
			expect(isSessionInitEvent(resultEvent)).toBe(false);
		});
	});

	describe("isResultEvent", () => {
		it("should return true for result events", () => {
			expect(isResultEvent(resultEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isResultEvent(tokenEvent)).toBe(false);
			expect(isResultEvent(errorEvent)).toBe(false);
		});
	});

	describe("isErrorEvent", () => {
		it("should return true for error events", () => {
			expect(isErrorEvent(errorEvent)).toBe(true);
		});

		it("should return false for other events", () => {
			expect(isErrorEvent(tokenEvent)).toBe(false);
			expect(isErrorEvent(resultEvent)).toBe(false);
		});
	});

	describe("type discrimination", () => {
		it("should allow narrowing event types", () => {
			const events: AgentEvent[] = [
				tokenEvent,
				toolStartEvent,
				resultEvent,
				errorEvent,
			];

			const tokens = events.filter(isTokenEvent);
			expect(tokens.length).toBe(1);
			expect(tokens[0]?.content).toBe("Hello world");

			const toolStarts = events.filter(isToolStartEvent);
			expect(toolStarts.length).toBe(1);
			expect(toolStarts[0]?.tool).toBe("Read");
		});
	});
});
