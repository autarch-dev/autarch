import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { migrateProjectDb } from "./migrations/index";
import type { ProjectDatabase } from "./types";

const AUTARCH_DIR = ".autarch";
const DB_FILENAME = "project.db";

const connections = new Map<string, Kysely<ProjectDatabase>>();

/**
 * Get the path to the project Autarch directory (.autarch in project root)
 */
export function getProjectAutarchDir(projectRoot: string): string {
	return join(projectRoot, AUTARCH_DIR);
}

/**
 * Get the path to the project database (.autarch/project.db)
 */
export function getProjectDbPath(projectRoot: string): string {
	return join(getProjectAutarchDir(projectRoot), DB_FILENAME);
}

/**
 * Ensure the project Autarch directory exists
 */
function ensureProjectDir(projectRoot: string): void {
	const dir = getProjectAutarchDir(projectRoot);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Initialize and return the project database connection.
 * Creates the .autarch directory and project.db if they don't exist.
 *
 * @param projectRoot - The root directory of the project (defaults to cwd)
 */
export async function getProjectDb(
	projectRoot: string = process.cwd(),
): Promise<Kysely<ProjectDatabase>> {
	let db = connections.get(projectRoot);

	if (!db) {
		ensureProjectDir(projectRoot);
		const sqlite = new Database(getProjectDbPath(projectRoot), {
			create: true,
		});

		db = new Kysely<ProjectDatabase>({
			dialect: new BunSqliteDialect({ database: sqlite }),
		});

		await migrateProjectDb(db);
		connections.set(projectRoot, db);
	}

	return db;
}

/**
 * Close a specific project database connection
 */
export async function closeProjectDb(projectRoot: string): Promise<void> {
	const db = connections.get(projectRoot);
	if (db) {
		await db.destroy();
		connections.delete(projectRoot);
	}
}

/**
 * Close all project database connections
 */
export async function closeAllProjectDbs(): Promise<void> {
	for (const [projectRoot] of connections) {
		await closeProjectDb(projectRoot);
	}
}

// Export table interfaces only
// NOTE: For type aliases (WorkflowStatus, SessionContextType, etc.),
// import directly from @/shared/schemas/*
export type {
	BaselineIssueType,
	BaselineSource,
	ChannelsTable,
	PlansTable,
	PreflightBaselinesTable,
	PreflightSetupTable,
	PreflightStatus,
	ProjectDatabase,
	ProjectMetaTable,
	PulseStatus,
	PulsesTable,
	QuestionsTable,
	ResearchCardsTable,
	ScopeCardsTable,
	ScopeComplexity,
	SessionNotesTable,
	SessionsTable,
	TurnMessagesTable,
	TurnsTable,
	TurnThoughtsTable,
	TurnToolsTable,
	WorkflowsTable,
} from "./types";
