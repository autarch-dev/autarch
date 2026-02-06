import { describe, expect, test } from "bun:test";
import { findSymbolTool } from "../find_symbol";
import { scaffoldTypescriptProject } from ".";

// =============================================================================
// Class Symbol Tests
// =============================================================================

describe("find_symbol - class symbols", () => {
	test("can find a class when using 'class' type", async () => {
		const tempDir = scaffoldTypescriptProject();

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
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("ClassSymbol");
		expect(result.output).toContain("ClassDeclaration");
		expect(result.output).toContain("class ClassSymbol");
	});

	test("can find a class when using 'all' type", async () => {
		const tempDir = scaffoldTypescriptProject();

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
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("ClassSymbol");
	});

	test("can find a generic class", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the generic class",
				symbol: "GenericClass",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("GenericClass");
		expect(result.output).toContain("ClassDeclaration");
	});
});

// =============================================================================
// Function Symbol Tests
// =============================================================================

describe("find_symbol - function symbols", () => {
	test("can find a function when using 'function' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the FunctionSymbol",
				symbol: "FunctionSymbol",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("FunctionSymbol");
		expect(result.output).toContain("FunctionDeclaration");
	});

	test("can find a function when using 'all' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the FunctionSymbol",
				symbol: "FunctionSymbol",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("FunctionSymbol");
	});

	test("can find overloaded function", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the overloaded function",
				symbol: "overloadedFunction",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("overloadedFunction");
		expect(result.output).toContain("FunctionDeclaration");
	});
});

// =============================================================================
// Interface Symbol Tests
// =============================================================================

describe("find_symbol - interface symbols", () => {
	test("can find an interface when using 'interface' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the InterfaceSymbol",
				symbol: "InterfaceSymbol",
				type: "interface",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("InterfaceSymbol");
		expect(result.output).toContain("InterfaceDeclaration");
		expect(result.output).toContain("interface InterfaceSymbol");
	});

	test("can find an interface when using 'all' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the InterfaceSymbol",
				symbol: "InterfaceSymbol",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("InterfaceSymbol");
	});

	test("can find a generic interface", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the generic interface",
				symbol: "GenericInterface",
				type: "interface",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("GenericInterface");
		expect(result.output).toContain("InterfaceDeclaration");
	});
});

// =============================================================================
// Type Alias Symbol Tests
// =============================================================================

describe("find_symbol - type alias symbols", () => {
	test("can find a type alias when using 'type' filter", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the TypeSymbol",
				symbol: "TypeSymbol",
				type: "type",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("TypeSymbol");
		expect(result.output).toContain("TypeAliasDeclaration");
	});

	test("can find a type alias when using 'all' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the TypeSymbol",
				symbol: "TypeSymbol",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("TypeSymbol");
	});

	test("can find a generic type alias", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the generic type",
				symbol: "GenericType",
				type: "type",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("GenericType");
		expect(result.output).toContain("TypeAliasDeclaration");
	});
});

// =============================================================================
// Variable Symbol Tests
// =============================================================================

describe("find_symbol - variable symbols", () => {
	test("can find a variable when using 'variable' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the VariableSymbol",
				symbol: "VariableSymbol",
				type: "variable",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("VariableSymbol");
		expect(result.output).toContain("VariableDeclaration");
	});

	test("can find a variable when using 'all' type", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the VariableSymbol",
				symbol: "VariableSymbol",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("VariableSymbol");
	});

	test("can find a number variable", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the number variable",
				symbol: "numberVariable",
				type: "variable",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("numberVariable");
		expect(result.output).toContain("VariableDeclaration");
	});

	test("can find an array variable", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find the array variable",
				symbol: "arrayVariable",
				type: "variable",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("arrayVariable");
		expect(result.output).toContain("VariableDeclaration");
	});
});

// =============================================================================
// Type Filter Mismatch Tests
// =============================================================================

describe("find_symbol - type filter mismatches", () => {
	test("does not find function when filtering by 'class'", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for FunctionSymbol with class filter",
				symbol: "FunctionSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("does not find class when filtering by 'function'", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for ClassSymbol with function filter",
				symbol: "ClassSymbol",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("does not find interface when filtering by 'type'", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for InterfaceSymbol with type filter",
				symbol: "InterfaceSymbol",
				type: "type",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("does not find type alias when filtering by 'interface'", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for TypeSymbol with interface filter",
				symbol: "TypeSymbol",
				type: "interface",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("does not find variable when filtering by 'class'", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for VariableSymbol with class filter",
				symbol: "VariableSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});
});

// =============================================================================
// includeReferences Flag Tests
// =============================================================================

describe("find_symbol - includeReferences flag", () => {
	test("includes references when includeReferences is true", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find InterfaceSymbol with references",
				symbol: "InterfaceSymbol",
				type: "interface",
				includeReferences: true,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("InterfaceSymbol");
		expect(result.output).toContain("reference(s)");
	});

	test("does not include references when includeReferences is false", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find InterfaceSymbol without references",
				symbol: "InterfaceSymbol",
				type: "interface",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("InterfaceSymbol");
		expect(result.output).not.toContain("reference(s)");
	});

	test("finds references to ClassSymbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find ClassSymbol with references",
				symbol: "ClassSymbol",
				type: "class",
				includeReferences: true,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("ClassSymbol");
		// The createClassSymbol function references ClassSymbol
		expect(result.output).toContain("reference(s)");
	});

	test("finds references to FunctionSymbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find FunctionSymbol with references",
				symbol: "FunctionSymbol",
				type: "function",
				includeReferences: true,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("FunctionSymbol");
		// The callsFunctionSymbol function references FunctionSymbol
		expect(result.output).toContain("reference(s)");
	});

	test("finds references to TypeSymbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find TypeSymbol with references",
				symbol: "TypeSymbol",
				type: "type",
				includeReferences: true,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("TypeSymbol");
		// The usesTypeSymbol function references TypeSymbol
		expect(result.output).toContain("reference(s)");
	});
});

// =============================================================================
// Non-Existent Symbol Tests
// =============================================================================

describe("find_symbol - non-existent symbols", () => {
	test("returns zero definitions for non-existent symbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for non-existent symbol",
				symbol: "NonExistentSymbol",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("returns zero definitions for non-existent function", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for non-existent function",
				symbol: "nonExistentFunction",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("find_symbol - edge cases", () => {
	test("handles empty symbol name", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for empty symbol name",
				symbol: "",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});

	test("handles symbol name with special characters not found", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Search for symbol with special characters",
				symbol: "Symbol$With#Special",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});
});

// =============================================================================
// Output Format Verification Tests
// =============================================================================

describe("find_symbol - output format verification", () => {
	test("output contains file path for found symbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify output contains file path",
				symbol: "ClassSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("src/symbols.ts");
	});

	test("output contains line number for found symbol", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify output contains line number",
				symbol: "ClassSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		// Output format is: path:line [kind] signature
		expect(result.output).toMatch(/src\/symbols\.ts:\d+/);
	});

	test("output contains symbol kind in brackets", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify output contains symbol kind",
				symbol: "ClassSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("[ClassDeclaration]");
	});

	test("output contains function signature for functions", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify function signature in output",
				symbol: "FunctionSymbol",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("function FunctionSymbol");
	});

	test("output contains definition count", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify definition count in output",
				symbol: "ClassSymbol",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toMatch(/Found \d+ definition\(s\)/);
	});
});

// =============================================================================
// Class Method Tests
// =============================================================================

describe("find_symbol - class methods", () => {
	test("can find a class method", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find classMethod in ClassSymbol",
				symbol: "classMethod",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("classMethod");
	});

	test("can find a static class method", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find staticMethod in ClassSymbol",
				symbol: "staticMethod",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("staticMethod");
	});

	test("can find getData method in GenericClass", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find getData method",
				symbol: "getData",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("getData");
	});

	test("class methods are NOT found when filtering by 'function' type", async () => {
		// This test documents intentional behavior: the 'function' type filter
		// only matches FunctionDeclaration and FunctionExpression, not MethodDeclaration.
		// Class methods should be found using 'all' type instead.
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Verify class method is not found with function filter",
				symbol: "classMethod",
				type: "function",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("Found 0 definition(s)");
	});
});

// =============================================================================
// Multiple Definitions Tests
// =============================================================================

describe("find_symbol - multiple definitions", () => {
	test("finds namespace with DuplicateName", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find DuplicateName namespace",
				symbol: "DuplicateName",
				type: "all",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("DuplicateName");
	});

	test("finds DuplicateInterface", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find DuplicateInterface",
				symbol: "DuplicateInterface",
				type: "interface",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("DuplicateInterface");
		expect(result.output).toContain("InterfaceDeclaration");
	});

	test("finds DuplicateClass that implements DuplicateInterface", async () => {
		const tempDir = scaffoldTypescriptProject();

		const result = await findSymbolTool.execute(
			{
				reason: "Find DuplicateClass",
				symbol: "DuplicateClass",
				type: "class",
				includeReferences: false,
			},
			{
				worktreePath: tempDir,
				projectRoot: tempDir,
				toolResultMap: new Map<string, boolean>(),
			},
		);

		expect(result.success).toBe(true);
		expect(result.output).toContain("DuplicateClass");
		expect(result.output).toContain("ClassDeclaration");
	});
});
