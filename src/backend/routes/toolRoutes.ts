/**
 * Tool API Routes
 *
 * Routes for testing tools from the tool registry.
 * Provides endpoints to list tools, get tool metadata, and execute tools.
 */

import { z } from "zod";
import { findRepoRoot } from "../git";
import { log } from "../logger";
import { getTool, getToolNames } from "../tools";
import type { ToolContext } from "../tools/types";

// =============================================================================
// Schemas
// =============================================================================

const NameParamSchema = z.object({
	name: z.string().min(1),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse and validate route params with Zod.
 */
function parseParams<T extends z.ZodTypeAny>(
	// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
	req: Request & { params?: any },
	schema: T,
): z.infer<T> | null {
	const result = schema.safeParse(req.params);
	if (!result.success) {
		return null;
	}
	return result.data;
}

// =============================================================================
// Routes
// =============================================================================

export const toolRoutes = {
	"/api/tools": {
		GET() {
			return Response.json(getToolNames());
		},
	},

	"/api/tools/:name": {
		GET(req: Request) {
			const params = parseParams(req, NameParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid tool name" }, { status: 400 });
			}

			const tool = getTool(params.name);
			if (!tool) {
				return Response.json({ error: "Tool not found" }, { status: 404 });
			}

			return Response.json({
				name: tool.name,
				description: tool.description,
				schema: z.toJSONSchema(tool.inputSchema),
			});
		},
	},

	"/api/tools/:name/execute": {
		async POST(req: Request) {
			const params = parseParams(req, NameParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid tool name" }, { status: 400 });
			}

			const tool = getTool(params.name);
			if (!tool) {
				return Response.json({ error: "Tool not found" }, { status: 404 });
			}

			let body: unknown;
			try {
				body = await req.json();
			} catch {
				return Response.json({ error: "Invalid JSON body" }, { status: 400 });
			}

			const validationResult = tool.inputSchema.safeParse(body);
			if (!validationResult.success) {
				return Response.json(
					{
						error: "Invalid input",
						details: z.prettifyError(validationResult.error),
					},
					{ status: 400 },
				);
			}

			const projectRoot = findRepoRoot(process.cwd());
			const context: ToolContext = {
				projectRoot,
			};

			try {
				const result = await tool.execute(validationResult.data, context);
				return Response.json({
					success: result.success,
					output: result.output,
				});
			} catch (error) {
				log.api.error(`Tool execution failed for ${params.name}:`, error);
				return Response.json(
					{
						error: "Tool execution failed",
						details: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},
	},
};
