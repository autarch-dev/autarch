/**
 * Centralized ID generation utilities
 *
 * All entity IDs in the system use a consistent format:
 * {prefix}_{timestamp_base36}_{random_base36}
 *
 * This provides:
 * - Uniqueness via timestamp + random component
 * - Sortability (IDs created later sort after earlier ones)
 * - Human readability (prefix indicates entity type)
 */

/**
 * Generate a unique ID with the given prefix
 */
export function generateId(prefix: string): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${timestamp}_${random}`;
}

/**
 * Pre-configured ID generators for all entity types
 */
export const ids = {
	channel: () => generateId("channel"),
	workflow: () => generateId("workflow"),
	session: () => generateId("session"),
	turn: () => generateId("turn"),
	toolCall: () => generateId("toolcall"),
	message: () => generateId("message"),
	thought: () => generateId("thought"),
	scopeCard: () => generateId("scope"),
	researchCard: () => generateId("research"),
	plan: () => generateId("plan"),
	pulse: () => generateId("pulse"),
	preflight: () => generateId("preflight"),
	baseline: () => generateId("baseline"),
	question: () => generateId("question"),
	note: () => generateId("note"),
	todo: () => generateId("todo"),
	reviewCard: () => generateId("review"),
	reviewComment: () => generateId("comment"),
	knowledge: () => generateId("knowledge"),
	roadmap: () => generateId("roadmap"),
	milestone: () => generateId("milestone"),
	initiative: () => generateId("initiative"),
	vision: () => generateId("vision"),
	dep: () => generateId("dep"),
	subtask: () => generateId("subtask"),
	cost: () => generateId("cost"),
	stageTransition: () => generateId("stagetx"),
	workflowError: () => generateId("wferror"),
} as const;
