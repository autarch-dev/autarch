import {
	SetApiKeyRequestSchema,
	SetModelPreferencesRequestSchema,
} from "@/shared/schemas/settings";
import {
	getApiKeysStatus,
	getModelPreferences,
	isOnboardingComplete,
	setApiKey,
	setModelPreferences,
	setOnboardingComplete,
} from "../services/globalSettings";

/**
 * Settings API routes.
 * All routes are prefixed with /api/settings/
 */
export const settingsRoutes = {
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
