/**
 * Utility functions for parsing spec content
 */

/**
 * Extract title from spec content.
 * Looks for <name> tag first, then falls back to first non-empty line.
 */
export function extractTitleFromSpec(specContent: string): string {
	// Try to extract from <name> tag
	const nameMatch = specContent.match(/<name>\s*([^<]+)\s*<\/name>/i);
	if (nameMatch?.[1]) {
		return nameMatch[1].trim();
	}

	// Fall back to first non-empty line
	const lines = specContent.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		// Skip XML declaration, comments, specification tag, and empty lines
		if (
			trimmed &&
			!trimmed.startsWith("<?") &&
			!trimmed.startsWith("<!--") &&
			!trimmed.startsWith("<specification") &&
			!trimmed.startsWith("```")
		) {
			// Remove any markdown headers or XML tags
			return trimmed
				.replace(/^#+\s*/, "")
				.replace(/<[^>]+>/g, "")
				.trim();
		}
	}

	return "Untitled Epic";
}
