import { describe, expect, test } from "bun:test";
import temp from "temp";
import {
	getSymbolInputSchema,
	getSymbolTool,
} from "@/backend/tools/typescript/get_symbol";
import { scaffoldTypescriptProject } from "./scaffold-project";

// Enable automatic cleanup of temp directories when the process exits
temp.track();

// =============================================================================
// Basic Success Tests
// =============================================================================

describe("get_symbol - basic success", () => {
	test("can get full source of UserService class", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Get the UserService class source",
				symbol: "UserService",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 1 definition(s)");
		expect(result.output).toContain("class UserService");
		// Should include methods
		expect(result.output).toContain("getUser");
		expect(result.output).toContain("authenticate");
		// Should include method-level JSDoc comments via getText()
		expect(result.output).toContain("Retrieves a user by their ID");
		expect(result.output).toContain("@param id");
	});

	test("can get full source of a function", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Get the FunctionSymbol source",
				symbol: "FunctionSymbol",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("function FunctionSymbol");
		expect(result.output).toContain('return "FunctionSymbol"');
	});

	test("can get full source of an interface", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Get the InterfaceSymbol source",
				symbol: "InterfaceSymbol",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("interface InterfaceSymbol");
		expect(result.output).toContain("name: string");
		expect(result.output).toContain("description: string");
	});
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe("get_symbol - error handling", () => {
	test("returns error for directory without TypeScript project", async () => {
		// Create a dedicated empty temp directory without tsconfig.json (auto-cleaned by temp.track())
		const emptyDir = temp.mkdirSync();

		const result = await getSymbolTool.execute(
			{
				reason: "Test no project error",
				symbol: "UserService",
			},
			{
				worktreePath: emptyDir,
				projectRoot: emptyDir,
			},
		);

		expect(result.success).toBe(false);
		expect(result.output).toContain("No TypeScript project found");
	});
});

// =============================================================================
// Symbol Not Found Tests
// =============================================================================

describe("get_symbol - symbol not found", () => {
	test("returns not found message for non-existent symbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Find non-existent symbol",
				symbol: "NonExistent",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("not found");
		expect(result.output).toContain("NonExistent");
	});

	test("returns not found for symbol with special characters", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Find symbol with special chars",
				symbol: "Symbol$Not#Found",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("not found");
	});
});

// =============================================================================
// Multiple Definitions Tests
// =============================================================================

describe("get_symbol - multiple definitions", () => {
	test("finds namespace and related symbols", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Find DuplicateName with multiple definitions",
				symbol: "DuplicateName",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("DuplicateName");
		// Should contain the namespace content
		expect(result.output).toContain("namespace");
	});

	test("can find symbols that appear in multiple contexts", async () => {
		const tempDir = scaffoldTypescriptProject();

		// getData appears in GenericClass
		const result = await getSymbolTool.execute(
			{
				reason: "Find getData method",
				symbol: "getData",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("getData");
		expect(result.output).toContain("return this.data");
	});
});

// =============================================================================
// Output Format Validation Tests
// =============================================================================

describe("get_symbol - output format validation", () => {
	test("output includes JSDoc comments via getText()", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Verify JSDoc is included in output",
				symbol: "UserService",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Method-level JSDoc should be included in getText() output
		expect(result.output).toContain("/**");
		expect(result.output).toContain("Retrieves a user by their ID");
		expect(result.output).toContain("@param id");
	});

	test("output includes complete implementation", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Verify complete implementation in output",
				symbol: "GenericClass",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Should have the full class with constructor and methods
		expect(result.output).toContain("class GenericClass<T>");
		expect(result.output).toContain("constructor(initialData: T)");
		expect(result.output).toContain("getData(): T");
		expect(result.output).toContain("setData(newData: T): void");
	});

	test("output contains file path and line number", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Verify output format with path and line",
				symbol: "ClassSymbol",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		// Output format is: ## path:line\nsource
		expect(result.output).toContain("src/symbols.ts:");
		expect(result.output).toMatch(/src\/symbols\.ts:\d+/);
	});

	test("output includes definition count", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await getSymbolTool.execute(
			{
				reason: "Verify definition count in output",
				symbol: "InterfaceSymbol",
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toMatch(/Found \d+ definition\(s\)/);
	});
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe("get_symbol - schema validation", () => {
	test("schema requires reason and symbol fields", () => {
		const validInput = {
			reason: "Test reason",
			symbol: "TestSymbol",
		};

		const result = getSymbolInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	test("schema rejects missing symbol", () => {
		const invalidInput = {
			reason: "Test reason",
		};

		const result = getSymbolInputSchema.safeParse(invalidInput);
		expect(result.success).toBe(false);
	});

	test("schema rejects missing reason", () => {
		const invalidInput = {
			symbol: "TestSymbol",
		};

		const result = getSymbolInputSchema.safeParse(invalidInput);
		expect(result.success).toBe(false);
	});
});
