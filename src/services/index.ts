import { Layer } from "effect";
import { LiveDatabaseLayer, TestDatabaseLayer } from "../db/client.js";
import { AgentClient } from "./AgentClient.js";
import { AgentSessionRepository } from "./AgentSessionRepository.js";
import { EpicDraftRepository } from "./EpicDraftRepository.js";
import { EpicRepository } from "./EpicRepository.js";
import { ExternalEditor } from "./ExternalEditor.js";
import { TaskRepository } from "./TaskRepository.js";

// ─────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────

export {
	EpicRepository,
	EpicId,
	CreateEpicInput,
	UpdateEpicInput,
} from "./EpicRepository.js";

export {
	TaskRepository,
	TaskId,
	CreateTaskInput,
	UpdateTaskInput,
} from "./TaskRepository.js";

export {
	AgentSessionRepository,
	CreateAgentSessionInput,
	UpdateAgentSessionInput,
} from "./AgentSessionRepository.js";

export { EpicDraftRepository, EpicDraftState } from "./EpicDraftRepository.js";

export {
	AgentClient,
	AgentClientError,
	type AgentQueryOptions,
	type ResumeOptions,
} from "./AgentClient.js";

export { ExternalEditor, ExternalEditorError } from "./ExternalEditor.js";

export {
	AgentSessionId,
	type AgentEvent,
	type TokenEvent,
	type ToolStartEvent,
	type ToolEndEvent,
	type TurnCompleteEvent,
	type SessionInitEvent,
	type ResultEvent,
	type ErrorEvent,
	isTokenEvent,
	isToolStartEvent,
	isToolEndEvent,
	isTurnCompleteEvent,
	isSessionInitEvent,
	isResultEvent,
	isErrorEvent,
} from "./AgentEvent.js";

// ─────────────────────────────────────────────────────────────
// Composite Layers
// ─────────────────────────────────────────────────────────────

// Combine all repository layers (database-backed)
const RepositoryLayers = Layer.mergeAll(
	EpicRepository.Default,
	TaskRepository.Default,
	AgentSessionRepository.Default,
	EpicDraftRepository.Default,
);

// Non-database services (no dependencies)
const ServiceLayers = Layer.mergeAll(
	AgentClient.Default,
	ExternalEditor.Default,
);

// Production layer: Database + Repositories + Services
export const LiveServicesLayer = Layer.merge(
	ServiceLayers,
	Layer.provideMerge(RepositoryLayers, LiveDatabaseLayer),
);

// Test layer: In-memory database + Repositories + Services
export const TestServicesLayer = Layer.merge(
	ServiceLayers,
	Layer.provideMerge(RepositoryLayers, TestDatabaseLayer),
);
