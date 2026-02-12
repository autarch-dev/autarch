/**
 * Persona roadmaps service utilities
 *
 * Service layer for managing persona roadmap records. Each roadmap generation
 * spawns 4 persona agents (visionary, iterative, tech_lead, pathfinder) that
 * produce independent roadmap proposals. Once all 4 complete, a synthesis
 * agent merges them into the final roadmap.
 *
 * Follows the subtasks service pattern — atomic completion checking ensures
 * exactly one caller triggers synthesis when the last persona finishes.
 */

import { AgentRunner } from "@/backend/agents/runner/AgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import type {
	PersonaRoadmapStatus,
	PersonaRoadmapsTable,
} from "@/backend/db/project/types";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import type { ProjectDb } from "@/backend/repositories/types";
import { generateId } from "@/backend/utils/ids";

// =============================================================================
// Constants
// =============================================================================

const PERSONAS = ["visionary", "iterative", "tech_lead", "pathfinder"] as const;

export type Persona = (typeof PERSONAS)[number];

// =============================================================================
// Types
// =============================================================================

export interface PersonaRoadmapRow {
	id: string;
	roadmapId: string;
	persona: string;
	sessionId: string | null;
	roadmapData: unknown | null;
	status: PersonaRoadmapStatus;
	createdAt: number;
	updatedAt: number;
}

export interface PersonaCompletionResult {
	/** Whether all 4 persona roadmaps have completed */
	allDone: boolean;
	/** The parent roadmap ID */
	roadmapId: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a database row to a PersonaRoadmapRow domain object.
 * Parses roadmap_data JSON for completed records.
 */
function toPersonaRoadmapRow(row: PersonaRoadmapsTable): PersonaRoadmapRow {
	let parsedData: unknown | null = null;
	if (row.roadmap_data) {
		try {
			parsedData = JSON.parse(row.roadmap_data);
		} catch {
			parsedData = row.roadmap_data;
		}
	}

	return {
		id: row.id,
		roadmapId: row.roadmap_id,
		persona: row.persona,
		sessionId: row.session_id,
		roadmapData: parsedData,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * Format completed persona roadmaps into a structured message for the synthesis agent.
 */
function formatSynthesisMessage(rows: PersonaRoadmapsTable[]): string {
	const sections: string[] = [];

	sections.push(
		"You are the Synthesis agent. Below are 4 independent roadmap proposals from different persona agents. " +
			"Your job is to analyze these proposals, identify common themes and conflicts, and work with the user " +
			"to produce a single unified roadmap.\n",
	);

	for (const row of rows) {
		let data: Record<string, unknown> = {};
		if (row.roadmap_data) {
			try {
				data = JSON.parse(row.roadmap_data) as Record<string, unknown>;
			} catch {
				data = { raw: row.roadmap_data };
			}
		}

		const personaLabel = row.persona.replaceAll("_", " ").toUpperCase();
		sections.push(`--- ${personaLabel} PERSONA ---`);

		if (data.vision) {
			sections.push(`Vision: ${String(data.vision)}`);
		}

		if (Array.isArray(data.milestones)) {
			sections.push("Milestones:");
			for (const milestone of data.milestones) {
				const m = milestone as Record<string, unknown>;
				sections.push(`  - ${m.title ?? "Untitled milestone"}`);
				if (m.description) {
					sections.push(`    ${String(m.description)}`);
				}
				if (Array.isArray(m.initiatives)) {
					for (const initiative of m.initiatives) {
						const ini = initiative as Record<string, unknown>;
						sections.push(`      • ${ini.title ?? "Untitled initiative"}`);
					}
				}
			}
		}

		sections.push("");
	}

	return sections.join("\n");
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Create persona roadmap records for all 4 personas.
 * Each record starts with status='pending'.
 */
export async function createPersonaRoadmaps(
	db: ProjectDb,
	roadmapId: string,
): Promise<PersonaRoadmapRow[]> {
	const now = Date.now();

	const rows = await db.transaction().execute(async (tx) => {
		const result: PersonaRoadmapRow[] = [];

		for (const persona of PERSONAS) {
			const id = generateId("persona");

			await tx
				.insertInto("persona_roadmaps")
				.values({
					id,
					roadmap_id: roadmapId,
					persona,
					session_id: null,
					roadmap_data: null,
					status: "pending",
					created_at: now,
					updated_at: now,
				})
				.execute();

			result.push({
				id,
				roadmapId,
				persona,
				sessionId: null,
				roadmapData: null,
				status: "pending",
				createdAt: now,
				updatedAt: now,
			});
		}

		return result;
	});

	return rows;
}

/**
 * Update a persona roadmap's session ID and set status to 'running'.
 */
export async function updatePersonaSession(
	db: ProjectDb,
	personaRoadmapId: string,
	sessionId: string,
): Promise<void> {
	const now = Date.now();

	await db
		.updateTable("persona_roadmaps")
		.set({
			session_id: sessionId,
			status: "running",
			updated_at: now,
		})
		.where("id", "=", personaRoadmapId)
		.execute();
}

/**
 * Atomically mark a persona roadmap as completed and check whether all siblings are done.
 *
 * Uses a SQLite transaction to ensure that when two personas complete near-simultaneously,
 * only one caller observes `allDone === true`. SQLite serializes write transactions,
 * so the complete-then-check sequence is atomic.
 */
export async function completePersonaAndCheckDone(
	db: ProjectDb,
	personaRoadmapId: string,
	roadmapData: unknown,
): Promise<PersonaCompletionResult> {
	const now = Date.now();
	const roadmapDataJson = JSON.stringify(roadmapData);

	const result = await db.transaction().execute(async (tx) => {
		// 1. Mark the persona roadmap as completed (only if still running — idempotency guard)
		const updateResult = await tx
			.updateTable("persona_roadmaps")
			.set({
				roadmap_data: roadmapDataJson,
				status: "completed",
				updated_at: now,
			})
			.where("id", "=", personaRoadmapId)
			.where("status", "=", "running")
			.execute();

		// If no rows updated, the persona was already completed (or failed) — skip re-evaluation
		if (Number(updateResult[0]?.numUpdatedRows ?? 0) === 0) {
			const row = await tx
				.selectFrom("persona_roadmaps")
				.select("roadmap_id")
				.where("id", "=", personaRoadmapId)
				.executeTakeFirstOrThrow();
			return { allDone: false, roadmapId: row.roadmap_id };
		}

		// 2. Read back the completed row for the roadmap_id
		const row = await tx
			.selectFrom("persona_roadmaps")
			.selectAll()
			.where("id", "=", personaRoadmapId)
			.executeTakeFirst();

		if (!row) {
			throw new Error(
				`Persona roadmap ${personaRoadmapId} not found after update`,
			);
		}

		// 3. Count siblings still in non-terminal state (pending or running)
		const pendingCount = await tx
			.selectFrom("persona_roadmaps")
			.select(tx.fn.countAll().as("count"))
			.where("roadmap_id", "=", row.roadmap_id)
			.where("status", "not in", ["completed", "failed"])
			.executeTakeFirstOrThrow();

		const allDone = Number(pendingCount.count) === 0;

		return { allDone, roadmapId: row.roadmap_id };
	});

	return result;
}

/**
 * Retrieve all persona roadmap records for a roadmap, ordered by persona.
 * Parses roadmap_data JSON for completed records.
 */
export async function getPersonaRoadmaps(
	db: ProjectDb,
	roadmapId: string,
): Promise<PersonaRoadmapRow[]> {
	const rows = await db
		.selectFrom("persona_roadmaps")
		.selectAll()
		.where("roadmap_id", "=", roadmapId)
		.orderBy("persona", "asc")
		.execute();

	return rows.map(toPersonaRoadmapRow);
}

/**
 * Retrieve a single persona roadmap record by ID.
 */
export async function getPersonaRoadmap(
	db: ProjectDb,
	personaRoadmapId: string,
): Promise<PersonaRoadmapRow | undefined> {
	const row = await db
		.selectFrom("persona_roadmaps")
		.selectAll()
		.where("id", "=", personaRoadmapId)
		.executeTakeFirst();

	return row ? toPersonaRoadmapRow(row) : undefined;
}

/**
 * Start a synthesis session after all 4 persona roadmaps have completed.
 *
 * Retrieves all completed persona roadmaps, formats them into a structured
 * user message, creates a new synthesis session, and fires off the agent
 * run in the background. Follows the resumeCoordinatorSession pattern
 * from subtasks.ts but adapted for synthesis.
 */
export function startSynthesisSession(
	projectRoot: string,
	roadmapId: string,
	db: ProjectDb,
): void {
	const sessionManager = getSessionManager();

	db.selectFrom("persona_roadmaps")
		.selectAll()
		.where("roadmap_id", "=", roadmapId)
		.where("status", "=", "completed")
		.orderBy("persona", "asc")
		.execute()
		.then(async (rows) => {
			if (rows.length < PERSONAS.length) {
				log.tools.error(
					`Cannot start synthesis for roadmap ${roadmapId}: only ${rows.length}/${PERSONAS.length} personas completed`,
				);
				return;
			}

			const message = formatSynthesisMessage(rows);

			const session = await sessionManager.startSession({
				contextType: "roadmap",
				contextId: roadmapId,
				agentRole: "synthesis",
			});

			const { conversations: conversationRepo } = getRepositories();
			const runner = new AgentRunner(session, {
				projectRoot,
				conversationRepo,
			});

			runner.run(message).catch((err) => {
				const errorMsg = err instanceof Error ? err.message : "unknown error";
				log.tools.error(
					`Synthesis session failed for roadmap ${roadmapId}: ${errorMsg}`,
				);
			});
		})
		.catch((err) => {
			const errorMsg = err instanceof Error ? err.message : "unknown error";
			log.tools.error(
				`Failed to start synthesis session for roadmap ${roadmapId}: ${errorMsg}`,
			);
		});
}
