import { expect, test } from "bun:test";
import { findSymbolTool } from "@/backend/tools/typescript/find_symbol";

test("can find a class in the current project", async () => {
	const result = await findSymbolTool.execute(
		{
			reason: "Find the symbol 'AgentRunner'",
			symbol: "AgentRunner",
			type: "class",
			includeReferences: false,
		},
		{
			worktreePath: process.cwd(),
			projectRoot: process.cwd(),
		},
	);
	expect(result.success).toBe(true);
	expect(result.output).toContain("AgentRunner");
});