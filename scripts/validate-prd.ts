#!/usr/bin/env bun
/**
 * Validates the schema of a prd.json file.
 * Usage: bun scripts/validate-prd.ts <path-to-prd.json>
 */

import { Either, ParseResult, Schema } from "effect";

// Task categories
const TaskCategory = Schema.Literal(
	"functional",
	"style",
	"integration",
	"infrastructure",
	"testing",
);

// Individual task schema
const Task = Schema.Struct({
	category: TaskCategory,
	description: Schema.String.pipe(
		Schema.minLength(1, {
			message: () => "Description cannot be empty",
		}),
	),
	steps: Schema.Array(
		Schema.String.pipe(
			Schema.minLength(1, {
				message: () => "Step cannot be empty",
			}),
		),
	).pipe(
		Schema.minItems(1, {
			message: () => "Tasks must have at least one verification step",
		}),
	),
	passes: Schema.Boolean,
});

// Full PRD schema
const Prd = Schema.Array(Task).pipe(
	Schema.minItems(1, {
		message: () => "PRD cannot be empty",
	}),
);

type Prd = typeof Prd.Type;

function formatValidationError(error: ParseResult.ParseError): string {
	// Use ArrayFormatter for a flat list of all issues with paths
	const issues = ParseResult.ArrayFormatter.formatErrorSync(error);

	// Group issues by path to consolidate union type errors
	const byPath = new Map<string, string[]>();

	for (const issue of issues) {
		const path = issue.path.length > 0 ? `[${issue.path.join(".")}]` : "[root]";
		if (!byPath.has(path)) {
			byPath.set(path, []);
		}
		byPath.get(path)?.push(issue.message);
	}

	const lines: string[] = [];
	for (const [path, messages] of byPath) {
		// Check if these are union literal errors (all start with "Expected ")
		const literalPattern = /^Expected "([^"]+)", actual "([^"]+)"$/;
		const literals = messages
			.map((m) => literalPattern.exec(m))
			.filter((m): m is RegExpExecArray => m !== null);

		const firstLiteral = literals[0];
		if (
			literals.length === messages.length &&
			literals.length > 1 &&
			firstLiteral
		) {
			// Consolidate union errors
			const validOptions = literals.map((m) => `"${m[1]}"`).join(" | ");
			const actual = firstLiteral[2];
			lines.push(
				`  ${path}: Invalid value "${actual}". Expected: ${validOptions}`,
			);
		} else {
			// Show individual messages
			for (const msg of messages) {
				lines.push(`  ${path}: ${msg}`);
			}
		}
	}

	return lines.length > 0 ? lines.join("\n") : "  Unknown validation error";
}

function printStats(prd: Prd): void {
	const stats = {
		functional: 0,
		style: 0,
		integration: 0,
		infrastructure: 0,
		testing: 0,
	};

	let totalSteps = 0;
	let passingCount = 0;

	for (const task of prd) {
		stats[task.category]++;
		totalSteps += task.steps.length;
		if (task.passes) passingCount++;
	}

	console.log("\n--- Statistics ---");
	console.log(`Total tasks: ${prd.length}`);
	console.log(`Passing: ${passingCount}/${prd.length}`);
	console.log(
		`Average steps per task: ${(totalSteps / prd.length).toFixed(1)}`,
	);
	console.log("\nBy category:");
	for (const [category, count] of Object.entries(stats)) {
		if (count > 0) {
			console.log(`  ${category}: ${count}`);
		}
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("ERROR: No file path provided");
		console.error("Usage: bun scripts/validate-prd.ts <path-to-prd.json>");
		process.exit(1);
	}

	const filePath = args[0] as string; // Already checked args.length > 0
	const file = Bun.file(filePath);

	if (!(await file.exists())) {
		console.error(`ERROR: File not found: ${filePath}`);
		process.exit(1);
	}

	let content: unknown;
	try {
		content = await file.json();
	} catch {
		console.error(`ERROR: Failed to parse JSON in ${filePath}`);
		console.error("Ensure the file contains valid JSON.");
		process.exit(1);
	}

	const decode = Schema.decodeUnknownEither(Prd);
	const result = decode(content);

	if (Either.isLeft(result)) {
		console.error("VALIDATION FAILED");
		console.error("\nSchema errors found:");
		console.error(formatValidationError(result.left));
		console.error("\nExpected format:");
		console.error(`[
  {
    "category": "functional" | "style" | "integration" | "infrastructure" | "testing",
    "description": "Non-empty string describing the task",
    "steps": ["At least one verification step"],
    "passes": false
  }
]`);
		process.exit(1);
	}

	const prd = result.right;

	// Additional warnings (non-fatal)
	const warnings: string[] = [];

	for (const [i, task] of prd.entries()) {
		// Warn if task is already passing (unusual for newly generated list)
		if (task.passes) {
			warnings.push(
				`Task ${i}: Already marked as passing - verify this is intentional`,
			);
		}

		// Warn if description is very short
		if (task.description.length < 20) {
			warnings.push(
				`Task ${i}: Description seems too short (${task.description.length} chars)`,
			);
		}

		// Warn if only one step
		if (task.steps.length === 1) {
			warnings.push(
				`Task ${i}: Only has one verification step - consider adding more detail`,
			);
		}
	}

	if (warnings.length > 0) {
		console.log("WARNINGS:");
		for (const warning of warnings) {
			console.log(`  - ${warning}`);
		}
		console.log("");
	}

	console.log("VALIDATION PASSED");
	printStats(prd);
}

main();
