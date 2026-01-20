/**
 * Shell Approval API Routes
 *
 * Routes for approving or denying shell command execution requests.
 */

import { z } from "zod";
import { log } from "../logger";
import {
	getPendingApproval,
	resolveApproval,
} from "../services/shell-approval";

// =============================================================================
// Schemas
// =============================================================================

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const ApproveRequestSchema = z.object({
	remember: z.boolean().optional(),
});

const DenyRequestSchema = z.object({
	reason: z.string().min(1),
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

export const shellApprovalRoutes = {
	"/api/shell-approval/:id/approve": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid approval ID" }, { status: 400 });
			}

			const approvalId = params.id;

			try {
				// Check if approval exists
				const pending = getPendingApproval(approvalId);
				if (!pending) {
					return Response.json(
						{ error: "Approval not found" },
						{ status: 404 },
					);
				}

				// Parse optional body for remember flag
				let remember = false;
				const contentType = req.headers.get("content-type");
				if (contentType?.includes("application/json")) {
					const body = await req.json();
					const parsed = ApproveRequestSchema.safeParse(body);
					if (parsed.success) {
						remember = parsed.data.remember ?? false;
					}
				}

				// Resolve the approval
				resolveApproval(approvalId, true, remember);

				log.api.info(
					`Shell approval ${approvalId} approved${remember ? " (remembered)" : ""}`,
				);

				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to approve shell command:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/shell-approval/:id/deny": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid approval ID" }, { status: 400 });
			}

			const approvalId = params.id;

			try {
				// Check if approval exists
				const pending = getPendingApproval(approvalId);
				if (!pending) {
					return Response.json(
						{ error: "Approval not found" },
						{ status: 404 },
					);
				}

				// Parse required body for reason
				const body = await req.json();
				const parsed = DenyRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				// Resolve the denial
				resolveApproval(approvalId, false, false, parsed.data.reason);

				log.api.info(
					`Shell approval ${approvalId} denied: ${parsed.data.reason}`,
				);

				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to deny shell command:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
