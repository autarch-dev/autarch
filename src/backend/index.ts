import { serve } from "bun";
import open from "open";
import index from "../index.html";
import { settingsRoutes } from "./routes/settings";

const server = serve({
	port: 0, // Random available port

	routes: {
		// API routes (code-split by domain)
		...settingsRoutes,

		// Serve index.html for all unmatched routes (SPA fallback)
		"/*": index,
	},

	development: process.env.NODE_ENV !== "production" && {
		// Enable browser hot reloading in development
		hmr: true,

		// Echo console logs from the browser to the server
		console: true,
	},
});

console.log(`🚀 Autarch running at ${server.url}`);

// Auto-open browser in development
if (process.env.NODE_ENV !== "production") {
	open(server.url.toString());
}
