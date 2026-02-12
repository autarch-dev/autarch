/**
 * Credential Prompt API Routes
 *
 * Routes for handling GIT_ASKPASS credential prompts.
 * The askpass helper script long-polls the first route, and the frontend
 * submits or cancels via the second route.
 */

import { z } from "zod";
import { log } from "../logger";
import {
	requestCredential,
	resolveCredentialPrompt,
} from "../services/credential-prompt";

// =============================================================================
// Schemas
// =============================================================================

const CredentialRespondSchema = z.object({
	credential: z.string().nullable(),
});

const IdParamSchema = z.object({
	id: z.string().min(1),
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

export const credentialPromptRoutes = {
	"/api/credential-prompt": {
		async POST(req: Request) {
			// Validate nonce header
			const nonce = req.headers.get("X-Askpass-Nonce");
			if (!nonce) {
				return Response.json(
					{ error: "Missing X-Askpass-Nonce header" },
					{ status: 400 },
				);
			}

			// Parse prompt from plain text body (askpass scripts send raw strings)
			const prompt = await req.text();
			if (!prompt) {
				return new Response("Missing prompt text", { status: 400 });
			}

			try {
				// Long-poll: blocks until user responds or timeout
				const result = await requestCredential(nonce, prompt);

				log.api.info(
					`Credential prompt for "${prompt}" resolved (${result !== null ? "provided" : "cancelled/timed out"})`,
				);

				// Return raw credential string (or empty for cancelled/timed out)
				return new Response(result ?? "", {
					headers: { "Content-Type": "text/plain" },
				});
			} catch (error) {
				// Invalid or expired nonce
				log.api.warn(
					`Credential prompt rejected: ${error instanceof Error ? error.message : "unknown error"}`,
				);
				return Response.json(
					{ error: "Invalid or expired nonce" },
					{ status: 403 },
				);
			}
		},
	},

	"/api/credential-prompt/:id/respond": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid prompt ID" }, { status: 400 });
			}

			const promptId = params.id;

			// Parse and validate body
			let body: unknown;
			try {
				body = await req.json();
			} catch {
				return Response.json({ error: "Invalid JSON body" }, { status: 400 });
			}

			const parsed = CredentialRespondSchema.safeParse(body);
			if (!parsed.success) {
				return Response.json(
					{
						error: "Invalid request body",
						details: z.prettifyError(parsed.error),
					},
					{ status: 400 },
				);
			}

			const resolved = resolveCredentialPrompt(
				promptId,
				parsed.data.credential,
			);

			if (!resolved) {
				return Response.json(
					{ error: "Prompt not found or already resolved" },
					{ status: 404 },
				);
			}

			log.api.info(
				`Credential prompt ${promptId} responded (${parsed.data.credential !== null ? "provided" : "cancelled"})`,
			);

			return Response.json({ success: true });
		},
	},
};
