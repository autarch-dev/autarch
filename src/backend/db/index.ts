/**
 * Database services entry point
 *
 * Exports access to both database services:
 * - Global DB: ~/.autarch/profile.db (user-wide settings)
 * - Project DB: .autarch/project.db (per-project data)
 */

export {
	closeGlobalDb,
	type GlobalDatabase,
	getGlobalAutarchDir,
	getGlobalDb,
	getGlobalDbPath,
	type SettingsTable,
} from "./global";

export {
	closeAllProjectDbs,
	closeProjectDb,
	getProjectAutarchDir,
	getProjectDb,
	getProjectDbPath,
	type ProjectDatabase,
	type ProjectMetaTable,
} from "./project";

import { closeGlobalDb } from "./global";
import { closeAllProjectDbs } from "./project";

/**
 * Close all database connections (useful for cleanup)
 */
export async function closeAllDbs(): Promise<void> {
	await closeGlobalDb();
	await closeAllProjectDbs();
}
