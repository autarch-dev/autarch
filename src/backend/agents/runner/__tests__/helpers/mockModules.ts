/**
 * Centralized mock.module() setup
 *
 * Exports setupMockModules() which registers all 12 module-level mocks
 * required before importing WorkflowOrchestrator.
 *
 * Also exports references to each mock so tests can reconfigure them.
 * Call setupMockModules() once at the top of the test file (before any WO import).
 */

import { mock } from "bun:test";
import { MockAgentRunnerClass, mockAgentRunnerRun } from "./mockAgentRunner";
import {
	MockPulseOrchestratorClass,
	mockPulseOrchestratorInstance,
} from "./mockPulseOrchestrator";
import {
	createMockArtifactRepo,
	createMockConversationRepo,
	createMockPulseRepo,
	createMockWorkflowRepo,
} from "./mockRepositories";

// =============================================================================
// Git mocks
// =============================================================================

export const mockCheckoutInWorktree = mock(() => Promise.resolve());
export const mockCleanupWorkflow = mock(() => Promise.resolve());
export const mockFindRepoRoot = mock(() => "/mock/root");
export const mockGetCurrentBranch = mock(() => Promise.resolve("main"));
export const mockGetDiff = mock(() => Promise.resolve("mock diff"));
export const mockGetWorktreePath = mock(() => "/mock/worktree");
export const mockMergeWorkflowBranch = mock(() =>
	Promise.resolve({ success: true, commitSha: "abc123" }),
);

// =============================================================================
// LLM mocks
// =============================================================================

export const mockGetModelForScenario = mock(() => "mock-model");

// =============================================================================
// Logger mock
// =============================================================================

const noOp = mock(() => {});

function createLogNamespace() {
	return {
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		debug: mock(() => {}),
	};
}

export const mockLog = {
	workflow: createLogNamespace(),
	agent: createLogNamespace(),
	knowledge: createLogNamespace(),
	info: noOp,
	warn: noOp,
	error: noOp,
	debug: noOp,
};

// =============================================================================
// Project root mock
// =============================================================================

export const mockGetProjectRoot = mock(() => "/mock/project");

// =============================================================================
// Repositories mock
// =============================================================================

export const mockWorkflowRepo = createMockWorkflowRepo();
export const mockArtifactRepo = createMockArtifactRepo();
export const mockConversationRepo = createMockConversationRepo();
export const mockPulseRepo = createMockPulseRepo();

export const mockGetRepositories = mock(() => ({
	workflows: mockWorkflowRepo,
	artifacts: mockArtifactRepo,
	conversations: mockConversationRepo,
	pulses: mockPulseRepo,
}));

// =============================================================================
// Knowledge DB + repository mocks (for AgentRunner injection persistence)
// =============================================================================

export const mockGetKnowledgeDb = mock(() => Promise.resolve({}));

export const mockInsertKnowledgeInjectionEvents = mock(() => Promise.resolve());

export class MockKnowledgeRepositoryClass {
	insertKnowledgeInjectionEvents = mockInsertKnowledgeInjectionEvents;
	constructor(_db: unknown) {}
}

// =============================================================================
// Knowledge service mock
// =============================================================================

export const mockExtractKnowledge = mock(() => Promise.resolve(undefined));
export const mockSearchKnowledge = mock(() => Promise.resolve([]));

// =============================================================================
// Shell approval mock
// =============================================================================

export const mockShellApprovalService = {
	isCommandRemembered: mock(() => Promise.resolve(false)),
	requestApproval: mock(() => Promise.resolve()),
	resolveApproval: mock(() => Promise.resolve()),
	cleanupSession: mock(() => Promise.resolve()),
	cleanupWorkflow: mock(() => Promise.resolve()),
	getPendingApproval: mock(() => null),
	getPendingApprovalCount: mock(() => 0),
	getAllPendingApprovals: mock(() => []),
};

// =============================================================================
// Utils mock
// =============================================================================

const mockIdFn = () => "mock-id";
export const mockIds = {
	channel: mock(mockIdFn),
	workflow: mock(mockIdFn),
	session: mock(mockIdFn),
	turn: mock(mockIdFn),
	message: mock(mockIdFn),
	thought: mock(mockIdFn),
	scopeCard: mock(mockIdFn),
	researchCard: mock(mockIdFn),
	plan: mock(mockIdFn),
	pulse: mock(mockIdFn),
	preflight: mock(mockIdFn),
	baseline: mock(mockIdFn),
	question: mock(mockIdFn),
	note: mock(mockIdFn),
	todo: mock(mockIdFn),
	reviewCard: mock(mockIdFn),
	reviewComment: mock(mockIdFn),
	knowledge: mock(mockIdFn),
	roadmap: mock(mockIdFn),
	milestone: mock(mockIdFn),
	initiative: mock(mockIdFn),
	vision: mock(mockIdFn),
	dep: mock(mockIdFn),
	subtask: mock(mockIdFn),
	cost: mock(mockIdFn),
};

// =============================================================================
// WebSocket mock
// =============================================================================

export const mockBroadcast = mock(() => {});

// =============================================================================
// AI (generateObject) mock
// =============================================================================

export const mockGenerateObject = mock(() =>
	Promise.resolve({
		object: {
			title: "Generated Title",
			description: "Generated description",
		},
	}),
);

// =============================================================================
// setupMockModules
// =============================================================================

/**
 * Register all mock.module() calls. Must be called before importing
 * WorkflowOrchestrator so that bun:test can intercept the imports.
 */
export function setupMockModules() {
	mock.module("@/backend/git", () => ({
		checkoutInWorktree: mockCheckoutInWorktree,
		cleanupWorkflow: mockCleanupWorkflow,
		findRepoRoot: mockFindRepoRoot,
		getCurrentBranch: mockGetCurrentBranch,
		getDiff: mockGetDiff,
		getWorktreePath: mockGetWorktreePath,
		mergeWorkflowBranch: mockMergeWorkflowBranch,
	}));

	mock.module("@/backend/llm/models", () => ({
		getModelForScenario: mockGetModelForScenario,
	}));

	mock.module("@/backend/logger", () => ({
		log: mockLog,
	}));

	mock.module("@/backend/projectRoot", () => ({
		getProjectRoot: mockGetProjectRoot,
	}));

	mock.module("@/backend/repositories", () => ({
		getRepositories: mockGetRepositories,
	}));

	mock.module("@/backend/services/knowledge", () => ({
		extractKnowledge: mockExtractKnowledge,
		searchKnowledge: mockSearchKnowledge,
	}));

	mock.module("@/backend/db/knowledge", () => ({
		getKnowledgeDb: mockGetKnowledgeDb,
	}));

	mock.module("@/backend/services/knowledge/repository", () => ({
		KnowledgeRepository: MockKnowledgeRepositoryClass,
	}));

	mock.module("@/backend/services/pulsing", () => ({
		PulseOrchestrator: MockPulseOrchestratorClass,
	}));

	mock.module("@/backend/services/shell-approval", () => ({
		shellApprovalService: mockShellApprovalService,
	}));

	mock.module("@/backend/utils", () => ({
		ids: mockIds,
	}));

	mock.module("@/backend/ws", () => ({
		broadcast: mockBroadcast,
	}));

	mock.module("@/backend/agents/runner/AgentRunner", () => ({
		AgentRunner: MockAgentRunnerClass,
	}));

	mock.module("ai", () => ({
		generateObject: mockGenerateObject,
	}));
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export {
	MockAgentRunnerClass,
	mockAgentRunnerRun,
	MockPulseOrchestratorClass,
	mockPulseOrchestratorInstance,
};
