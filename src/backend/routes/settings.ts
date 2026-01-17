import {
	DeleteApiKeyRequestSchema,
	SetApiKeyRequestSchema,
	SetIntegrationKeyRequestSchema,
	SetModelPreferencesRequestSchema,
} from "@/shared/schemas/settings";
import {
	clearApiKey,
	clearExaApiKey,
	getApiKeysStatus,
	getModelPreferences,
	isExaKeyConfigured,
	isOnboardingComplete,
	setApiKey,
	setExaApiKey,
	setModelPreferences,
	setOnboardingComplete,
} from "../services/globalSettings";
import { getProjectIconFile, getProjectInfo } from "../services/project";

/**
 * Settings API routes.
 * All routes are prefixed with /api/settings/
 */
export const settingsRoutes = {
	// =========================================================================
	// Project Info
	// =========================================================================

	"/api/project": {
		async GET() {
			const info = await getProjectInfo();
			return Response.json(info);
		},
	},

	"/api/project/icon": {
		async GET() {
			const iconFile = await getProjectIconFile();

			if (!iconFile) {
				return new Response(null, { status: 404 });
			}

			return new Response(iconFile);
		},
	},

	// =========================================================================
	// Onboarding
	// =========================================================================

	"/api/settings/onboarding": {
		async GET() {
			const complete = await isOnboardingComplete();
			return Response.json({ complete });
		},
	},

	"/api/settings/onboarding/complete": {
		async POST() {
			await setOnboardingComplete(true);
			return Response.json({ success: true });
		},
	},

	// =========================================================================
	// API Keys
	// =========================================================================

	"/api/settings/api-keys": {
		async GET() {
			const status = await getApiKeysStatus();
			return Response.json(status);
		},

		async PUT(req: Request) {
			const body = await req.json();
			const parsed = SetApiKeyRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await setApiKey(parsed.data.provider, parsed.data.key);
			return Response.json({ success: true });
		},

		async DELETE(req: Request) {
			const body = await req.json();
			const parsed = DeleteApiKeyRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await clearApiKey(parsed.data.provider);
			return Response.json({ success: true });
		},
	},

	// =========================================================================
	// Integrations (Exa)
	// =========================================================================

	"/api/settings/integrations": {
		async GET() {
			const exa = await isExaKeyConfigured();
			return Response.json({ exa });
		},

		async PUT(req: Request) {
			const body = await req.json();
			const parsed = SetIntegrationKeyRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await setExaApiKey(parsed.data.key);
			return Response.json({ success: true });
		},

		async DELETE() {
			await clearExaApiKey();
			return Response.json({ success: true });
		},
	},

	// =========================================================================
	// Model Preferences
	// =========================================================================

	"/api/settings/models": {
		async GET() {
			const preferences = await getModelPreferences();
			return Response.json(preferences);
		},

		async PUT(req: Request) {
			const body = await req.json();
			const parsed = SetModelPreferencesRequestSchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request", details: parsed.error.flatten() },
					{ status: 400 },
				);
			}

			await setModelPreferences(parsed.data);
			return Response.json({ success: true });
		},
	},
};
