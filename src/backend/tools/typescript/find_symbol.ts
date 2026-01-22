import * as path from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

type Def = { path: string; line: number; kind: string; signature: string };
type Ref = { path: string; line: number; context: string };

// =============================================================================
// Schema
// =============================================================================

export const findSymbolInputSchema = z.object({
	reason: z.string(),
	symbol: z.string().describe("Name of the symbol to find"),
	type: z
		.enum(["function", "class", "interface", "type", "variable", "all"])
		.optional()
		.default("all")
		.describe("Filter by symbol type"),
	includeReferences: z
		.boolean()
		.optional()
		.default(false)
		.describe("Also find all usages of the symbol"),
});

export type FindSymbolInput = z.infer<typeof findSymbolInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================
export const findSymbolTool: ToolDefinition<FindSymbolInput> = {
	name: "find_symbol",
	description: "Find a symbol in the project. Use this over `read_file` and `grep` when possible.",
	inputSchema: findSymbolInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		const project = context.project;

		if (!project) {
			return {
				success: false,
				output: "Error: No TypeScript project found",
			};
		}

		const definitions: Array<{
			path: string;
			line: number;
			kind: string;
			signature: string;
		}> = [];

		const references: Array<{
			path: string;
			line: number;
			context: string; // surrounding line of code
		}> = [];

		// Search all source files
		for (const sourceFile of project.getSourceFiles()) {
			// Skip node_modules, dist, etc.
			if (sourceFile.getFilePath().includes("node_modules")) continue;

			// Find all identifiers matching the symbol name
			const identifiers = sourceFile
				.getDescendantsOfKind(SyntaxKind.Identifier)
				.filter((id) => id.getText() === input.symbol);

			for (const identifier of identifiers) {
				const defNodes = identifier.getDefinitionNodes();

				for (const def of defNodes) {
					// Filter by type if specified
					if (input.type !== "all" && !matchesType(def, input.type)) continue;

					const filePath = path.relative(
						context.worktreePath ?? context.projectRoot,
						def.getSourceFile().getFilePath(),
					);
					const line = def.getStartLineNumber();

					definitions.push({
						path: filePath,
						line,
						kind: def.getKindName(),
						signature: getSignature(def), // extract just the signature, not body
					});
				}

				// Collect references if requested
				if (input.includeReferences) {
					const refs = identifier.findReferencesAsNodes();
					for (const ref of refs) {
						const filePath = path.relative(
							context.worktreePath ?? context.projectRoot,
							ref.getSourceFile().getFilePath(),
						);
						references.push({
							path: filePath,
							line: ref.getStartLineNumber(),
							context:
								ref.getParent()?.getText().slice(0, 100) || ref.getText(),
						});
					}
				}
			}
		}

		// Dedupe definitions (same symbol found multiple ways)
		const uniqueDefs = dedupeByLocation(definitions);
		const uniqueRefs = dedupeByLocation(references);

		// Format output
		return {
			success: true,
			output: formatOutput(uniqueDefs, uniqueRefs),
		};
	},
};

// Helper: get signature without implementation body
function getSignature(node: Node): string {
	if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
		// Return just: "function name(params): returnType"
		const name = node.getName() || "anonymous";
		const params = node
			.getParameters()
			.map((p) => p.getText())
			.join(", ");
		const returnType = node.getReturnType().getText();
		return `function ${name}(${params}): ${returnType}`;
	}
	if (Node.isClassDeclaration(node)) {
		return `class ${node.getName()}`;
	}
	if (Node.isInterfaceDeclaration(node)) {
		return `interface ${node.getName()}`;
	}
	if (Node.isTypeAliasDeclaration(node)) {
		return node.getText().slice(0, 150); // type aliases are usually short
	}
	if (Node.isVariableDeclaration(node)) {
		const name = node.getName();
		const type = node.getType().getText();
		return `${name}: ${type}`;
	}
	return node.getText().slice(0, 100);
}

// Helper: filter by symbol type
function matchesType(node: Node, type: string): boolean {
	switch (type) {
		case "function":
			return (
				Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node)
			);
		case "class":
			return Node.isClassDeclaration(node);
		case "interface":
			return Node.isInterfaceDeclaration(node);
		case "type":
			return Node.isTypeAliasDeclaration(node);
		case "variable":
			return Node.isVariableDeclaration(node);
		default:
			return true;
	}
}

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

// Output format - compact!
function formatOutput(definitions: Def[], references: Ref[]): string {
	let out = `Found ${definitions.length} definition(s):\n`;
	for (const d of definitions) {
		out += `${d.path}:${d.line} [${d.kind}] ${d.signature}\n`;
	}

	if (references.length > 0) {
		out += `\n${references.length} reference(s):\n`;
		for (const r of references) {
			out += `${r.path}:${r.line}: ${r.context}\n`;
		}
	}

	return out;
}
