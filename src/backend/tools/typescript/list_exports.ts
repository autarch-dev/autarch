import * as path from "node:path";
import { Glob } from "bun";
import { Node } from "ts-morph";
import { z } from "zod";
import { getTSProject } from "../pulsing/diagnostics";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const listExportsInputSchema = z.object({
	reason: z.string(),
	pattern: z.string().describe("Glob pattern to match filenames, e.g. *.ts"),
});

export type ListExportsInput = z.infer<typeof listExportsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const listExportsTool: ToolDefinition<ListExportsInput> = {
	name: "list_exports",
	description:
		"List all exports from TypeScript files matching a filename glob pattern.",
	inputSchema: listExportsInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		const project = await getTSProject(context);

		if (!project) {
			return {
				success: false,
				output: "Error: No TypeScript project found",
			};
		}

		// Create glob matcher with try/catch for invalid patterns
		let glob: InstanceType<typeof Glob>;
		try {
			glob = new Glob(input.pattern);
		} catch (error) {
			return {
				success: false,
				output: `Error: Invalid glob pattern: ${error instanceof Error ? error.message : String(error)}`,
			};
		}

		const exports: Array<{
			path: string;
			line: number;
			type: string;
			name: string;
			signature: string;
		}> = [];

		let matchedFileCount = 0;

		// Search all source files
		for (const sourceFile of project.getSourceFiles()) {
			const filePath = sourceFile.getFilePath();

			// Skip node_modules
			if (filePath.includes("node_modules")) continue;

			// Match against basename only
			const basename = path.basename(filePath);
			if (!glob.match(basename)) continue;

			matchedFileCount++;

			// Get all exported declarations
			const exportedDeclarations = sourceFile.getExportedDeclarations();

			// Iterate each [name, declarations] entry
			for (const [name, declarations] of exportedDeclarations) {
				for (const declaration of declarations) {
					const type = getDeclarationType(declaration);
					const signature = getSignature(declaration, type);
					const relativePath = path.relative(
						context.worktreePath ?? context.projectRoot,
						filePath,
					);
					const line = declaration.getStartLineNumber();

					exports.push({
						path: relativePath,
						line,
						type,
						name,
						signature,
					});
				}
			}
		}

		// Format output
		return {
			success: true,
			output: formatOutput(exports, matchedFileCount),
		};
	},
};

// Helper: detect declaration type
function getDeclarationType(node: Node): string {
	if (Node.isFunctionDeclaration(node)) return "function";
	if (Node.isClassDeclaration(node)) return "class";
	if (Node.isInterfaceDeclaration(node)) return "interface";
	if (Node.isTypeAliasDeclaration(node)) return "type";
	if (Node.isVariableDeclaration(node)) return "variable";
	return node.getKindName();
}

// Helper: get signature based on type
function getSignature(node: Node, type: string): string {
	if (type === "function" && Node.isFunctionDeclaration(node)) {
		// Return first line of getText()
		const text = node.getText();
		const firstLine = text.split("\n")[0] ?? "";
		return firstLine;
	}
	if (type === "class" && Node.isClassDeclaration(node)) {
		// Return name only
		return node.getName() || "anonymous";
	}
	if (type === "interface" && Node.isInterfaceDeclaration(node)) {
		// Return name only
		return node.getName() || "anonymous";
	}
	if (type === "type" && Node.isTypeAliasDeclaration(node)) {
		// Return full declaration up to 150 chars
		return node.getText().slice(0, 150);
	}
	if (type === "variable" && Node.isVariableDeclaration(node)) {
		// Return full declaration up to 150 chars
		return node.getText().slice(0, 150);
	}
	// Fallback: full declaration up to 150 chars
	return node.getText().slice(0, 150);
}

// Output format
function formatOutput(
	exports: Array<{
		path: string;
		line: number;
		type: string;
		name: string;
		signature: string;
	}>,
	fileCount: number,
): string {
	let out = `Found ${exports.length} export(s) in ${fileCount} file(s):\n`;
	for (const e of exports) {
		out += `${e.path}:${e.line} [${e.type}] ${e.name} - ${e.signature}\n`;
	}
	return out;
}
