import { describe, expect, test } from "bun:test";
import temp from "temp";
import { listExportsTool } from "@/backend/tools/typescript/list_exports";
import { scaffoldTypescriptProject } from "./scaffold-project";

// Enable automatic cleanup of temp directories when the process exits
temp.track();

// =============================================================================
// Basic Success Test
// =============================================================================

describe("list_exports - basic success", () => {
	test("lists exports from TypeScript files matching pattern", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "List all exports from .ts files",
				pattern: "**/*.ts",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Check that known exports from symbols.ts are present
		expect(result.output).toContain("VariableSymbol");
		expect(result.output).toContain("FunctionSymbol");
		expect(result.output).toContain("ClassSymbol");
		expect(result.output).toContain("InterfaceSymbol");
		expect(result.output).toContain("TypeSymbol");
	});
});

// =============================================================================
// No TypeScript Project Error Test
// =============================================================================

describe("list_exports - no TypeScript project error", () => {
	test("returns error when no TypeScript project exists", async () => {
		// Create a temp directory without a tsconfig.json (auto-cleaned by temp.track())
		const emptyTempDir = temp.mkdirSync();

		const result = await listExportsTool.execute(
			{
				reason: "Try to list exports from directory without tsconfig",
				pattern: "**/*.ts",
			},
			{
				worktreePath: emptyTempDir,
				projectRoot: emptyTempDir,
			},
		);

		expect(result.success).toBe(false);
		expect(result.output).toContain("Error: No TypeScript project found");
	});
});

// =============================================================================
// Malformed Glob Pattern Test
// =============================================================================

describe("list_exports - malformed glob pattern", () => {
	test("malformed pattern that matches nothing returns zero exports", async () => {
		const tempDir = scaffoldTypescriptProject();

		// Note: Bun's Glob is permissive and doesn't throw for malformed patterns
		// like "[invalid", but they simply won't match any files
		const result = await listExportsTool.execute(
			{
				reason: "Test malformed glob pattern",
				pattern: "[invalid",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		// Pattern is accepted but matches nothing
		expect(result.success).toBe(true);
		expect(result.output).toContain("0 export(s)");
	});
});

// =============================================================================
// No Matches Found Test
// =============================================================================

describe("list_exports - no matches found", () => {
	test("reports zero exports for pattern with no matches", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "Test pattern that matches no files",
				pattern: "**/*.xyz",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("0 export(s)");
		expect(result.output).toContain("0 file(s)");
	});
});

// =============================================================================
// Output Format Validation Test
// =============================================================================

describe("list_exports - output format validation", () => {
	test("output contains correct path format", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "Validate output path format",
				pattern: "**/*.ts",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Path should be relative, e.g., src/symbols.ts:line
		expect(result.output).toMatch(/src\/symbols\.ts:\d+/);
	});

	test("output contains type detection in brackets", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "Validate type detection format",
				pattern: "**/*.ts",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Type should be in brackets
		expect(result.output).toContain("[function]");
		expect(result.output).toContain("[class]");
		expect(result.output).toContain("[interface]");
		expect(result.output).toContain("[type]");
		expect(result.output).toContain("[variable]");
	});

	test("output contains signature preview", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "Validate signature preview",
				pattern: "**/*.ts",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Function should have signature preview with 'function' keyword
		expect(result.output).toContain("function FunctionSymbol");
	});

	test("output header contains file and export counts", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await listExportsTool.execute(
			{
				reason: "Validate header format",
				pattern: "**/*.ts",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Header format: Found N export(s) in M file(s):
		expect(result.output).toMatch(/Found \d+ export\(s\) in \d+ file\(s\):/);
	});
});
