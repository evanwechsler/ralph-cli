import {
	query,
	type Options,
	type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Data, Effect, Stream } from "effect";
import type {
	AgentEvent,
	AgentSessionId,
	ErrorEvent,
	ResultEvent,
	SessionInitEvent,
	TokenEvent,
	ToolEndEvent,
	ToolStartEvent,
	TurnCompleteEvent,
} from "./AgentEvent.js";

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export class AgentClientError extends Data.TaggedError("AgentClientError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ─────────────────────────────────────────────────────────────
// Query Options
// ─────────────────────────────────────────────────────────────

export type AgentQueryOptions = {
	readonly cwd: string;
	readonly model?: string;
	readonly maxTurns?: number;
	readonly maxBudgetUsd?: number;
	readonly includePartialMessages?: boolean;
	readonly systemPromptAppend?: string;
};

export type ResumeOptions = AgentQueryOptions & {
	readonly sessionId: string;
	readonly resumeSessionAt?: string;
};

// ─────────────────────────────────────────────────────────────
// SDK Message to Domain Event Mapping
// ─────────────────────────────────────────────────────────────

const mapSdkMessageToEvents = (msg: SDKMessage): AgentEvent[] => {
	const events: AgentEvent[] = [];

	switch (msg.type) {
		case "system": {
			if (msg.subtype === "init") {
				const initEvent: SessionInitEvent = {
					type: "session_init",
					sessionId: msg.session_id,
					model: msg.model,
					tools: msg.tools,
				};
				events.push(initEvent);
			}
			break;
		}

		case "stream_event": {
			// Partial message streaming (token-by-token)
			const event = msg.event;
			if (event.type === "content_block_delta") {
				const delta = event.delta;
				if (delta.type === "text_delta") {
					const tokenEvent: TokenEvent = {
						type: "token",
						content: delta.text,
					};
					events.push(tokenEvent);
				}
			}
			break;
		}

		case "assistant": {
			// Complete assistant message - extract tool uses
			for (const block of msg.message.content) {
				if (block.type === "tool_use") {
					const toolStartEvent: ToolStartEvent = {
						type: "tool_start",
						tool: block.name,
						toolUseId: block.id,
						input: block.input,
					};
					events.push(toolStartEvent);
				}
			}
			break;
		}

		case "user": {
			// User messages can contain tool results
			for (const block of msg.message.content) {
				if (block.type === "tool_result") {
					const toolEndEvent: ToolEndEvent = {
						type: "tool_end",
						tool: "unknown", // Tool name not available in result
						toolUseId: block.tool_use_id,
						result: block.content,
					};
					events.push(toolEndEvent);
				}
			}
			break;
		}

		case "result": {
			if (msg.subtype === "success") {
				const resultEvent: ResultEvent = {
					type: "result",
					success: true,
					result: msg.result,
					totalCostUsd: msg.total_cost_usd,
					durationMs: msg.duration_ms,
					numTurns: msg.num_turns,
				};
				events.push(resultEvent);

				// Also emit turn complete with final usage
				const turnCompleteEvent: TurnCompleteEvent = {
					type: "turn_complete",
					usage: {
						inputTokens: msg.usage.input_tokens,
						outputTokens: msg.usage.output_tokens,
						cacheReadInputTokens: msg.usage.cache_read_input_tokens ?? 0,
						cacheCreationInputTokens:
							msg.usage.cache_creation_input_tokens ?? 0,
					},
				};
				events.push(turnCompleteEvent);
			} else {
				// Error result
				const errorEvent: ErrorEvent = {
					type: "error",
					message: `Query failed: ${msg.subtype}`,
					errors: msg.errors,
				};
				events.push(errorEvent);
			}
			break;
		}
	}

	return events;
};

// ─────────────────────────────────────────────────────────────
// Helper: Convert AsyncGenerator to Effect Stream
// ─────────────────────────────────────────────────────────────

const asyncGeneratorToStream = <T, R>(
	gen: AsyncGenerator<T, R, unknown>,
): Stream.Stream<T, AgentClientError> =>
	Stream.async<T, AgentClientError>((emit) => {
		const iterate = async () => {
			try {
				for await (const value of gen) {
					emit.single(value);
				}
				emit.end();
			} catch (error) {
				emit.fail(
					new AgentClientError({
						message: "Stream iteration failed",
						cause: error,
					}),
				);
			}
		};
		iterate();
	});

// ─────────────────────────────────────────────────────────────
// Repository Service
// ─────────────────────────────────────────────────────────────

const makeAgentClient = Effect.gen(function* () {
	const buildSdkOptions = (options: AgentQueryOptions): Options => {
		const sdkOptions: Options = {
			cwd: options.cwd,
			includePartialMessages: options.includePartialMessages ?? true,
			tools: { type: "preset", preset: "claude_code" },
			systemPrompt: options.systemPromptAppend
				? {
						type: "preset",
						preset: "claude_code",
						append: options.systemPromptAppend,
					}
				: { type: "preset", preset: "claude_code" },
			settingSources: ["project"],
			permissionMode: "acceptEdits",
		};

		// Only add optional properties if they're defined
		if (options.model !== undefined) {
			sdkOptions.model = options.model;
		}
		if (options.maxTurns !== undefined) {
			sdkOptions.maxTurns = options.maxTurns;
		}
		if (options.maxBudgetUsd !== undefined) {
			sdkOptions.maxBudgetUsd = options.maxBudgetUsd;
		}

		return sdkOptions;
	};

	const runQuery = (
		prompt: string,
		options: AgentQueryOptions,
	): Stream.Stream<AgentEvent, AgentClientError> => {
		const sdkOptions = buildSdkOptions(options);
		const queryGen = query({ prompt, options: sdkOptions });

		return asyncGeneratorToStream(queryGen).pipe(
			Stream.flatMap((msg) => Stream.fromIterable(mapSdkMessageToEvents(msg))),
		);
	};

	const resumeSession = (
		sessionId: AgentSessionId,
		options: ResumeOptions,
	): Stream.Stream<AgentEvent, AgentClientError> => {
		const sdkOptions = buildSdkOptions(options);
		sdkOptions.resume = sessionId;
		if (options.resumeSessionAt !== undefined) {
			sdkOptions.resumeSessionAt = options.resumeSessionAt;
		}

		// Resume with an empty prompt since we're continuing an existing session
		const queryGen = query({ prompt: "", options: sdkOptions });

		return asyncGeneratorToStream(queryGen).pipe(
			Stream.flatMap((msg) => Stream.fromIterable(mapSdkMessageToEvents(msg))),
		);
	};

	const extractSessionId = (
		stream: Stream.Stream<AgentEvent, AgentClientError>,
	): Effect.Effect<
		{
			sessionId: AgentSessionId;
			events: Stream.Stream<AgentEvent, AgentClientError>;
		},
		AgentClientError
	> =>
		Effect.gen(function* () {
			let capturedSessionId: AgentSessionId | null = null;

			const processedStream = stream.pipe(
				Stream.tap((event) =>
					Effect.sync(() => {
						if (event.type === "session_init" && !capturedSessionId) {
							capturedSessionId = event.sessionId as AgentSessionId;
						}
					}),
				),
			);

			// We need to consume at least one event to get the session ID
			const firstChunk = yield* processedStream.pipe(
				Stream.take(1),
				Stream.runCollect,
			);

			if (!capturedSessionId) {
				return yield* Effect.fail(
					new AgentClientError({
						message: "Failed to extract session ID from stream",
					}),
				);
			}

			// Return the session ID and a new stream that includes all events
			return {
				sessionId: capturedSessionId,
				events: Stream.concat(
					Stream.fromIterable(firstChunk),
					stream.pipe(Stream.drop(1)),
				),
			};
		});

	return {
		runQuery,
		resumeSession,
		extractSessionId,
	};
});

export class AgentClient extends Effect.Service<AgentClient>()(
	"@ralph/AgentClient",
	{
		effect: makeAgentClient,
	},
) {}
