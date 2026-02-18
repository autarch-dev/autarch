import { z } from "zod";
import {
	CreateCustomModelRequestSchema,
	CreateCustomProviderRequestSchema,
	SetCustomProviderApiKeyRequestSchema,
	UpdateCustomModelRequestSchema,
	UpdateCustomProviderRequestSchema,
} from "@/shared/schemas/custom-providers";
import {
	clearCustomProviderApiKey,
	createCustomModel,
	createCustomProvider,
	deleteCustomModel,
	deleteCustomProvider,
	getCustomModel,
	getCustomModels,
	getCustomProvider,
	getCustomProviders,
	setCustomProviderApiKey,
	updateCustomModel,
	updateCustomProvider,
} from "../services/customProviders";

// =============================================================================
// Helpers
// =============================================================================

const IdParamSchema = z.object({
	id: z.string().min(1),
});

// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
type BunRequest = Request & { params?: any };

function parseParams<T extends z.ZodTypeAny>(
	req: BunRequest,
	schema: T,
): z.infer<T> | null {
	const result = schema.safeParse(req.params);
	if (!result.success) return null;
	return result.data;
}

// =============================================================================
// Routes
// =============================================================================

export const customProviderRoutes = {
	// =========================================================================
	// Custom Providers
	// =========================================================================

	"/api/settings/custom-providers": {
		async GET() {
			const providers = await getCustomProviders();
			return Response.json(providers);
		},

		async POST(req: Request) {
			const body = await req.json();
			const parsed = CreateCustomProviderRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			const existing = await getCustomProvider(parsed.data.id);
			if (existing) {
				return Response.json(
					{ error: `Provider "${parsed.data.id}" already exists` },
					{ status: 409 },
				);
			}

			await createCustomProvider(parsed.data);
			return Response.json({ success: true }, { status: 201 });
		},
	},

	"/api/settings/custom-providers/:id": {
		async GET(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}
			const provider = await getCustomProvider(params.id);
			if (!provider) {
				return Response.json({ error: "Provider not found" }, { status: 404 });
			}
			return Response.json(provider);
		},

		async PUT(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}

			const provider = await getCustomProvider(params.id);
			if (!provider) {
				return Response.json({ error: "Provider not found" }, { status: 404 });
			}

			const body = await req.json();
			const parsed = UpdateCustomProviderRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await updateCustomProvider(params.id, parsed.data);
			return Response.json({ success: true });
		},

		async DELETE(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}
			await deleteCustomProvider(params.id);
			return Response.json({ success: true });
		},
	},

	// =========================================================================
	// Custom Provider API Keys
	// =========================================================================

	"/api/settings/custom-providers/:id/api-key": {
		async PUT(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}

			const provider = await getCustomProvider(params.id);
			if (!provider) {
				return Response.json({ error: "Provider not found" }, { status: 404 });
			}

			const body = await req.json();
			const parsed = SetCustomProviderApiKeyRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await setCustomProviderApiKey(params.id, parsed.data.key);
			return Response.json({ success: true });
		},

		async DELETE(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}
			await clearCustomProviderApiKey(params.id);
			return Response.json({ success: true });
		},
	},

	// =========================================================================
	// Custom Models
	// =========================================================================

	"/api/settings/custom-providers/:id/models": {
		async GET(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}

			const provider = await getCustomProvider(params.id);
			if (!provider) {
				return Response.json({ error: "Provider not found" }, { status: 404 });
			}

			const models = await getCustomModels(params.id);
			return Response.json(models);
		},

		async POST(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid provider ID" }, { status: 400 });
			}

			const provider = await getCustomProvider(params.id);
			if (!provider) {
				return Response.json({ error: "Provider not found" }, { status: 404 });
			}

			const body = await req.json();
			const parsed = CreateCustomModelRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			const model = await createCustomModel(params.id, parsed.data);
			return Response.json(model, { status: 201 });
		},
	},

	"/api/settings/custom-models/:id": {
		async PUT(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid model ID" }, { status: 400 });
			}

			const modelId = decodeURIComponent(params.id);
			const model = await getCustomModel(modelId);
			if (!model) {
				return Response.json({ error: "Model not found" }, { status: 404 });
			}

			const body = await req.json();
			const parsed = UpdateCustomModelRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await updateCustomModel(modelId, parsed.data);
			return Response.json({ success: true });
		},

		async DELETE(req: BunRequest) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid model ID" }, { status: 400 });
			}
			await deleteCustomModel(decodeURIComponent(params.id));
			return Response.json({ success: true });
		},
	},
};
