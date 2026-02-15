/**
 * Test helpers barrel export
 *
 * Re-exports all fixture factories, mock repositories, mock services,
 * and the centralized mock.module setup for WorkflowOrchestrator tests.
 */

export {
	createMockActiveSession,
	createMockPlan,
	createMockPulse,
	createMockResearchCard,
	createMockReviewCard,
	createMockScopeCard,
	createMockWorkflow,
} from "./fixtures";

export {
	getLastAgentRunnerInstance,
	MockAgentRunnerClass,
	mockAgentRunnerRun,
	resetMockAgentRunner,
} from "./mockAgentRunner";

export {
	mockArtifactRepo,
	mockBroadcast,
	mockCheckoutInWorktree,
	mockCleanupWorkflow,
	mockConversationRepo,
	mockExtractKnowledge,
	mockFindRepoRoot,
	mockGenerateObject,
	mockGetCurrentBranch,
	mockGetDiff,
	mockGetModelForScenario,
	mockGetProjectRoot,
	mockGetRepositories,
	mockGetWorktreePath,
	mockIds,
	mockLog,
	mockMergeWorkflowBranch,
	mockPulseRepo,
	mockSearchKnowledge,
	mockShellApprovalService,
	mockWorkflowRepo,
	setupMockModules,
} from "./mockModules";

export {
	createMockPulseOrchestrator,
	MockPulseOrchestratorClass,
	mockPulseOrchestratorInstance,
	resetMockPulseOrchestrator,
} from "./mockPulseOrchestrator";

export {
	createMockArtifactRepo,
	createMockConversationRepo,
	createMockPulseRepo,
	createMockWorkflowRepo,
} from "./mockRepositories";

export { createMockSessionManager } from "./mockSessionManager";
