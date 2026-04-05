/**
 * MCP Config Generation
 *
 * Generates temporary MCP config files that point `claude -p --mcp-config`
 * to Autarch's in-process MCP HTTP endpoint.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getServerPort } from "@/backend/serverPort";

/**
 * Generate a temporary MCP config file for a session.
 *
 * The config points Claude Code to Autarch's in-process MCP endpoint:
 *   POST http://127.0.0.1:<port>/mcp/sessions/<sessionId>
 *
 * @returns Path to the generated config file
 */
export async function generateMcpConfig(
	projectRoot: string,
	sessionId: string,
): Promise<string> {
	const port = getServerPort();
	const config = {
		mcpServers: {
			autarch: {
				type: "http",
				url: `http://127.0.0.1:${port}/mcp/sessions/${sessionId}`,
			},
		},
	};

	const tmpDir = path.join(projectRoot, ".autarch", "tmp");
	await fs.mkdir(tmpDir, { recursive: true });

	const configPath = path.join(tmpDir, `mcp-${sessionId}.json`);
	await fs.writeFile(configPath, JSON.stringify(config, null, 2));

	return configPath;
}

/**
 * Clean up a temporary MCP config file.
 */
export async function cleanupMcpConfig(
	projectRoot: string,
	sessionId: string,
): Promise<void> {
	const configPath = path.join(
		projectRoot,
		".autarch",
		"tmp",
		`mcp-${sessionId}.json`,
	);
	try {
		await fs.unlink(configPath);
	} catch {
		// File may already be cleaned up
	}
}
