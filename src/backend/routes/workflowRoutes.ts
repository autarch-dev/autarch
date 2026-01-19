/**
 * Workflow API Routes
 *
 * Routes for managing workflows, approval flows, and workflow artifacts.
 * Uses repositories for data access.
 */

import { z } from "zod";
import {
	MergeStrategySchema,
	RewindTargetSchema,
} from "@/shared/schemas/workflow";
import { getWorkflowOrchestrator } from "../agents/runner";
import { getDiff } from "../git";
import { log } from "../logger";
import { getRepositories } from "../repositories";

// =============================================================================
// Request Schemas
// =============================================================================

const CreateWorkflowRequestSchema = z.object({
	prompt: z.string().min(1),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const RequestChangesSchema = z.object({
	feedback: z.string().min(1),
});

const RewindRequestSchema = z.object({
	targetStage: RewindTargetSchema,
});

const CreateUserCommentSchema = z.discriminatedUnion("type", [
	// Line comment: requires filePath and startLine
	z.object({
		type: z.literal("line"),
		filePath: z.string().min(1),
		startLine: z.number(),
		endLine: z.number().optional(),
		description: z.string().min(1),
	}),
	// File comment: requires filePath, no line numbers
	z.object({
		type: z.literal("file"),
		filePath: z.string().min(1),
		description: z.string().min(1),
	}),
	// Review comment: general comment, no file or line required
	z.object({
		type: z.literal("review"),
		description: z.string().min(1),
	}),
]);

const RequestFixesSchema = z.object({
	commentIds: z.array(z.string().min(1)).min(1),
	summary: z.string().optional(),
});

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const MergeApprovalSchema = z.object({
	mergeStrategy: MergeStrategySchema,
	commitMessage: z.string().min(1),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse and validate route params with Zod.
 * Returns null and sends error response if validation fails.
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

export const workflowRoutes = {
	"/api/workflows": {
		async GET() {
			try {
				const repos = getRepositories();
				const workflows = await repos.workflows.list({ orderBy: "updated" });
				return Response.json(workflows);
			} catch (error) {
				log.api.error("Failed to list workflows:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateWorkflowRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const orchestrator = getWorkflowOrchestrator();
				const workflow = await orchestrator.createWorkflow(
					parsed.data.prompt,
					parsed.data.priority ?? "medium",
				);

				log.api.success(`Created workflow: ${workflow.id}`);
				return Response.json(workflow, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const workflow = await repos.workflows.getById(params.id);
				if (!workflow) {
					return Response.json(
						{ error: "Workflow not found" },
						{ status: 404 },
					);
				}
				return Response.json(workflow);
			} catch (error) {
				log.api.error("Failed to get workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/approve": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const orchestrator = getWorkflowOrchestrator();
				const contentType = req.headers.get("Content-Type");

				// If JSON content-type, parse merge options (review stage approval)
				if (contentType?.includes("application/json")) {
					const body = await req.json();
					const parsed = MergeApprovalSchema.safeParse(body);
					if (!parsed.success) {
						return Response.json(
							{
								error: "Invalid request body",
								details: z.prettifyError(parsed.error),
							},
							{ status: 400 },
						);
					}
					await orchestrator.approveArtifact(params.id, parsed.data);
				} else {
					// No JSON body - scope/research/plan approvals
					await orchestrator.approveArtifact(params.id);
				}

				log.api.success(`Approved artifact for workflow: ${params.id}`);
				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to approve artifact:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/request-changes": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = RequestChangesSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}
				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.requestChanges(params.id, parsed.data.feedback);
				log.api.info(`Requested changes for workflow: ${params.id}`);
				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to request changes:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/history": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			const workflowId = params.id;
			try {
				const repos = getRepositories();

				// Get the workflow
				const workflow = await repos.workflows.getById(workflowId);
				if (!workflow) {
					return Response.json(
						{ error: "Workflow not found" },
						{ status: 404 },
					);
				}

				// Get conversation history using repository
				const { messages, activeSessionId, activeSessionStatus } =
					await repos.conversations.getHistory("workflow", workflowId);

				// Get all artifacts for the workflow (includes pending, approved, denied)
				const scopeCards = await repos.artifacts.getAllScopeCards(workflowId);
				const researchCards =
					await repos.artifacts.getAllResearchCards(workflowId);
				const plans = await repos.artifacts.getAllPlans(workflowId);

				// Get all review cards
				const reviewCards = await repos.artifacts.getAllReviewCards(workflowId);

				const response = {
					workflow,
					sessionId: activeSessionId,
					sessionStatus: activeSessionStatus,
					messages,
					scopeCards,
					researchCards,
					plans,
					reviewCards,
				};

				return Response.json(response);
			} catch (error) {
				log.api.error("Failed to get workflow history:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/scope-card": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const scopeCard = await repos.artifacts.getLatestScopeCard(params.id);

				if (!scopeCard) {
					return Response.json(
						{ error: "Scope card not found" },
						{ status: 404 },
					);
				}
				return Response.json(scopeCard);
			} catch (error) {
				log.api.error("Failed to get scope card:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/research-card": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const researchCard = await repos.artifacts.getLatestResearchCard(
					params.id,
				);

				if (!researchCard) {
					return Response.json(
						{ error: "Research card not found" },
						{ status: 404 },
					);
				}
				return Response.json(researchCard);
			} catch (error) {
				log.api.error("Failed to get research card:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/plan": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const plan = await repos.artifacts.getLatestPlan(params.id);

				if (!plan) {
					return Response.json({ error: "Plan not found" }, { status: 404 });
				}
				return Response.json(plan);
			} catch (error) {
				log.api.error("Failed to get plan:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/review-card": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const reviewCard = await repos.artifacts.getLatestReviewCard(params.id);

				if (!reviewCard) {
					return Response.json(
						{ error: "Review card not found" },
						{ status: 404 },
					);
				}
				return Response.json(reviewCard);
			} catch (error) {
				log.api.error("Failed to get review card:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/rewind": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = RewindRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.rewindToStage(params.id, parsed.data.targetStage);
				log.api.success(
					`Rewound workflow ${params.id} to ${parsed.data.targetStage}`,
				);
				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to rewind workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/diff": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const workflow = await repos.workflows.getById(params.id);

				if (!workflow) {
					return Response.json(
						{ error: "Workflow not found" },
						{ status: 404 },
					);
				}

				if (!workflow.baseBranch) {
					return Response.json(
						{ error: "Workflow has no base branch set" },
						{ status: 400 },
					);
				}

				// Construct the workflow branch name (autarch/{workflowId})
				const workflowBranch = `autarch/${params.id}`;
				const diffContent = await getDiff(
					process.cwd(),
					workflow.baseBranch,
					workflowBranch,
				);

				return Response.json({ diff: diffContent ?? "" });
			} catch (error) {
				log.api.error("Failed to get diff:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/review-comments": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = CreateUserCommentSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();

				// Get the latest review card for this workflow
				const reviewCard = await repos.artifacts.getLatestReviewCard(params.id);
				if (!reviewCard) {
					return Response.json(
						{ error: "No review card found for this workflow" },
						{ status: 404 },
					);
				}

				// Create the user comment with author='user' and null severity/category
				const data = parsed.data;
				const comment = await repos.artifacts.createReviewComment({
					reviewCardId: reviewCard.id,
					type: data.type,
					filePath: "filePath" in data ? data.filePath : undefined,
					startLine: "startLine" in data ? data.startLine : undefined,
					endLine: "endLine" in data ? data.endLine : undefined,
					severity: undefined,
					category: undefined,
					description: data.description,
					author: "user",
				});

				log.api.success(
					`Created user comment ${comment.id} for workflow ${params.id}`,
				);
				return Response.json(comment, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create user comment:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/request-fixes": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = RequestFixesSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.requestFixes(
					params.id,
					parsed.data.commentIds,
					parsed.data.summary,
				);

				log.api.success(
					`Requested fixes for workflow ${params.id} with ${parsed.data.commentIds.length} comments`,
				);
				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to request fixes:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
