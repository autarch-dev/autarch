import * as path from "node:path";
import { SyntaxKind } from "ts-morph";
import { z } from "zod";
import { getTSProject } from "../pulsing/diagnostics";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const getSymbolInputSchema = z.object({
	reason: z.string(),
	symbol: z.string().describe("Name of the symbol to retrieve"),
});

export type GetSymbolInput = z.infer<typeof getSymbolInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================
export const getSymbolTool: ToolDefinition<GetSymbolInput> = {
	name: "get_symbol",
	description:
		"Get the full source code of a symbol definition. Returns complete implementation for functions, classes, interfaces, etc.",
	inputSchema: getSymbolInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		const project = await getTSProject(context);

		if (!project) {
			return {
				success: false,
				output: "Error: No TypeScript project found",
			};
		}

		const definitions: Array<{
			path: string;
			line: number;
			source: string;
		}> = [];

		// Search all source files
		for (const sourceFile of project.getSourceFiles()) {
			const filePath = sourceFile.getFilePath();

			// Skip node_modules
			if (filePath.includes("node_modules")) continue;

			// Find all identifiers matching the symbol name
			const identifiers = sourceFile
				.getDescendantsOfKind(SyntaxKind.Identifier)
				.filter((id) => id.getText() === input.symbol);

			for (const identifier of identifiers) {
				const defNodes = identifier.getDefinitionNodes();

				for (const def of defNodes) {
					const defFilePath = def.getSourceFile().getFilePath();

					// Skip definitions in node_modules
					if (defFilePath.includes("node_modules")) continue;

					const relPath = path.relative(
						context.worktreePath ?? context.projectRoot,
						defFilePath,
					);
					const line = def.getStartLineNumber();

					definitions.push({
						path: relPath,
						line,
						source: def.getText(),
					});
				}
			}
		}

		// Deduplicate by path+line combination
		const uniqueDefs = dedupeByLocation(definitions);

		if (uniqueDefs.length === 0) {
			return {
				success: true,
				output: `Symbol "${input.symbol}" not found`,
			};
		}

		// Format output
		return {
			success: true,
			output: formatOutput(uniqueDefs),
		};
	},
};

function dedupeByLocation<T extends { path: string; line: number }>(
	items: T[],
): T[] {
	const map = new Map<string, T>();
	for (const item of items) {
		const key = `${item.path}:${item.line}`;
		if (!map.has(key)) {
			map.set(key, item);
		}
	}
	return [...map.values()];
}

function formatOutput(
	definitions: Array<{ path: string; line: number; source: string }>,
): string {
	let out = `Found ${definitions.length} definition(s):\n`;

	for (const d of definitions) {
		out += `\n## ${d.path}:${d.line}\n${d.source}\n`;
	}

	return out;
}
