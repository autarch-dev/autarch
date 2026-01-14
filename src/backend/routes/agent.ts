/**
 * Agent API Routes
 *
 * Routes for managing workflows, sessions, and agent interactions.
 */

import { z } from "zod";
import {
	AgentRunner,
	getSessionManager,
	getWorkflowOrchestrator,
} from "../agents/runner";
import { getProjectDb } from "../db/project";
import { findRepoRoot } from "../git";

// =============================================================================
// Request Schemas
// =============================================================================

const CreateWorkflowRequestSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const SendMessageRequestSchema = z.object({
	content: z.string().min(1),
});

const RequestChangesRequestSchema = z.object({
	feedback: z.string().min(1),
});

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/workflows - Create a new workflow
 */
async function createWorkflow(req: Request): Promise<Response> {
	try {
		const body = await req.json();
		const parsed = CreateWorkflowRequestSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: "Invalid request", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}

		const orchestrator = getWorkflowOrchestrator();
		const workflow = await orchestrator.createWorkflow(
			parsed.data.title,
			parsed.data.description,
			parsed.data.priority,
		);

		return Response.json(workflow, { status: 201 });
	} catch (error) {
		console.error("Failed to create workflow:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/workflows - List all workflows
 */
async function listWorkflows(_req: Request): Promise<Response> {
	try {
		const projectRoot = findRepoRoot(process.cwd());
		const db = await getProjectDb(projectRoot);

		const workflows = await db
			.selectFrom("workflows")
			.selectAll()
			.orderBy("updated_at", "desc")
			.execute();

		return Response.json(
			workflows.map((w) => ({
				id: w.id,
				title: w.title,
				description: w.description,
				status: w.status,
				priority: w.priority,
				awaitingApproval: w.awaiting_approval === 1,
				pendingArtifactType: w.pending_artifact_type,
				createdAt: w.created_at,
				updatedAt: w.updated_at,
			})),
		);
	} catch (error) {
		console.error("Failed to list workflows:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/workflows/:id - Get a workflow by ID
 */
async function getWorkflow(
	_req: Request,
	workflowId: string,
): Promise<Response> {
	try {
		const orchestrator = getWorkflowOrchestrator();
		const workflow = await orchestrator.getWorkflow(workflowId);

		if (!workflow) {
			return Response.json({ error: "Workflow not found" }, { status: 404 });
		}

		return Response.json(workflow);
	} catch (error) {
		console.error("Failed to get workflow:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/workflows/:id/approve - Approve pending artifact
 */
async function approveArtifact(
	_req: Request,
	workflowId: string,
): Promise<Response> {
	try {
		const orchestrator = getWorkflowOrchestrator();
		await orchestrator.approveArtifact(workflowId);

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to approve artifact:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/workflows/:id/request-changes - Request changes to pending artifact
 */
async function requestChanges(
	req: Request,
	workflowId: string,
): Promise<Response> {
	try {
		const body = await req.json();
		const parsed = RequestChangesRequestSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: "Invalid request", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}

		const orchestrator = getWorkflowOrchestrator();
		await orchestrator.requestChanges(workflowId, parsed.data.feedback);

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to request changes:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/sessions/:id/message - Send a message to a session
 */
async function sendMessage(req: Request, sessionId: string): Promise<Response> {
	try {
		const body = await req.json();
		const parsed = SendMessageRequestSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: "Invalid request", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}

		const sessionManager = getSessionManager();
		const session = sessionManager.getSession(sessionId);

		if (!session) {
			return Response.json({ error: "Session not found" }, { status: 404 });
		}

		if (session.status !== "active") {
			return Response.json({ error: "Session is not active" }, { status: 400 });
		}

		const projectRoot = findRepoRoot(process.cwd());
		const db = await getProjectDb(projectRoot);

		const runner = new AgentRunner(session, { projectRoot, db });

		// Run in background (non-blocking)
		runner.run(parsed.data.content).catch((error) => {
			console.error("Agent run failed:", error);
			sessionManager.errorSession(
				sessionId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});

		return Response.json({ success: true, sessionId });
	} catch (error) {
		console.error("Failed to send message:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/channels/:id/session - Start a channel session
 */
async function startChannelSession(
	_req: Request,
	channelId: string,
): Promise<Response> {
	try {
		const sessionManager = getSessionManager();

		// Check if already has active session
		const existing = sessionManager.getSessionByContext("channel", channelId);
		if (existing?.status === "active") {
			return Response.json({
				sessionId: existing.id,
				alreadyActive: true,
			});
		}

		const session = await sessionManager.startSession({
			contextType: "channel",
			contextId: channelId,
			agentRole: "discussion",
		});

		return Response.json({ sessionId: session.id }, { status: 201 });
	} catch (error) {
		console.error("Failed to start channel session:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

// =============================================================================
// Route Definitions
// =============================================================================

export const agentRoutes = {
	// Workflow routes
	"POST /api/workflows": createWorkflow,
	"GET /api/workflows": listWorkflows,

	// These need dynamic routing - handled via pattern matching
	// "GET /api/workflows/:id": getWorkflow,
	// "POST /api/workflows/:id/approve": approveArtifact,
	// "POST /api/workflows/:id/request-changes": requestChanges,

	// Session routes
	// "POST /api/sessions/:id/message": sendMessage,

	// Channel routes
	// "POST /api/channels/:id/session": startChannelSession,
} as const;

/**
 * Handle dynamic routes with path parameters
 */
export async function handleAgentRoute(
	req: Request,
	path: string,
): Promise<Response | null> {
	const method = req.method;

	// Workflow by ID: GET /api/workflows/:id
	const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
	if (workflowMatch?.[1] && method === "GET") {
		return getWorkflow(req, workflowMatch[1]);
	}

	// Approve artifact: POST /api/workflows/:id/approve
	const approveMatch = path.match(/^\/api\/workflows\/([^/]+)\/approve$/);
	if (approveMatch?.[1] && method === "POST") {
		return approveArtifact(req, approveMatch[1]);
	}

	// Request changes: POST /api/workflows/:id/request-changes
	const changesMatch = path.match(
		/^\/api\/workflows\/([^/]+)\/request-changes$/,
	);
	if (changesMatch?.[1] && method === "POST") {
		return requestChanges(req, changesMatch[1]);
	}

	// Send message: POST /api/sessions/:id/message
	const messageMatch = path.match(/^\/api\/sessions\/([^/]+)\/message$/);
	if (messageMatch?.[1] && method === "POST") {
		return sendMessage(req, messageMatch[1]);
	}

	// Start channel session: POST /api/channels/:id/session
	const channelMatch = path.match(/^\/api\/channels\/([^/]+)\/session$/);
	if (channelMatch?.[1] && method === "POST") {
		return startChannelSession(req, channelMatch[1]);
	}

	return null;
}
