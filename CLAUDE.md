# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CLI application built with OpenTUI (React for terminal interfaces) using Bun as the runtime and Effect for functional programming. The CLI provides tools to easily manage and run **Ralph agent loops**.

### What is Ralph?

Ralph is a technique for automating software development using AI coding agents in a continuous loop. In its simplest form: `while :; do cat PROMPT.md | claude-code ; done`. The system repeatedly feeds a prompt file to an AI coding tool, allowing iterative building and refinement of code.

Key concepts:
- **Agent Loops**: Continuous execution of AI coding agents against prompt files
- **Sprints**: Focused development cycles with defined goals and acceptance criteria
- **PRD Plans**: Product Requirement Documents that define what the agent should build
- **Iterative Refinement**: When errors occur, prompts are refined to improve output

### CLI Features

This CLI will support:
- **PRD Mode**: Create and manage PRD plans for development sprints
- **Sprint Mode**: Execute Ralph agent loops against defined sprints
- **Agent Management**: Configure and monitor running agent loops

## Development Commands

- `bun install` - Install dependencies
- `bun dev` - Run development server with file watching
- `bun test` - Run unit tests with Vitest
- `bun run lint` - Run Biome linter with auto-fix
- `bun run format` - Format code with Biome
- `bun run check` - Run comprehensive Biome checks (lint + format)
- `bun run typecheck` - Run TypeScript type checking

## Architecture

### Core Technologies
- **Runtime**: Bun (not Node.js)
- **UI Framework**: OpenTUI (`@opentui/core` and `@opentui/react`) - React-like components for terminal interfaces
- **Functional Programming**: Effect for composable, type-safe async programming
- **Schema & Validation**: Effect Schema with branded types for type-safe data modeling
- **Testing**: Vitest for unit and integration tests
- **Language**: TypeScript with strict configuration
- **Linting/Formatting**: Biome (replaces ESLint + Prettier)

### Project Structure
- `src/index.tsx` - Main application entry point with OpenTUI React components
- Single-file application using OpenTUI's `<box>`, `<ascii-font>`, and `<text>` components
- Uses `createCliRenderer()` and `createRoot()` for terminal rendering

### Key Configuration
- **TypeScript**: Strict mode enabled, ESNext target, bundler resolution, Effect Language Service plugin
- **JSX**: Uses `@opentui/react` as JSX import source (not standard React)
- **Biome**: Tab indentation, double quotes, organize imports enabled
- **Module System**: ESM with `"type": "module"` in package.json

<!-- effect-solutions:start -->
## Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.
<!-- effect-solutions:end -->

## Coding Guidelines

### Effect Usage
- **Effect everywhere**: All business logic must be written using Effect. Only use `Effect.runPromise`, `Effect.runSync`, or other run methods at program edges (entry points, event handlers)
- **No raw Promises**: Prefer Effect over native Promises for async operations
- **Composable pipelines**: Use `pipe`, `Effect.gen`, and Effect combinators for clean, readable code

### Branded Types with Effect Schema
- **Use branded types**: Define branded types for domain concepts (e.g., `SprintId`, `AgentId`, `FilePath`)
- **Schema validation**: Use Effect Schema for all data validation and parsing
- **Type safety at boundaries**: Validate external data (user input, file content, API responses) using schemas

```typescript
// Example branded type
import { Schema } from "effect"

const SprintId = Schema.String.pipe(Schema.brand("SprintId"))
type SprintId = typeof SprintId.Type
```

### Testing
- **Comprehensive tests**: Write unit tests for all business logic using Vitest
- **Test Effect code**: Use `Effect.runPromise` in tests or Effect's testing utilities
- **Run tests often**: Execute `bun test` frequently during development to catch regressions

### Development Workflow
1. **Lint often**: Run `bun run lint` to catch issues early
2. **Type check**: Run `bun run typecheck` to ensure type safety
3. **Test**: Run `bun test` to verify functionality
4. **Format**: Run `bun run format` after implementing features to normalize code
5. **Commit**: Write meaningful commit messages that describe the change and its purpose

### Commit Messages
- Use conventional commit format when appropriate (feat:, fix:, refactor:, test:, docs:)
- Describe what changed and why
- Reference related issues or features when relevant

## Development Notes

- This is a terminal UI application, not a web application
- Uses OpenTUI components instead of standard HTML/DOM elements
- JSX components render to terminal, not browser
- File watching is available via `bun dev` for rapid development
- Effect Language Service provides compile-time diagnostics for Effect code

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
