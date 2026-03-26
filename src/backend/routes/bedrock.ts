import { listBedrockModels } from "../services/bedrock";

/**
 * Bedrock API routes.
 * Prefixed with /api/settings/bedrock/
 */
export const bedrockRoutes = {
	"/api/settings/bedrock/models": {
		async GET() {
			try {
				const models = await listBedrockModels();
				return Response.json(models);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to list Bedrock models";
				return Response.json({ error: message }, { status: 502 });
			}
		},
	},
};
