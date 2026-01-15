import { serve } from "bun";
import open from "open";
import index from "../index.html";
import { initSessionManager } from "./agents/runner";
import { getProjectDb } from "./db/project";
import { findRepoRoot } from "./git";
import { log } from "./logger";
import { agentRoutes, handleAgentRoute } from "./routes/agent";
import { settingsRoutes } from "./routes/settings";
import { startWatching } from "./services/embedding";
import { handleClose, handleMessage, handleOpen } from "./ws";

// Server reference for WebSocket upgrades
let serverRef: ReturnType<typeof serve>;

const server = serve({
	port: 0, // Random available port

	routes: {
		// API routes (code-split by domain)
		...settingsRoutes,
		...agentRoutes,

		// WebSocket upgrade endpoint
		"/ws": {
			GET(req: Request) {
				const upgraded = serverRef.upgrade(req, { data: {} });
				if (!upgraded) {
					return new Response("WebSocket upgrade failed", { status: 400 });
				}
				return undefined;
			},
		},

		// Serve index.html for all unmatched routes (SPA fallback)
		"/*": index,
	},

	// Handle dynamic API routes with path parameters
	async fetch(req: Request) {
		const url = new URL(req.url);

		// Try dynamic agent routes (handles /api/channels/:id, /api/sessions/:id/message, etc.)
		if (url.pathname.startsWith("/api/")) {
			const response = await handleAgentRoute(req, url.pathname);
			if (response) {
				return response;
			}
		}

		// Fall through to static routes
		return undefined;
	},

	websocket: {
		open: handleOpen,
		message: handleMessage,
		close: handleClose,
	},

	development: {
		...(process.env.NODE_ENV !== "production" && {
			// Enable browser hot reloading in development
			hmr: true,
		}),
		...{ console: true },
	},
});

serverRef = server;

// Find project root first - required for agent system
let projectRoot: string;
try {
	projectRoot = findRepoRoot(process.cwd());
	log.server.info(`Project root: ${projectRoot}`);
} catch {
	log.server.error("Please run autarch from a git repository");
	process.exit(1);
}

// Initialize agent system (SessionManager needs the database)
(async () => {
	const db = await getProjectDb(projectRoot);
	initSessionManager(db);
	log.server.success("Agent system initialized");
})();

// Start embedding index + file watcher
startWatching(projectRoot);

log.server.box(`Autarch running at ${server.url}`);

// Auto-open browser in development
if (process.env.NODE_ENV !== "production") {
	open(server.url.toString());
}
