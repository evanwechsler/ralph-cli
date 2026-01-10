import { Layer } from "effect";
import { LiveDatabaseLayer, TestDatabaseLayer } from "../db/client.js";
import { EpicRepository } from "./EpicRepository.js";
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

// ─────────────────────────────────────────────────────────────
// Composite Layers
// ─────────────────────────────────────────────────────────────

// Combine all repository layers
const RepositoryLayers = Layer.mergeAll(
	EpicRepository.Default,
	TaskRepository.Default,
);

// Production layer: Database + Repositories
export const LiveServicesLayer = Layer.provideMerge(
	RepositoryLayers,
	LiveDatabaseLayer,
);

// Test layer: In-memory database + Repositories
export const TestServicesLayer = Layer.provideMerge(
	RepositoryLayers,
	TestDatabaseLayer,
);
