/**
 * Server Port - Centralized access to the running server's port number
 *
 * Initialized once after server creation in index.ts.
 * Used by services that need to construct localhost URLs (e.g., askpass helper scripts).
 */

// =============================================================================
// Module State
// =============================================================================

let cachedPort: number | null = null;

// =============================================================================
// Server Port Management
// =============================================================================

/**
 * Initialize the server port.
 * Must be called exactly once after the server is created.
 *
 * @param port - The port number the server is listening on
 * @throws Error if already initialized
 */
export function initServerPort(port: number): void {
	if (cachedPort !== null) {
		throw new Error("Server port already initialized.");
	}
	cachedPort = port;
}

/**
 * Get the server port number.
 * Must call initServerPort() first during startup.
 *
 * @returns The cached server port number
 * @throws Error if initServerPort() has not been called
 */
export function getServerPort(): number {
	if (cachedPort === null) {
		throw new Error("Server port not initialized.");
	}
	return cachedPort;
}
