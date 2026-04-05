/**
 * BaseAgentRunner - Shared base class for agent execution backends
 *
 * Contains:
 * - Session and config fields
 * - Post-turn logic (nudge, continue, auto-transition)
 * - DB persistence helpers (turns, messages, tools, thoughts)
 * - Context helpers (notes, todos, tool context)
 * - Terminal tool detection constants
 *
 * Subclasses implement run() with their specific LLM backend.
 */

import { getProjectDb } from "@/backend/db/project";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import {
	createChannelToolContext,
	createRoadmapToolContext,
	createWorkflowToolContext,
} from "@/backend/llm";
import type { ToolContext } from "@/backend/tools/types";
import { ids } from "@/backend/utils/ids";
import { broadcast } from "@/backend/ws";
import {
	createTurnCompletedEvent,
	createTurnSegmentCompleteEvent,
	createTurnStartedEvent,
	createTurnToolCompletedEvent,
	createTurnToolStartedEvent,
} from "@/shared/schemas/events";
import { getAgentConfig } from "../registry";
import type { IAgentRunner } from "./IAgentRunner";
import type {
	ActiveSession,
	RunnerConfig,
	RunOptions,
	ToolCall,
	Turn,
} from "./types";
import { getWorkflowOrchestrator } from "./WorkflowOrchestrator";

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of nudges per user message */
export const MAX_NUDGES = 12;

/**
 * Terminal tools by agent role - these tools signal a valid turn ending.
 * If an agent completes a turn without calling one of these, it gets nudged.
 */
export const TERMINAL_TOOLS: Record<string, string[]> = {
	scoping: ["submit_scope", "request_extension", "ask_questions"],
	research: ["submit_research", "request_extension", "ask_questions"],
	planning: ["submit_plan", "request_extension", "ask_questions"],
	execution: ["complete_pulse", "request_extension"],
	review: ["complete_review", "spawn_review_tasks", "request_extension"],
	review_sub: ["submit_sub_review", "request_extension"],
	roadmap_planning: ["submit_roadmap", "request_extension", "ask_questions"],
	visionary: [
		"submit_persona_roadmap",
		"submit_roadmap",
		"ask_questions",
		"request_extension",
	],
	iterative: [
		"submit_persona_roadmap",
		"submit_roadmap",
		"ask_questions",
		"request_extension",
	],
	tech_lead: [
		"submit_persona_roadmap",
		"submit_roadmap",
		"ask_questions",
		"request_extension",
	],
	pathfinder: [
		"submit_persona_roadmap",
		"submit_roadmap",
		"ask_questions",
		"request_extension",
	],
	synthesis: ["submit_roadmap", "request_extension", "ask_questions"],
	// discussion and basic agents don't require terminal tools
	discussion: [],
	basic: [],
};

/** Labels for persona roles, used in dynamic nudge messages */
const PERSONA_LABELS: Record<string, string> = {
	visionary: "roadmap vision",
	iterative: "incremental roadmap plan",
	tech_lead: "technical roadmap assessment",
	pathfinder: "strategic roadmap proposal",
};

/**
 * Build a dynamic nudge message for persona roles based on the actual submit tool available.
 */
function buildPersonaNudge(role: string, submitToolName: string): string {
	const label = PERSONA_LABELS[role] ?? "roadmap proposal";
	return `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`${submitToolName}\` — if you have finalized your roadmap proposal
- \`ask_questions\` — if you need clarification from the user
- \`request_extension\` — if you need another turn to explore or refine

Please finalize your ${label} and use \`${submitToolName}\` to submit your proposal.`;
}

/**
 * Nudge messages by agent role - sent when agent doesn't use a terminal tool.
 * Persona roles (visionary, iterative, tech_lead, pathfinder) use null here
 * and are generated dynamically via buildPersonaNudge() based on actual tools.
 */
const NUDGE_MESSAGES: Record<string, string | null> = {
	scoping: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_scope\` — if you have enough information to define the scope
- \`ask_questions\` — if you need clarification from the user

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_scope\` and yield to the user.`,

	research: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_research\` — if you have sufficient understanding to guide implementation
- \`request_extension\` — if any investigation remains
- \`ask_questions\` — if user input is required to resolve ambiguity

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_research\` and yield to the user.`,

	planning: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_plan\` — if you have a complete implementation plan
- \`ask_questions\` — if you need clarification from the user

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_plan\` and yield to the user.`,

	execution: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`complete_pulse\` — if you have completed this pulse's work
- \`request_extension\` — if additional work remains

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`complete_pulse\` and yield to the user.`,

	review: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`complete_review\` — if you have completed the review
- \`spawn_review_tasks\` — if you are delegating to sub-reviewers

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`complete_review\` and yield to the user.`,

	review_sub: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_sub_review\` — if you have completed your review of the assigned files
- \`request_extension\` — if additional review work remains

Please complete your review of the assigned files and call submit_sub_review with your findings.`,

	roadmap_planning: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_roadmap\` — if you have enough information to generate the roadmap
- \`ask_questions\` — if you need more information from the user
- \`request_extension\` — if you need another turn to explore or synthesize

Please continue planning the roadmap. If you have enough information, call \`submit_roadmap\` to finalize.`,

	visionary: null, // Dynamic - generated by buildPersonaNudge()
	iterative: null, // Dynamic - generated by buildPersonaNudge()
	tech_lead: null, // Dynamic - generated by buildPersonaNudge()
	pathfinder: null, // Dynamic - generated by buildPersonaNudge()

	synthesis: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_roadmap\` — if you have synthesized the final roadmap
- \`ask_questions\` — if you need the user to resolve conflicts between personas
- \`request_extension\` — if you need another turn to analyze and merge proposals

Please continue synthesizing the persona roadmaps. If you have a final merged roadmap, call \`submit_roadmap\` to finalize.`,
};

// =============================================================================
// BaseAgentRunner
// =============================================================================

export abstract class BaseAgentRunner implements IAgentRunner {
	protected readonly session: ActiveSession;
	protected readonly config: RunnerConfig;

	constructor(session: ActiveSession, config: RunnerConfig) {
		this.session = session;
		this.config = config;
	}

	// ===========================================================================
	// Abstract - implemented by subclasses
	// ===========================================================================

	abstract run(
		userMessage: string,
		options?: RunOptions,
		nudgeCount?: number,
		cacheUserMessage?: boolean,
	): Promise<void>;

	// ===========================================================================
	// Post-Turn Logic
	// ===========================================================================

	/**
	 * Check if the turn ended with a terminal tool; if not, nudge the agent
	 */
	protected async maybeNudge(
		turnId: string,
		options: RunOptions,
		currentNudgeCount: number,
		actualTools: readonly { name: string }[],
	): Promise<void> {
		const role = this.session.agentRole;
		const allTerminalTools = TERMINAL_TOOLS[role];

		// Skip nudging for roles that don't require terminal tools
		if (!allTerminalTools || allTerminalTools.length === 0) {
			return;
		}

		// Filter terminal tools to only those the agent actually has
		const actualToolNames = new Set(actualTools.map((t) => t.name));
		const terminalTools = allTerminalTools.filter((t) =>
			actualToolNames.has(t),
		);

		// Check if we've exceeded max nudges
		if (currentNudgeCount >= MAX_NUDGES) {
			log.agent.warn(
				`Agent [${role}] did not use terminal tool after ${MAX_NUDGES} nudges - giving up`,
			);
			return;
		}

		// Query tool names via repository
		const toolNames =
			await this.config.conversationRepo.getSucceededToolNames(turnId);
		const hasTerminalTool = toolNames.some((name) =>
			terminalTools.includes(name),
		);

		if (hasTerminalTool) {
			log.agent.debug(`Turn ended with terminal tool: ${toolNames.join(", ")}`);
			return;
		}

		// No terminal tool - nudge the agent
		// For persona roles, build a dynamic nudge based on the actual submit tool
		const submitTool = terminalTools.find((t) => t.startsWith("submit_"));
		const nudgeMessage =
			NUDGE_MESSAGES[role] ??
			(submitTool ? buildPersonaNudge(role, submitTool) : null);
		if (!nudgeMessage) {
			log.agent.warn(`No nudge message configured for role: ${role}`);
			return;
		}

		log.agent.info(
			`Agent [${role}] did not use terminal tool (tools called: ${toolNames.join(", ") || "none"}, expected: ${terminalTools.join(", ")}) - nudging`,
		);

		// Recursively call run with the nudge message
		await this.run(nudgeMessage, options, currentNudgeCount + 1, true);
	}

	/**
	 * Check if the turn ended with request_extension; if so, auto-continue
	 */
	protected async maybeContinue(
		turnId: string,
		options: RunOptions,
	): Promise<void> {
		// Query tool names for this turn
		const toolNames =
			await this.config.conversationRepo.getSucceededToolNames(turnId);

		// Check if request_extension was called
		if (!toolNames.includes("request_extension")) {
			return;
		}

		// Check if a "completion" terminal tool was also called - those take precedence
		// over request_extension. This handles the case where the agent mistakenly
		// calls both (e.g., submit_research AND request_extension in the same turn)
		const role = this.session.agentRole;
		const terminalTools = TERMINAL_TOOLS[role] ?? [];
		const completionTools = terminalTools.filter(
			(t) => t !== "request_extension",
		);
		const hasCompletionTool = toolNames.some((name) =>
			completionTools.includes(name),
		);

		if (hasCompletionTool) {
			log.agent.warn(
				`Agent called both request_extension and a completion tool (${toolNames.join(", ")}) - ignoring extension`,
			);
			return;
		}

		log.agent.info(`Agent requested extension - auto-continuing`);

		// Continue with a simple prompt (reset nudge count for fresh allowance)
		// Hide the continuation message from UI
		await this.run("Continue.", { ...options, hidden: true }, 0, true);
	}

	/**
	 * Check if auto-transition tools were called and trigger deferred transitions
	 *
	 * For complete_preflight and complete_pulse, the actual transition (starting
	 * the next session) is deferred to here so we don't abort the stream mid-turn.
	 *
	 * NOTE: We only trigger transitions for tools that actually succeeded.
	 * If complete_pulse fails (e.g., verification errors), we don't transition.
	 */
	protected async maybeAutoTransition(turnId: string): Promise<void> {
		// Only workflow sessions can have auto-transitions.
		// Subtask sessions (contextType === 'subtask') are excluded here — their
		// lifecycle is managed by the coordinator via submit_sub_review, not by
		// the workflow orchestrator.
		if (this.session.contextType !== "workflow") {
			return;
		}

		// Only check tools that succeeded (status="completed", not "error")
		// This ensures we don't trigger transitions when complete_pulse/complete_preflight failed
		const succeededToolNames =
			await this.config.conversationRepo.getSucceededToolNames(turnId);

		// Check if any auto-transition tools succeeded
		const hasPreflightComplete =
			succeededToolNames.includes("complete_preflight");
		const hasPulseComplete = succeededToolNames.includes("complete_pulse");

		if (!hasPreflightComplete && !hasPulseComplete) {
			return;
		}

		// Trigger the deferred transition via orchestrator
		try {
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handleTurnCompletion(
				this.session.contextId, // workflowId
				succeededToolNames,
			);
		} catch (error) {
			log.agent.error(
				`Failed to handle auto-transition for workflow ${this.session.contextId}:`,
				error,
			);
			// Don't re-throw - the turn already completed successfully
		}
	}

	// ===========================================================================
	// Tool Context
	// ===========================================================================

	/**
	 * Create the appropriate tool context based on session type
	 */
	protected async createToolContext(
		toolResultMap: Map<string, boolean>,
		turnId?: string,
	): Promise<ToolContext> {
		if (this.session.contextType === "channel") {
			return await createChannelToolContext(
				this.config.projectRoot,
				this.session.contextId,
				this.session.id,
				toolResultMap,
			);
		}
		if (this.session.contextType === "roadmap") {
			return await createRoadmapToolContext(
				this.config.projectRoot,
				this.session.contextId,
				this.session.id,
				toolResultMap,
				turnId,
				this.session.agentRole,
			);
		}
		// Subtask sessions store the subtask ID as contextId — look up the
		// parent workflow ID so the tool context points at the right workflow.
		if (this.session.contextType === "subtask") {
			const db = await getProjectDb(this.config.projectRoot);
			const subtask = await db
				.selectFrom("subtasks")
				.where("id", "=", this.session.contextId)
				.selectAll()
				.executeTakeFirst();

			if (!subtask) {
				throw new Error(`Subtask not found: ${this.session.contextId}`);
			}

			const ctx = await createWorkflowToolContext(
				this.config.projectRoot,
				subtask.workflow_id,
				this.session.id,
				toolResultMap,
				turnId,
				this.config.worktreePath,
				this.session.agentRole,
			);

			return { ...ctx, subtaskId: this.session.contextId };
		}
		// Persona sessions store the persona_roadmaps record ID as contextId —
		// look up the parent roadmap ID so the tool context points at the right roadmap.
		if (this.session.contextType === "persona") {
			const db = await getProjectDb(this.config.projectRoot);
			const personaRecord = await db
				.selectFrom("persona_roadmaps")
				.where("id", "=", this.session.contextId)
				.selectAll()
				.executeTakeFirst();

			if (!personaRecord) {
				throw new Error(`Persona roadmap not found: ${this.session.contextId}`);
			}

			const ctx = await createRoadmapToolContext(
				this.config.projectRoot,
				personaRecord.roadmap_id,
				this.session.id,
				toolResultMap,
				turnId,
				this.session.agentRole,
			);

			return { ...ctx, personaRoadmapId: this.session.contextId };
		}

		return await createWorkflowToolContext(
			this.config.projectRoot,
			this.session.contextId,
			this.session.id,
			toolResultMap,
			turnId,
			this.config.worktreePath,
			this.session.agentRole,
		);
	}

	// ===========================================================================
	// Context Helpers (Notes & Todos)
	// ===========================================================================

	/**
	 * Build a note content string for the current context.
	 *
	 * Notes have different scoping based on context:
	 * - Channels: Notes persist across the entire channel lifetime (query by context_id)
	 * - Workflows: Notes are ephemeral per stage (query by session_id)
	 *
	 * Returns null if no notes exist.
	 */
	protected async buildNotesContent(): Promise<string | null> {
		const repo = this.config.conversationRepo;
		let notes: Array<{ id: string; content: string; createdAt: number }>;

		if (this.session.contextType === "workflow") {
			// For workflows: notes are ephemeral per stage (session)
			notes = await repo.getNotes(
				"workflow",
				this.session.contextId,
				this.session.id,
			);
		} else {
			// For others: notes persist across context lifetime
			notes = await repo.getNotes(
				this.session.contextType,
				this.session.contextId,
			);
		}

		if (notes.length === 0) {
			return null;
		}

		// Format notes
		const formattedNotes = notes
			.map((note, index) => `[Note ${index + 1}] ${note.content}`)
			.join("\n\n");

		return `## Your Notes\n\nYou have saved the following notes for yourself:\n\n${formattedNotes}`;
	}

	/**
	 * Build formatted todo list content for context injection.
	 *
	 * Returns null if no todos exist.
	 */
	protected async buildTodosContent(): Promise<string | null> {
		const repo = this.config.conversationRepo;
		let todos: Array<{
			id: string;
			title: string;
			description: string;
			checked: number;
			sortOrder: number;
		}>;

		if (this.session.contextType === "workflow") {
			// For workflows: todos are ephemeral per stage (session)
			todos = await repo.getTodos(
				"workflow",
				this.session.contextId,
				this.session.id,
			);
		} else {
			// For others: todos persist across context lifetime
			todos = await repo.getTodos(
				this.session.contextType,
				this.session.contextId,
			);
		}

		if (todos.length === 0) {
			return null;
		}

		// Format todos
		const formattedTodos = todos
			.map((item) => {
				const checkbox = item.checked ? "[x]" : "[ ]";
				const line = `- ${checkbox} (${item.id}) ${item.title}`;
				if (item.description) {
					return `${line}\n    ${item.description}`;
				}
				return line;
			})
			.join("\n");

		return `## Your Todo List\n\n${formattedTodos}`;
	}

	// ===========================================================================
	// Turn Management
	// ===========================================================================

	protected async createTurn(
		role: "user" | "assistant",
		hidden: boolean,
		turnIndex: number,
	): Promise<Turn> {
		const repo = this.config.conversationRepo;

		// Use repository for DB operation
		const turnData = await repo.createTurn({
			sessionId: this.session.id,
			turnIndex,
			role,
			hidden,
		});

		const turn: Turn = {
			id: turnData.id,
			sessionId: this.session.id,
			turnIndex,
			role,
			status: "streaming",
			hidden,
			createdAt: turnData.createdAt,
		};

		// For review agent assistant turns, associate orphaned review cards with this turn
		if (
			role === "assistant" &&
			this.session.contextType === "workflow" &&
			this.session.agentRole === "review"
		) {
			const { artifacts } = getRepositories();
			await artifacts.setReviewCardTurnId(this.session.contextId, turn.id);
		}

		// Don't broadcast turn started for hidden turns
		if (!hidden) {
			broadcast(
				createTurnStartedEvent({
					sessionId: this.session.id,
					turnId: turn.id,
					role,
					contextType: this.session.contextType,
					contextId: this.session.contextId,
					agentRole: this.session.agentRole,
					pulseId: this.session.pulseId,
				}),
			);
		}

		return turn;
	}

	protected async completeTurn(
		turnId: string,
		usage?: {
			tokenCount?: number;
			promptTokens?: number;
			completionTokens?: number;
			cacheWriteTokens?: number;
			cacheReadTokens?: number;
			uncachedPromptTokens?: number;
			modelId?: string;
			cost?: number;
		},
	): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.completeTurn(turnId, usage);

		// Insert immutable cost record for tracking real provider charges
		if (
			usage?.modelId &&
			usage.promptTokens != null &&
			usage.completionTokens != null &&
			usage.cost != null &&
			usage.cost > 0
		) {
			try {
				await getRepositories().costRecords.insert({
					id: ids.cost(),
					contextType: this.session.contextType,
					contextId: this.session.contextId,
					turnId,
					sessionId: this.session.id,
					modelId: usage.modelId,
					agentRole: this.session.agentRole,
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					cacheWriteTokens: usage.cacheWriteTokens,
					cacheReadTokens: usage.cacheReadTokens,
					uncachedPromptTokens: usage.uncachedPromptTokens,
					costUsd: usage.cost,
					createdAt: Date.now(),
				});
			} catch (error) {
				log.agent.error("Failed to insert cost record", error);
			}
		} else if (
			(usage?.cost == null || usage?.cost === 0) &&
			(usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0) > 0
		) {
			log.agent.warn(
				`Cost is ${usage?.cost ?? "null"} but tokens were consumed (prompt: ${usage?.promptTokens}, completion: ${usage?.completionTokens}, model: ${usage?.modelId ?? "unknown"}) - missing pricing configuration?`,
			);
		}

		broadcast(
			createTurnCompletedEvent({
				sessionId: this.session.id,
				turnId,
				tokenCount: usage?.tokenCount,
				costUsd: usage?.cost,
				contextType: this.session.contextType,
				contextId: this.session.contextId,
				agentRole: this.session.agentRole,
				pulseId: this.session.pulseId,
			}),
		);
	}

	protected async errorTurn(turnId: string, _error: string): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.errorTurn(turnId);
	}

	// ===========================================================================
	// Message Management
	// ===========================================================================

	protected async saveMessage(
		turnId: string,
		messageIndex: number,
		content: string,
	): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.saveMessage(
			turnId,
			messageIndex,
			content,
		);
	}

	// ===========================================================================
	// Tool Tracking
	// ===========================================================================

	/**
	 * Record a tool call starting
	 */
	protected async recordToolStart(
		turnId: string,
		toolIndex: number,
		toolCallId: string,
		toolName: string,
		input: unknown,
	): Promise<ToolCall> {
		const now = Date.now();

		// Extract reason from input if present (our tools include a reason param)
		const reason =
			typeof input === "object" &&
			input !== null &&
			"reason" in input &&
			typeof (input as Record<string, unknown>).reason === "string"
				? ((input as Record<string, unknown>).reason as string)
				: null;

		// Use repository with explicit ID from AI SDK
		const id = await this.config.conversationRepo.recordToolStart({
			originalToolCallId: toolCallId,
			turnId,
			toolIndex,
			toolName,
			reason,
			input,
		});

		const toolCall: ToolCall = {
			id,
			originalToolCallId: toolCallId,
			turnId,
			toolIndex,
			toolName,
			reason: reason ?? undefined,
			input,
			status: "running",
			startedAt: now,
		};

		// Broadcast start event
		broadcast(
			createTurnToolStartedEvent({
				sessionId: this.session.id,
				turnId,
				toolId: toolCall.id,
				index: toolIndex,
				name: toolName,
				originalToolCallId: toolCall.originalToolCallId,
				input,
			}),
		);

		return toolCall;
	}

	/**
	 * Record a tool call completing
	 */
	protected async recordToolComplete(
		toolCall: ToolCall,
		output: unknown,
		success: boolean,
	): Promise<void> {
		const now = Date.now();

		toolCall.output = output;
		toolCall.status = success ? "completed" : "error";
		toolCall.completedAt = now;

		// Use repository for DB operation with safe JSON serialization
		await this.config.conversationRepo.recordToolComplete(
			toolCall.id,
			output,
			success,
		);

		// Broadcast completion event
		broadcast(
			createTurnToolCompletedEvent({
				sessionId: this.session.id,
				turnId: toolCall.turnId,
				toolId: toolCall.id,
				output,
				success,
			}),
		);
	}

	// ===========================================================================
	// Thought Management (Extended Thinking)
	// ===========================================================================

	/**
	 * Save a thought block from extended thinking
	 */
	protected async saveThought(
		turnId: string,
		thoughtIndex: number,
		content: string,
	): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.saveThought(
			turnId,
			thoughtIndex,
			content,
		);
	}
}
