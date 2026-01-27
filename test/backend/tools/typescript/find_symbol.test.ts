import { expect, test } from "bun:test";
import { findSymbolTool } from "@/backend/tools/typescript/find_symbol";
import { scaffoldTypescriptProject } from "./scaffold-project";

test("can find a class when using 'class' type in the current project", async () => {
	// Arrange
	const tempDir = scaffoldTypescriptProject();

	// Act
	const result = await findSymbolTool.execute(
		{
			reason: "Find the symbol 'ClassSymbol'",
			symbol: "ClassSymbol",
			type: "class",
			includeReferences: false,
		},
		{
			worktreePath: tempDir,
			projectRoot: tempDir,
		},
	);

	// Assert
	expect(result.success).toBe(true);
	expect(result.output).toContain("ClassSymbol");
});

test("can find a class when using 'all' type in the current project", async () => {
	// Arrange
	const tempDir = scaffoldTypescriptProject();

	// Act
	const result = await findSymbolTool.execute(
		{
			reason: "Find the symbol 'ClassSymbol'",
			symbol: "ClassSymbol",
			type: "all",
			includeReferences: false,
		},
		{
			worktreePath: tempDir,
			projectRoot: tempDir,
		},
	);

	// Assert
	expect(result.success).toBe(true);
	expect(result.output).toContain("ClassSymbol");
});