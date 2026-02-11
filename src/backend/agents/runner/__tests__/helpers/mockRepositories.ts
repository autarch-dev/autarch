/**
 * Mock repository factories
 *
 * Each factory returns an object with all repository methods as mock functions
 * with sensible default return values. Tests can reconfigure individual mocks
 * via mockImplementation/mockReturnValue.
 */

import { mock } from "bun:test";
import {
	createMockPlan,
	createMockPulse,
	createMockResearchCard,
	createMockReviewCard,
	createMockScopeCard,
	createMockWorkflow,
} from "./fixtures";

// =============================================================================
// WorkflowRepository
// =============================================================================

export function createMockWorkflowRepo() {
	return {
		getById: mock(() => Promise.resolve(createMockWorkflow())),
		getAll: mock(() => Promise.resolve([])),
		getBySessionId: mock(() => Promise.resolve(createMockWorkflow())),
		create: mock(() => Promise.resolve(createMockWorkflow())),
		delete: mock(() => Promise.resolve()),
		updateStatus: mock(() => Promise.resolve()),
		setCurrentSession: mock(() => Promise.resolve()),
		setAwaitingApproval: mock(() => Promise.resolve()),
		clearAwaitingApproval: mock(() => Promise.resolve()),
		transitionStage: mock(() => Promise.resolve()),
		setBaseBranch: mock(() => Promise.resolve()),
		setSkippedStages: mock(() => Promise.resolve()),
	};
}

// =============================================================================
// ArtifactRepository
// =============================================================================

export function createMockArtifactRepo() {
	return {
		getLatestScopeCard: mock(() => Promise.resolve(createMockScopeCard())),
		getLatestResearchCard: mock(() =>
			Promise.resolve(createMockResearchCard()),
		),
		getLatestPlan: mock(() => Promise.resolve(createMockPlan())),
		getLatestReviewCard: mock(() => Promise.resolve(createMockReviewCard())),
		saveScopeCard: mock(() => Promise.resolve(createMockScopeCard())),
		saveResearchCard: mock(() => Promise.resolve(createMockResearchCard())),
		savePlan: mock(() => Promise.resolve(createMockPlan())),
		saveReviewCard: mock(() => Promise.resolve(createMockReviewCard())),
		getScopeCards: mock(() => Promise.resolve([])),
		getResearchCards: mock(() => Promise.resolve([])),
		getPlans: mock(() => Promise.resolve([])),
		getReviewCards: mock(() => Promise.resolve([])),
		getReviewCardsByPulse: mock(() => Promise.resolve([])),
	};
}

// =============================================================================
// ConversationRepository
// =============================================================================

export function createMockConversationRepo() {
	return {
		getHistory: mock(() => Promise.resolve([])),
		createTurn: mock(() =>
			Promise.resolve({
				id: "turn-1",
				sessionId: "session-1",
				turnIndex: 0,
				role: "user" as const,
				status: "completed" as const,
				hidden: false,
				createdAt: Date.now(),
			}),
		),
		completeTurn: mock(() => Promise.resolve()),
		errorTurn: mock(() => Promise.resolve()),
		getCompletedTurns: mock(() => Promise.resolve([])),
		saveMessage: mock(() => Promise.resolve({ id: "msg-1" })),
		updateMessage: mock(() => Promise.resolve()),
		upsertMessage: mock(() => Promise.resolve()),
		getMessages: mock(() => Promise.resolve([])),
		recordToolStart: mock(() => Promise.resolve()),
		recordToolComplete: mock(() => Promise.resolve()),
		getTools: mock(() => Promise.resolve([])),
		getToolNames: mock(() => Promise.resolve([])),
		getSucceededToolNames: mock(() => Promise.resolve([])),
		saveThought: mock(() => Promise.resolve()),
		updateThought: mock(() => Promise.resolve()),
		upsertThought: mock(() => Promise.resolve()),
		getQuestionById: mock(() => Promise.resolve(null)),
		getQuestionsByTurn: mock(() => Promise.resolve([])),
		getPendingQuestions: mock(() => Promise.resolve([])),
		getPendingQuestionsByTurn: mock(() => Promise.resolve([])),
		answerQuestion: mock(() => Promise.resolve()),
		skipPendingQuestions: mock(() => Promise.resolve()),
		getNotes: mock(() => Promise.resolve([])),
		saveNote: mock(() => Promise.resolve()),
		getTodos: mock(() => Promise.resolve([])),
		loadSessionContext: mock(() => Promise.resolve([])),
	};
}

// =============================================================================
// PulseRepository
// =============================================================================

export function createMockPulseRepo() {
	return {
		getPulse: mock(() => Promise.resolve(createMockPulse())),
		getPulsesForWorkflow: mock(() => Promise.resolve([])),
		getNextProposedPulse: mock(() => Promise.resolve(null)),
		getRunningPulse: mock(() => Promise.resolve(createMockPulse())),
		createPulse: mock(() => Promise.resolve(createMockPulse())),
		createPulsesFromPlan: mock(() => Promise.resolve([])),
		startPulse: mock(() => Promise.resolve(createMockPulse())),
		completePulse: mock(() => Promise.resolve()),
		failPulse: mock(() => Promise.resolve()),
		stopPulse: mock(() => Promise.resolve()),
		incrementRejectionCount: mock(() => Promise.resolve(0)),
		updateDescription: mock(() => Promise.resolve()),
		getPreflightSetup: mock(() => Promise.resolve(null)),
		createPreflightSetup: mock(() =>
			Promise.resolve({
				id: "preflight-1",
				workflowId: "wf-1",
				status: "running" as const,
				createdAt: Date.now(),
			}),
		),
		updatePreflightProgress: mock(() => Promise.resolve()),
		completePreflightSetup: mock(() => Promise.resolve()),
		failPreflightSetup: mock(() => Promise.resolve()),
		recordBaseline: mock(() =>
			Promise.resolve({
				id: "baseline-1",
				workflowId: "wf-1",
				issueType: "error" as const,
				source: "build" as const,
				pattern: "test",
				recordedAt: Date.now(),
			}),
		),
		getBaselines: mock(() => Promise.resolve([])),
		getBaselinesBySource: mock(() => Promise.resolve([])),
		matchesBaseline: mock(() => Promise.resolve(false)),
		countBaselines: mock(() => Promise.resolve(0)),
		recordCommandBaseline: mock(() => Promise.resolve()),
		getCommandBaseline: mock(() => Promise.resolve(null)),
		deleteCommandBaselines: mock(() => Promise.resolve()),
		deleteByWorkflow: mock(() => Promise.resolve()),
		deletePreflightSetup: mock(() => Promise.resolve()),
		deleteBaselines: mock(() => Promise.resolve()),
	};
}
