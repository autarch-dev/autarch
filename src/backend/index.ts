import { serve } from "bun";
import open from "open";
import index from "../index.html";
import { initSessionManager, initWorkflowOrchestrator } from "./agents/runner";
import { getProjectDb } from "./db/project";
import { log } from "./logger";
import { initProjectRoot } from "./projectRoot";
import { initRepositories } from "./repositories";
import { agentRoutes, customProviderRoutes, settingsRoutes } from "./routes";
import { initServerPort } from "./serverPort";
import { startWatching } from "./services/embedding";
import { handleClose, handleMessage, handleOpen } from "./ws";

// Server reference for WebSocket upgrades
let serverRef: ReturnType<typeof serve>;

const server = serve({
	port: 0, // Random available port

	routes: {
		// API routes - Bun handles dynamic :param routes natively
		...settingsRoutes,
		...customProviderRoutes,
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
initServerPort(Number(new URL(server.url).port));

// Find project root first - required for agent system
// Accepts an optional positional CLI argument for the target project directory
let projectRoot: string;
try {
	projectRoot = initProjectRoot();
	log.server.info(`Project root: ${projectRoot}`);
} catch (error) {
	const message =
		error instanceof Error ? error.message : "Unknown error finding git root";
	log.server.error(message);
	process.exit(1);
}

// Initialize agent system (SessionManager and WorkflowOrchestrator)
(async () => {
	const db = await getProjectDb(projectRoot);
	const repos = initRepositories(db);
	const sessionManager = initSessionManager(repos.sessions);
	initWorkflowOrchestrator(
		sessionManager,
		repos.workflows,
		repos.artifacts,
		repos.conversations,
		repos.pulses,
	);
	log.server.success("Agent system initialized");
})();

// Start embedding index + file watcher
startWatching(projectRoot);

log.server.box(`Autarch running at ${server.url}`);

// Auto-open browser in development
if (process.env.NODE_ENV !== "production") {
	open(server.url.toString());
}

// Listen for [o] keypress to open browser
if (process.stdin.isTTY) {
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on("data", (data: Buffer) => {
		const key = data.toString();
		// Ctrl+C
		if (key === "\x03") {
			process.exit(0);
		}
		if (key === "o" || key === "O") {
			open(server.url.toString());
		}
	});
	log.server.info("Press [o] to open in browser");
}
