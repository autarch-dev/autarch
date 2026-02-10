import { GitIdentitySchema } from "@/shared/schemas/git-identity";
import {
	DeleteApiKeyRequestSchema,
	SetApiKeyRequestSchema,
	SetIntegrationKeyRequestSchema,
	SetModelPreferencesRequestSchema,
} from "@/shared/schemas/settings";
import { execGit } from "../git/git-executor";
import { resolveGitIdentityEnv } from "../git/identity";
import { getProjectRoot } from "../projectRoot";
import {
	clearApiKey,
	clearExaApiKey,
	getApiKeysStatus,
	getModelPreferences,
	getOnboardingStatus,
	isExaKeyConfigured,
	setApiKey,
	setExaApiKey,
	setModelPreferences,
} from "../services/globalSettings";
import { getProjectIconFile, getProjectInfo } from "../services/project";
import {
	setGitAuthorEmail,
	setGitAuthorName,
} from "../services/projectSettings";

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
			const status = await getOnboardingStatus(getProjectRoot());
			return Response.json(status);
		},
	},

	"/api/settings/onboarding/complete": {
		async POST() {
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

	// =========================================================================
	// Git Identity
	// =========================================================================

	"/api/project/git-identity": {
		async GET() {
			const projectRoot = getProjectRoot();
			const env = await resolveGitIdentityEnv(projectRoot);

			return Response.json({
				name: env.GIT_AUTHOR_NAME ?? "",
				email: env.GIT_AUTHOR_EMAIL ?? "",
			});
		},

		async PUT(req: Request) {
			const body = await req.json();
			const parsed = GitIdentitySchema.safeParse(body);

			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid request body" },
					{ status: 400 },
				);
			}

			const projectRoot = getProjectRoot();
			await setGitAuthorName(projectRoot, parsed.data.name);
			await setGitAuthorEmail(projectRoot, parsed.data.email);
			return Response.json({ success: true });
		},
	},

	"/api/project/git-identity/defaults": {
		async GET() {
			const projectRoot = getProjectRoot();

			const nameResult = await execGit(["config", "user.name"], {
				cwd: projectRoot,
			});
			const emailResult = await execGit(["config", "user.email"], {
				cwd: projectRoot,
			});

			return Response.json({
				name: nameResult.success ? nameResult.stdout.trim() : null,
				email: emailResult.success ? emailResult.stdout.trim() : null,
			});
		},
	},
};
