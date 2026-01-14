import { serve } from "bun";
import open from "open";
import index from "../index.html";
import { settingsRoutes } from "./routes/settings";
import { handleClose, handleMessage, handleOpen } from "./ws";

// Server reference for WebSocket upgrades
let serverRef: ReturnType<typeof serve>;

const server = serve({
	port: 0, // Random available port

	routes: {
		// API routes (code-split by domain)
		...settingsRoutes,

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

	development: process.env.NODE_ENV !== "production" && {
		// Enable browser hot reloading in development
		hmr: true,

		// Echo console logs from the browser to the server
		console: true,
	},
});

serverRef = server;

console.log(`🚀 Autarch running at ${server.url}`);

// Auto-open browser in development
if (process.env.NODE_ENV !== "production") {
	open(server.url.toString());
}
