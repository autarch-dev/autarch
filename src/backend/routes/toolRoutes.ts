/**
 * Tool API Routes
 *
 * Routes for testing tools from the tool registry.
 * Provides endpoints to list tools, get tool metadata, and execute tools.
 *
 * Note: The testbench excludes tools that require workflow context:
 * - Block tools (submit_scope, submit_research, etc.) require workflowId/sessionId
 * - Review tools (get_diff, get_scope_card, etc.) require workflow context
 * - record_baseline requires workflow context to persist baselines
 */

import { Project } from "ts-morph";
import { z } from "zod";
import { findRepoRoot } from "../git";
import { log } from "../logger";
import { getTsconfigPath } from "../services/project";
import { getTool, getToolNames } from "../tools";
import type { ToolContext } from "../tools/types";

// =============================================================================
// Schemas
// =============================================================================

const NameParamSchema = z.object({
	name: z.string().min(1),
});

/**
 * Tools that require workflow context and cannot be used in the testbench.
 * These tools need workflowId, sessionId, or other workflow-specific context.
 */
const WORKFLOW_ONLY_TOOLS = new Set([
	// Block tools - require workflowId and sessionId
	"submit_scope",
	"submit_research",
	"submit_plan",
	"request_extension",
	"ask_questions",
	"complete_pulse",
	"complete_preflight",
	// Review tools - require workflow context
	"get_diff",
	"get_scope_card",
	"add_line_comment",
	"add_file_comment",
	"add_review_comment",
	"complete_review",
	// Preflight tools that persist to workflow
	"record_baseline",
]);

/**
 * Get tool names available in the testbench (excludes workflow-only tools).
 */
function getTestbenchToolNames(): string[] {
	return getToolNames().filter((name) => !WORKFLOW_ONLY_TOOLS.has(name));
}

/** Cache for ts-morph Project instances by tsconfig path */
const PROJECT_CACHE = new Map<string, Project>();

/**
 * Create a tool context for testbench execution.
 * Initializes ts-morph Project if in a TypeScript workspace.
 */
async function createTestbenchContext(
	projectRoot: string,
): Promise<ToolContext> {
	const tsconfigPath = await getTsconfigPath(projectRoot);

	if (tsconfigPath) {
		let project = PROJECT_CACHE.get(tsconfigPath);

		if (!project) {
			log.api.info(
				`Testbench: Creating ts-morph project instance for ${tsconfigPath}`,
			);
			project = new Project({
				tsConfigFilePath: tsconfigPath,
			});
			PROJECT_CACHE.set(tsconfigPath, project);
		}
	} else {
		log.api.info(`Testbench: No tsconfig.json found for ${projectRoot}`);
	}

	return {
		projectRoot,
		project: tsconfigPath ? PROJECT_CACHE.get(tsconfigPath) : undefined,
	};
}

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
			return Response.json({ tools: getTestbenchToolNames() });
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
			const context = await createTestbenchContext(projectRoot);

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
