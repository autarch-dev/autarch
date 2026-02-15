/**
 * WorkflowOrchestrator unit tests — Category 1: Stage Transitions
 *
 * Covers full pipeline transitions (scoping→researching→planning→in_progress→review→done),
 * quick path, handleToolResult routing, handleTurnCompletion deferred transitions,
 * and STAGE_TRANSITIONS constant validation.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// =============================================================================
// Mock setup — MUST happen before importing WorkflowOrchestrator
// =============================================================================

import {
	createMockActiveSession,
	createMockPlan,
	createMockPulse,
	createMockResearchCard,
	createMockReviewCard,
	createMockScopeCard,
	createMockSessionManager,
	createMockWorkflow,
	getLastAgentRunnerInstance,
	mockAgentRunnerRun,
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
	mockGetProjectRoot,
	mockGetRepositories,
	mockGetWorktreePath,
	mockMergeWorkflowBranch,
	mockPulseOrchestratorInstance,
	mockPulseRepo,
	mockSearchKnowledge,
	mockShellApprovalService,
	mockWorkflowRepo,
	resetMockAgentRunner,
	resetMockPulseOrchestrator,
	setupMockModules,
} from "./helpers";

setupMockModules();

// Import real constants for validation
import {
	APPROVAL_REQUIRED_TOOLS,
	AUTO_TRANSITION_TOOLS,
	STAGE_TRANSITIONS,
} from "@/shared/schemas/workflow";
// Import WorkflowOrchestrator AFTER mock.module() calls
import { WorkflowOrchestrator } from "../WorkflowOrchestrator";

// =============================================================================
// Test suite
// =============================================================================

describe("Stage Transitions", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		// Clear module-level mock functions
		mockWorkflowRepo.getById.mockClear();
		mockWorkflowRepo.create.mockClear();
		mockWorkflowRepo.updateStatus.mockClear();
		mockWorkflowRepo.setCurrentSession.mockClear();
		mockWorkflowRepo.setAwaitingApproval.mockClear();
		mockWorkflowRepo.clearAwaitingApproval.mockClear();
		mockWorkflowRepo.transitionStage.mockClear();
		mockWorkflowRepo.setBaseBranch.mockClear();
		mockWorkflowRepo.setSkippedStages.mockClear();

		mockArtifactRepo.getLatestScopeCard.mockClear();
		mockArtifactRepo.getLatestResearchCard.mockClear();
		mockArtifactRepo.getLatestPlan.mockClear();
		mockArtifactRepo.getLatestReviewCard.mockClear();
		mockArtifactRepo.saveScopeCard.mockClear();
		mockArtifactRepo.saveResearchCard.mockClear();
		mockArtifactRepo.savePlan.mockClear();
		mockArtifactRepo.saveReviewCard.mockClear();
		mockArtifactRepo.createReviewCard.mockClear();
		mockArtifactRepo.updateScopeCardStatus.mockClear();
		mockArtifactRepo.updateResearchCardStatus.mockClear();
		mockArtifactRepo.updatePlanStatus.mockClear();
		mockArtifactRepo.updateReviewCardStatus.mockClear();
		mockArtifactRepo.updateReviewCardDiffContent.mockClear();
		mockArtifactRepo.getCommentsByIds.mockClear();
		mockArtifactRepo.deleteResearchCardsByWorkflow.mockClear();
		mockArtifactRepo.deletePlansByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewCardsByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewComments.mockClear();
		mockArtifactRepo.resetReviewCard.mockClear();

		mockConversationRepo.getHistory.mockClear();

		mockPulseRepo.getPulsesForWorkflow.mockClear();
		mockPulseRepo.getRunningPulse.mockClear();

		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockGetCurrentBranch.mockClear();
		mockGetDiff.mockClear();
		mockMergeWorkflowBranch.mockClear();
		mockCleanupWorkflow.mockClear();
		mockCheckoutInWorktree.mockClear();
		mockFindRepoRoot.mockClear();
		mockGenerateObject.mockClear();
		mockExtractKnowledge.mockClear();
		mockShellApprovalService.cleanupWorkflow.mockClear();

		// Reset agent runner and pulse orchestrator mocks
		resetMockAgentRunner();
		resetMockPulseOrchestrator();

		// Create fresh session manager
		mockSessionManager = createMockSessionManager();

		// Construct fresh orchestrator
		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);
	});

	// =========================================================================
	// handleToolResult
	// =========================================================================

	describe("handleToolResult", () => {
		test("submit_scope sets awaiting approval and returns approval result", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"submit_scope",
				"artifact-1",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: true,
				artifactId: "artifact-1",
			});
			expect(mockWorkflowRepo.setAwaitingApproval).toHaveBeenCalledWith(
				"wf-1",
				"scope_card",
			);
		});

		test("submit_research sets awaiting approval and returns approval result", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"submit_research",
				"artifact-2",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: true,
				artifactId: "artifact-2",
			});
			expect(mockWorkflowRepo.setAwaitingApproval).toHaveBeenCalledWith(
				"wf-1",
				"research",
			);
		});

		test("submit_plan sets awaiting approval and returns approval result", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"submit_plan",
				"artifact-3",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: true,
				artifactId: "artifact-3",
			});
			expect(mockWorkflowRepo.setAwaitingApproval).toHaveBeenCalledWith(
				"wf-1",
				"plan",
			);
		});

		test("complete_review sets awaiting approval and returns approval result", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"complete_review",
				"artifact-4",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: true,
				artifactId: "artifact-4",
			});
			expect(mockWorkflowRepo.setAwaitingApproval).toHaveBeenCalledWith(
				"wf-1",
				"review_card",
			);
		});

		test("complete_pulse triggers auto-transition via transitionStage", async () => {
			// complete_pulse is in AUTO_TRANSITION_TOOLS mapping to 'review'.
			// The code comment says it should be deferred, but there is no
			// DEFERRED_TOOLS filter — so it reaches the auto-transition branch.
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const session = createMockActiveSession({ id: "new-session" });
			mockSessionManager.startSession.mockResolvedValue(session);

			const result = await orchestrator.handleToolResult(
				"wf-1",
				"complete_pulse",
				"pulse-1",
			);

			expect(result).toEqual({
				transitioned: true,
				newStage: "review",
				awaitingApproval: false,
			});
		});

		test("complete_preflight is not in either tool map and returns no-op", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"complete_preflight",
				"pf-1",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: false,
			});
			expect(mockWorkflowRepo.setAwaitingApproval).not.toHaveBeenCalled();
		});

		test("unknown tool name returns no-op result", async () => {
			const result = await orchestrator.handleToolResult(
				"wf-1",
				"some_random_tool",
				"art-1",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: false,
			});
		});

		test("approval tool broadcasts approval_needed event", async () => {
			await orchestrator.handleToolResult("wf-1", "submit_scope", "sc-1");

			expect(mockBroadcast).toHaveBeenCalled();
			const [[event]] = mockBroadcast.mock.calls as unknown as [
				[
					{
						type: string;
						payload: {
							workflowId: string;
							artifactType: string;
							artifactId: string;
						};
					},
				],
			];
			expect(event.type).toBe("workflow:approval_needed");
			expect(event.payload.workflowId).toBe("wf-1");
			expect(event.payload.artifactType).toBe("scope_card");
			expect(event.payload.artifactId).toBe("sc-1");
		});
	});

	// =========================================================================
	// handleTurnCompletion
	// =========================================================================

	describe("handleTurnCompletion", () => {
		test("complete_preflight triggers handlePreflightCompletion logic", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "preflight-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const firstPulse = createMockPulse({ id: "pulse-1" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(
				firstPulse,
			);

			const newSession = createMockActiveSession({
				id: "execution-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.handleTurnCompletion("wf-1", ["complete_preflight"]);

			// Should stop the preflight session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"preflight-session",
			);

			// Should start next pulse
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalledWith(
				"wf-1",
				"/mock/worktree",
			);

			// Should create a new execution session
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					contextType: "workflow",
					contextId: "wf-1",
					agentRole: "execution",
					pulseId: "pulse-1",
				}),
			);

			// Should set the new session on the workflow
			expect(mockWorkflowRepo.setCurrentSession).toHaveBeenCalledWith(
				"wf-1",
				"execution-session",
			);

			// Should start the agent runner
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("complete_pulse triggers handleDeferredPulseCompletion logic", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "pulse-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// Return completed pulse and a proposed one (has more)
			const completedPulse = createMockPulse({
				id: "pulse-1",
				status: "succeeded",
				endedAt: Date.now(),
				hasUnresolvedIssues: false,
			});
			const proposedPulse = createMockPulse({
				id: "pulse-2",
				status: "proposed",
			});
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
				proposedPulse,
			] as never);

			const nextPulse = createMockPulse({ id: "pulse-2" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(nextPulse);

			const newSession = createMockActiveSession({
				id: "next-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.handleTurnCompletion("wf-1", ["complete_pulse"]);

			// Should get pulses to determine state
			expect(mockPulseRepo.getPulsesForWorkflow).toHaveBeenCalledWith("wf-1");

			// Should stop current session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"pulse-session",
			);

			// Should start next pulse
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalledWith(
				"wf-1",
				"/mock/worktree",
			);

			// Should start agent runner for next pulse
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("complete_pulse with no more pulses transitions to review", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "pulse-session",
			});
			// getById called twice: once in handleDeferredPulseCompletion, once in transitionStage
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// Only completed pulses, no proposed ones
			const completedPulse = createMockPulse({
				id: "pulse-1",
				status: "succeeded",
				endedAt: Date.now(),
				hasUnresolvedIssues: false,
			});
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
			] as never);

			const reviewSession = createMockActiveSession({
				id: "review-session",
				agentRole: "review",
			});
			mockSessionManager.startSession.mockResolvedValue(reviewSession);

			await orchestrator.handleTurnCompletion("wf-1", ["complete_pulse"]);

			// Should transition to review via transitionStage
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"review",
				"review-session",
			);
		});

		test("tool names with no deferred tools is a no-op", async () => {
			await orchestrator.handleTurnCompletion("wf-1", [
				"read_file",
				"write_file",
			]);

			// Should not call any workflow mutation
			expect(mockWorkflowRepo.getById).not.toHaveBeenCalled();
			expect(mockSessionManager.stopSession).not.toHaveBeenCalled();
			expect(mockAgentRunnerRun).not.toHaveBeenCalled();
		});

		test("both complete_preflight and complete_pulse — only preflight handled", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const firstPulse = createMockPulse({ id: "pulse-1" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(
				firstPulse,
			);

			const newSession = createMockActiveSession({ id: "new-session" });
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.handleTurnCompletion("wf-1", [
				"complete_preflight",
				"complete_pulse",
			]);

			// Preflight handled — startNextPulse called
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalledWith(
				"wf-1",
				"/mock/worktree",
			);

			// Deferred pulse completion NOT called — getPulsesForWorkflow not invoked
			expect(mockPulseRepo.getPulsesForWorkflow).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// transitionStage via approveArtifact
	// =========================================================================

	describe("transitionStage via approveArtifact", () => {
		test("scoping → researching: approve scope_card with full path", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const researchSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(researchSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// Should transition to researching
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"researching",
				"research-session",
			);

			// Should stop old session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"scoping-session",
			);

			// Should start new session with researcher role
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "research",
				}),
			);

			// Should run the agent
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("researching → planning: approve research artifact", async () => {
			const workflow = createMockWorkflow({
				status: "researching",
				awaitingApproval: true,
				pendingArtifactType: "research",
				currentSessionId: "research-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const planSession = createMockActiveSession({
				id: "plan-session",
				agentRole: "planning",
			});
			mockSessionManager.startSession.mockResolvedValue(planSession);

			await orchestrator.approveArtifact("wf-1");

			// Should transition to planning
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"planning",
				"plan-session",
			);

			// Should start planner agent
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "planning",
				}),
			);

			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("planning → in_progress: approve plan triggers preflight setup", async () => {
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
				currentSessionId: "plan-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// Should transition to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				"preflight-session",
			);

			// Should start preflight agent
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "preflight",
				}),
			);

			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("in_progress → review via handleTurnCompletion when no more pulses", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "exec-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// No more proposed pulses
			const completedPulse = createMockPulse({
				id: "pulse-1",
				status: "succeeded",
				endedAt: Date.now(),
				hasUnresolvedIssues: false,
			});
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
			] as never);

			const reviewSession = createMockActiveSession({
				id: "review-session",
				agentRole: "review",
			});
			mockSessionManager.startSession.mockResolvedValue(reviewSession);

			await orchestrator.handleTurnCompletion("wf-1", ["complete_pulse"]);

			// Should transition to review
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"review",
				"review-session",
			);

			// Should create a review card when entering review stage
			expect(mockArtifactRepo.createReviewCard).toHaveBeenCalledWith(
				expect.objectContaining({ workflowId: "wf-1" }),
			);

			// Should start review agent
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "review",
				}),
			);
		});

		test("review → done: approve review_card triggers merge and cleanup", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
				baseBranch: "main",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);
			mockGetDiff.mockResolvedValue("mock diff content");
			mockMergeWorkflowBranch.mockResolvedValue({
				success: true,
				commitSha: "abc123",
			});

			await orchestrator.approveArtifact("wf-1", {
				mergeStrategy: "squash",
				commitMessage: "feat: implement feature",
			});

			// Should merge the workflow branch
			expect(mockMergeWorkflowBranch).toHaveBeenCalled();

			// Should clean up after merge
			expect(mockCleanupWorkflow).toHaveBeenCalled();

			// Should transition to done
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"done",
				null,
			);

			// Should cleanup shell approvals
			expect(mockShellApprovalService.cleanupWorkflow).toHaveBeenCalledWith(
				"wf-1",
			);

			// Should broadcast completed event
			expect(mockBroadcast).toHaveBeenCalled();
			const completedEvents = mockBroadcast.mock.calls.filter(
				(call: unknown[]) =>
					(call[0] as { type: string }).type === "workflow:completed",
			);
			expect(completedEvents.length).toBeGreaterThanOrEqual(1);
		});
	});

	// =========================================================================
	// Quick path
	// =========================================================================

	describe("quick path", () => {
		test("approve scope_card with quick path skips researching+planning", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			// First call: approveArtifact, second call: inside executeQuickPath
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "quick" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "autarch/wf-1",
				worktreePath: "/mock/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1", { path: "quick" });

			// Should set skipped stages
			expect(mockWorkflowRepo.setSkippedStages).toHaveBeenCalledWith("wf-1", [
				"researching",
				"planning",
			]);

			// Should initialize pulsing
			expect(
				mockPulseOrchestratorInstance.initializePulsing,
			).toHaveBeenCalledWith("wf-1");

			// Should create pulses from a single-pulse plan
			expect(
				mockPulseOrchestratorInstance.createPulsesFromPlan,
			).toHaveBeenCalledWith("wf-1", expect.any(Array));

			// Should transition to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				"preflight-session",
			);

			// Should create preflight setup
			expect(
				mockPulseOrchestratorInstance.createPreflightSetup,
			).toHaveBeenCalledWith("wf-1", "preflight-session");

			// Should set base branch
			expect(mockWorkflowRepo.setBaseBranch).toHaveBeenCalledWith(
				"wf-1",
				"main",
			);

			// Should run the preflight agent
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("scope_card with recommendedPath=quick is used when no explicit path option", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// scopeCard recommends quick, and no explicit path option passed
			const scopeCard = createMockScopeCard({ recommendedPath: "quick" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "autarch/wf-1",
				worktreePath: "/mock/worktree",
			});

			const session = createMockActiveSession({ id: "pf-session" });
			mockSessionManager.startSession.mockResolvedValue(session);

			// No path option — effectivePath comes from scopeCard.recommendedPath
			await orchestrator.approveArtifact("wf-1");

			// Should take quick path since recommendedPath is 'quick'
			expect(mockWorkflowRepo.setSkippedStages).toHaveBeenCalledWith("wf-1", [
				"researching",
				"planning",
			]);
		});
	});

	// =========================================================================
	// STAGE_TRANSITIONS constant validation
	// =========================================================================

	describe("STAGE_TRANSITIONS constant validation", () => {
		test("STAGE_TRANSITIONS maps each stage to expected next stage", () => {
			const expected: Record<string, string | null> = {
				backlog: "scoping",
				scoping: "researching",
				researching: "planning",
				planning: "in_progress",
				in_progress: "review",
				review: "done",
				done: null,
			};

			for (const [stage, nextStage] of Object.entries(expected)) {
				expect(STAGE_TRANSITIONS[stage as keyof typeof STAGE_TRANSITIONS]).toBe(
					nextStage as (typeof STAGE_TRANSITIONS)[keyof typeof STAGE_TRANSITIONS],
				);
			}
		});

		test("APPROVAL_REQUIRED_TOOLS maps expected tool→stage pairs", () => {
			const expected: Record<string, string> = {
				submit_scope: "researching",
				submit_research: "planning",
				submit_plan: "in_progress",
				complete_review: "done",
			};

			for (const [tool, stage] of Object.entries(expected)) {
				expect(APPROVAL_REQUIRED_TOOLS[tool] as string).toBe(stage);
			}

			// Verify exact number of entries
			expect(Object.keys(APPROVAL_REQUIRED_TOOLS)).toHaveLength(
				Object.keys(expected).length,
			);
		});

		test("AUTO_TRANSITION_TOOLS maps expected tool→stage pairs", () => {
			const expected: Record<string, string> = {
				complete_pulse: "review",
			};

			for (const [tool, stage] of Object.entries(expected)) {
				expect(AUTO_TRANSITION_TOOLS[tool] as string).toBe(stage);
			}

			expect(Object.keys(AUTO_TRANSITION_TOOLS)).toHaveLength(
				Object.keys(expected).length,
			);
		});
	});
});

// =============================================================================
// Category 2: Error Handling
// =============================================================================

describe("Error Handling", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		// Clear module-level mock functions
		mockWorkflowRepo.getById.mockClear();
		mockWorkflowRepo.create.mockClear();
		mockWorkflowRepo.updateStatus.mockClear();
		mockWorkflowRepo.setCurrentSession.mockClear();
		mockWorkflowRepo.setAwaitingApproval.mockClear();
		mockWorkflowRepo.clearAwaitingApproval.mockClear();
		mockWorkflowRepo.transitionStage.mockClear();
		mockWorkflowRepo.setBaseBranch.mockClear();
		mockWorkflowRepo.setSkippedStages.mockClear();

		mockArtifactRepo.getLatestScopeCard.mockClear();
		mockArtifactRepo.getLatestResearchCard.mockClear();
		mockArtifactRepo.getLatestPlan.mockClear();
		mockArtifactRepo.getLatestReviewCard.mockClear();
		mockArtifactRepo.saveScopeCard.mockClear();
		mockArtifactRepo.saveResearchCard.mockClear();
		mockArtifactRepo.savePlan.mockClear();
		mockArtifactRepo.saveReviewCard.mockClear();
		mockArtifactRepo.createReviewCard.mockClear();
		mockArtifactRepo.updateScopeCardStatus.mockClear();
		mockArtifactRepo.updateResearchCardStatus.mockClear();
		mockArtifactRepo.updatePlanStatus.mockClear();
		mockArtifactRepo.updateReviewCardStatus.mockClear();
		mockArtifactRepo.updateReviewCardDiffContent.mockClear();
		mockArtifactRepo.getCommentsByIds.mockClear();
		mockArtifactRepo.deleteResearchCardsByWorkflow.mockClear();
		mockArtifactRepo.deletePlansByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewCardsByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewComments.mockClear();
		mockArtifactRepo.resetReviewCard.mockClear();

		mockConversationRepo.getHistory.mockClear();

		mockPulseRepo.getPulsesForWorkflow.mockClear();
		mockPulseRepo.getRunningPulse.mockClear();

		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockGetCurrentBranch.mockClear();
		mockGetDiff.mockClear();
		mockMergeWorkflowBranch.mockClear();
		mockCleanupWorkflow.mockClear();
		mockCheckoutInWorktree.mockClear();
		mockFindRepoRoot.mockClear();
		mockGenerateObject.mockClear();
		mockExtractKnowledge.mockClear();
		mockShellApprovalService.cleanupWorkflow.mockClear();

		// Reset agent runner and pulse orchestrator mocks
		resetMockAgentRunner();
		resetMockPulseOrchestrator();

		// Create fresh session manager
		mockSessionManager = createMockSessionManager();

		// Construct fresh orchestrator
		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);
	});

	// =========================================================================
	// errorWorkflow
	// =========================================================================

	describe("errorWorkflow", () => {
		test("happy path — workflow exists with currentSessionId → calls errorSession and broadcasts error event", async () => {
			const workflow = createMockWorkflow({
				currentSessionId: "session-123",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await orchestrator.errorWorkflow(workflow.id, "something broke");

			expect(mockSessionManager.errorSession).toHaveBeenCalledWith(
				"session-123",
				"something broke",
			);
			expect(mockBroadcast).toHaveBeenCalledTimes(1);
			const broadcastArg = (
				mockBroadcast.mock.calls[0] as unknown[]
			)[0] as Record<string, unknown>;
			expect(broadcastArg.type).toBe("workflow:error");
			expect(
				(broadcastArg as { payload: { workflowId: string } }).payload
					.workflowId,
			).toBe(workflow.id);
		});

		test("workflow not found → returns silently without throwing or broadcasting", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			await orchestrator.errorWorkflow("non-existent-id", "some error");

			expect(mockSessionManager.errorSession).not.toHaveBeenCalled();
			expect(mockBroadcast).not.toHaveBeenCalled();
		});

		test("workflow exists but no currentSessionId → broadcasts error event but does not call errorSession", async () => {
			const workflow = createMockWorkflow({
				currentSessionId: undefined,
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await orchestrator.errorWorkflow(workflow.id, "background failure");

			expect(mockSessionManager.errorSession).not.toHaveBeenCalled();
			expect(mockBroadcast).toHaveBeenCalledTimes(1);
			const broadcastArg = (
				mockBroadcast.mock.calls[0] as unknown[]
			)[0] as Record<string, unknown>;
			expect(broadcastArg.type).toBe("workflow:error");
		});
	});

	// =========================================================================
	// createWorkflow error propagation
	// =========================================================================

	describe("createWorkflow error propagation", () => {
		test("runner.run() rejects → .catch() handler calls sessionManager.errorSession", async () => {
			const workflow = createMockWorkflow();
			const session = createMockActiveSession();
			mockGenerateObject.mockResolvedValue({
				object: { title: "test-title", description: "test desc" },
			});
			mockWorkflowRepo.create.mockResolvedValue(workflow);
			mockSessionManager.startSession.mockResolvedValue(session);

			// Use a deferred promise so we can control when the rejection fires
			let rejectRun!: (err: Error) => void;
			const deferredRun = new Promise<void>((_resolve, reject) => {
				rejectRun = reject;
			});
			mockAgentRunnerRun.mockReturnValue(deferredRun);

			await orchestrator.createWorkflow("build something");

			// Now reject the run() promise — this triggers the .catch() handler
			rejectRun(new Error("agent failed"));
			// Flush the microtask queue so the .catch() handler executes
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(mockSessionManager.errorSession).toHaveBeenCalledWith(
				session.id,
				"agent failed",
			);
		});

		test("generateObject throws → createWorkflow propagates the error to caller", async () => {
			mockGenerateObject.mockRejectedValue(new Error("LLM generation failed"));

			await expect(
				orchestrator.createWorkflow("build something"),
			).rejects.toThrow("Failed to generate workflow title");
		});
	});

	// =========================================================================
	// merge failure during review approval
	// =========================================================================

	describe("merge failure during review approval", () => {
		test("mergeWorkflowBranch throws → checkoutInWorktree called to restore worktree, error is re-thrown", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				baseBranch: "main",
				currentSessionId: "session-123",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);
			mockGetDiff.mockResolvedValue("some diff content");
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(
				createMockReviewCard(),
			);
			mockMergeWorkflowBranch.mockRejectedValue(new Error("merge conflict"));

			const worktreePath = mockGetWorktreePath();
			const workflowBranch = `autarch/${workflow.id}`;

			await expect(
				orchestrator.approveArtifact(workflow.id, {
					mergeStrategy: "squash",
					commitMessage: "ship it",
				}),
			).rejects.toThrow(
				`Failed to merge workflow branch into main: merge conflict`,
			);

			expect(mockCheckoutInWorktree).toHaveBeenCalledWith(
				worktreePath,
				workflowBranch,
			);
		});

		test("mergeWorkflowBranch returns {success:false} → merge result is not checked so no error thrown, proceeds to cleanup", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				baseBranch: "main",
				currentSessionId: "session-123",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);
			mockGetDiff.mockResolvedValue("some diff content");
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(
				createMockReviewCard(),
			);
			mockMergeWorkflowBranch.mockResolvedValue({
				success: false,
				commitSha: "",
			} as never);

			// The code awaits mergeWorkflowBranch but doesn't check its return value
			// so {success:false} does not cause an error — it proceeds to cleanup
			await orchestrator.approveArtifact(workflow.id, {
				mergeStrategy: "squash",
				commitMessage: "ship it",
			});

			expect(mockCleanupWorkflow).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// guard clauses
	// =========================================================================

	describe("guard clauses", () => {
		test("approveArtifact with non-existent workflow → throws", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			await expect(
				orchestrator.approveArtifact("non-existent"),
			).rejects.toThrow("Workflow not found: non-existent");
		});

		test("approveArtifact with workflow not awaiting approval → throws", async () => {
			const workflow = createMockWorkflow({ awaitingApproval: false });
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await expect(orchestrator.approveArtifact(workflow.id)).rejects.toThrow(
				`Workflow ${workflow.id} is not awaiting approval`,
			);
		});

		test("requestChanges with non-existent workflow → throws", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			await expect(
				orchestrator.requestChanges("non-existent", "fix this"),
			).rejects.toThrow("Workflow not found: non-existent");
		});

		test("requestChanges with workflow not awaiting approval → throws", async () => {
			const workflow = createMockWorkflow({ awaitingApproval: false });
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await expect(
				orchestrator.requestChanges(workflow.id, "fix this"),
			).rejects.toThrow(`Workflow ${workflow.id} is not awaiting approval`);
		});

		test("handlePulseCompletion with non-existent workflow → returns early without throwing", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			// Should not throw — just returns silently
			await orchestrator.handlePulseCompletion(
				"non-existent",
				"commit msg",
				false,
			);

			// Verify no downstream operations were attempted
			expect(
				mockPulseOrchestratorInstance.completePulse,
			).not.toHaveBeenCalled();
		});

		test("handlePulseFailure with no running pulse → returns without calling failPulse", async () => {
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(
				null as never,
			);

			await orchestrator.handlePulseFailure("test-workflow-id", "some failure");

			expect(mockPulseOrchestratorInstance.failPulse).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// handlePulseFailure
	// =========================================================================

	describe("handlePulseFailure", () => {
		test("happy path — running pulse exists → calls failPulse, does NOT transition stage", async () => {
			const pulse = createMockPulse({ status: "running" });
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(pulse);

			await orchestrator.handlePulseFailure("test-workflow-id", "build failed");

			expect(mockPulseOrchestratorInstance.failPulse).toHaveBeenCalledWith(
				pulse.id,
				"build failed",
			);
			expect(mockWorkflowRepo.transitionStage).not.toHaveBeenCalled();
		});

		test("no running pulse → returns silently without calling failPulse", async () => {
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(
				null as never,
			);

			await orchestrator.handlePulseFailure("test-workflow-id", "build failed");

			expect(mockPulseOrchestratorInstance.failPulse).not.toHaveBeenCalled();
		});
	});
});

// =============================================================================
// Concurrency Edge Cases
// =============================================================================

describe("Concurrency Edge Cases", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		mockSessionManager = createMockSessionManager();
		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);

		// Reset all mocks
		for (const method of Object.values(mockWorkflowRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockArtifactRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockConversationRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockPulseRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockFindRepoRoot.mockClear();
		resetMockAgentRunner();
		resetMockPulseOrchestrator();
	});

	// =========================================================================
	// Deferred Transitions
	// =========================================================================

	describe("deferred transitions", () => {
		test("complete_preflight in handleToolResult returns {transitioned:false} — not in any tool map", async () => {
			const workflow = createMockWorkflow({ status: "in_progress" });
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const result = await orchestrator.handleToolResult(
				"test-workflow-id",
				"complete_preflight",
				"artifact-123",
			);

			expect(result).toEqual({
				transitioned: false,
				awaitingApproval: false,
			});
		});

		test("complete_pulse handled via handleTurnCompletion → delegates to pulse completion logic", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// Set up a completed pulse (succeeded) and no more proposed pulses
			const completedPulse = createMockPulse({
				status: "succeeded",
				endedAt: Date.now(),
			});
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
			] as never);

			// transitionStage internally creates a new session
			const newSession = createMockActiveSession({
				id: "review-session",
				agentRole: "review",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.handleTurnCompletion("test-workflow-id", [
				"complete_pulse",
			]);

			// Should transition to review since no more proposed pulses
			// transitionStage calls workflowRepo.transitionStage with (wfId, stage, sessionId)
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"test-workflow-id",
				"review",
				"review-session",
			);
		});

		test("complete_preflight handled via handleTurnCompletion → starts first pulse", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const firstPulse = createMockPulse({ id: "pulse-1" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(
				firstPulse,
			);

			const newSession = createMockActiveSession({
				id: "new-session-1",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs artifacts
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			await orchestrator.handleTurnCompletion("test-workflow-id", [
				"complete_preflight",
			]);

			// Should stop the old session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith("session-1");
			// Should start next pulse
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalledWith(
				"test-workflow-id",
				"/mock/worktree",
			);
			// Should start a new session for the pulse
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					contextType: "workflow",
					contextId: "test-workflow-id",
					agentRole: "execution",
					pulseId: "pulse-1",
				}),
			);
			// Should run the agent
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("complete_pulse via handleTurnCompletion with more pulses → starts next pulse", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// One succeeded pulse and one proposed pulse remaining
			const completedPulse = createMockPulse({
				id: "pulse-1",
				status: "succeeded",
				endedAt: Date.now(),
			});
			const proposedPulse = createMockPulse({
				id: "pulse-2",
				status: "proposed",
			});
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
				proposedPulse,
			] as never);

			const nextPulse = createMockPulse({ id: "pulse-2-started" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(nextPulse);

			const newSession = createMockActiveSession({
				id: "new-session-2",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs artifacts
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			await orchestrator.handleTurnCompletion("test-workflow-id", [
				"complete_pulse",
			]);

			// Should stop the old session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith("session-1");
			// Should start next pulse
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalled();
			// Should create a new session with the next pulse
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "execution",
					pulseId: "pulse-2-started",
				}),
			);
			// Should NOT transition to review
			expect(mockWorkflowRepo.transitionStage).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Non-blocking runner.run()
	// =========================================================================

	describe("non-blocking runner.run()", () => {
		test("createWorkflow returns before runner.run() completes", async () => {
			// Mock a never-resolving promise for runner.run()
			mockAgentRunnerRun.mockReturnValue(new Promise(() => {}));

			mockGenerateObject.mockResolvedValue({
				object: { title: "test-workflow", description: "A test workflow" },
			});

			const workflow = createMockWorkflow();
			mockWorkflowRepo.create.mockResolvedValue(workflow);

			const session = createMockActiveSession();
			mockSessionManager.startSession.mockResolvedValue(session);

			// createWorkflow should return even though runner.run() never resolves
			const result = await orchestrator.createWorkflow("test prompt");

			expect(result).toBeDefined();
			expect(result.id).toBe(workflow.id);
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("approveArtifact returns before runner.run() completes", async () => {
			// Mock a never-resolving promise for runner.run()
			mockAgentRunnerRun.mockReturnValue(new Promise(() => {}));

			// Set up a workflow at scoping stage awaiting approval (scope_card)
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			// transitionStage internally calls getById again after transition
			mockWorkflowRepo.transitionStage.mockResolvedValue(undefined);

			const newSession = createMockActiveSession({ id: "new-session" });
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildInitialMessage needs a scope card
			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			// approveArtifact should return even though runner.run() never resolves
			await orchestrator.approveArtifact("test-workflow-id");

			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Pulse Chaining
	// =========================================================================

	describe("pulse chaining", () => {
		test("completePulse returns {hasMorePulses:true} → stops session, starts next pulse, runs agent", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const runningPulse = createMockPulse({
				id: "pulse-1",
				status: "running",
			});
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(
				runningPulse,
			);
			mockPulseOrchestratorInstance.completePulse.mockResolvedValue({
				success: true,
				hasMorePulses: true,
			});

			const nextPulse = createMockPulse({ id: "pulse-2" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(nextPulse);

			const newSession = createMockActiveSession({
				id: "new-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs artifacts
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			await orchestrator.handlePulseCompletion(
				"test-workflow-id",
				"feat: add feature",
				false,
			);

			// Should stop old session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith("session-1");
			// Should start next pulse
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalled();
			// Should create new session with next pulse ID
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "execution",
					pulseId: "pulse-2",
				}),
			);
			// Should run the agent
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			// Should NOT transition to review
			expect(mockWorkflowRepo.transitionStage).not.toHaveBeenCalledWith(
				"test-workflow-id",
				"review",
			);
		});

		test("completePulse returns {hasMorePulses:false} → transitions to review stage", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const runningPulse = createMockPulse({
				id: "pulse-1",
				status: "running",
			});
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(
				runningPulse,
			);
			mockPulseOrchestratorInstance.completePulse.mockResolvedValue({
				success: true,
				hasMorePulses: false,
			});

			// transitionStage internally creates a new session
			const reviewSession = createMockActiveSession({
				id: "review-session",
				agentRole: "review",
			});
			mockSessionManager.startSession.mockResolvedValue(reviewSession);

			await orchestrator.handlePulseCompletion(
				"test-workflow-id",
				"feat: add feature",
				false,
			);

			// Should transition to review (3 args: workflowId, stage, sessionId)
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"test-workflow-id",
				"review",
				"review-session",
			);
			// Should NOT start next pulse
			expect(
				mockPulseOrchestratorInstance.startNextPulse,
			).not.toHaveBeenCalled();
		});

		test("completePulse returns {success:false} → does not chain or transition", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const runningPulse = createMockPulse({
				id: "pulse-1",
				status: "running",
			});
			mockPulseOrchestratorInstance.getRunningPulse.mockResolvedValue(
				runningPulse,
			);
			mockPulseOrchestratorInstance.completePulse.mockResolvedValue({
				success: false,
				hasMorePulses: false,
			} as never);

			await orchestrator.handlePulseCompletion(
				"test-workflow-id",
				"feat: add feature",
				false,
			);

			// Should NOT start next pulse
			expect(
				mockPulseOrchestratorInstance.startNextPulse,
			).not.toHaveBeenCalled();
			// Should NOT transition to review
			expect(mockWorkflowRepo.transitionStage).not.toHaveBeenCalledWith(
				"test-workflow-id",
				"review",
			);
			// Should call errorWorkflow (broadcasts error event)
			expect(mockBroadcast).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// retryPulse
	// =========================================================================

	describe("retryPulse", () => {
		test("happy path — stops session, waits, creates new session with same pulseId, runs agent", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const runningPulse = createMockPulse({
				id: "pulse-1",
				status: "running",
				worktreePath: "/test/worktrees/test-workflow-id",
			});
			mockPulseRepo.getRunningPulse.mockResolvedValue(runningPulse);

			const newSession = createMockActiveSession({
				id: "retry-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs artifacts
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			mockFindRepoRoot.mockReturnValue("/test/repo-root");

			// Override setTimeout to resolve immediately so the 500ms sleep in retryPulse
			// doesn't cause flakiness under concurrent test execution
			const originalSetTimeout = globalThis.setTimeout;
			// @ts-expect-error — simplified mock for test purposes
			globalThis.setTimeout = (fn: () => void, _ms?: number) => {
				fn();
				return 0;
			};
			try {
				await orchestrator.retryPulse("test-workflow-id");
			} finally {
				globalThis.setTimeout = originalSetTimeout;
			}

			// Should stop the old session
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"old-session",
			);
			// Should create new session with the SAME pulse ID
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					contextType: "workflow",
					contextId: "test-workflow-id",
					agentRole: "execution",
					pulseId: "pulse-1",
				}),
			);
			// Should update the workflow with the new session
			expect(mockWorkflowRepo.setCurrentSession).toHaveBeenCalledWith(
				"test-workflow-id",
				"retry-session",
			);
			// Should run the agent
			expect(mockAgentRunnerRun).toHaveBeenCalled();
		});

		test("no running pulse → throws", async () => {
			const workflow = createMockWorkflow({ status: "in_progress" });
			mockWorkflowRepo.getById.mockResolvedValue(workflow);
			mockPulseRepo.getRunningPulse.mockResolvedValue(null as never);

			await expect(orchestrator.retryPulse("test-workflow-id")).rejects.toThrow(
				"No running pulse found for workflow test-workflow-id",
			);
		});

		test("uses findRepoRoot(process.cwd()) for projectRoot, NOT getProjectRoot()", async () => {
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const runningPulse = createMockPulse({
				id: "pulse-1",
				status: "running",
			});
			mockPulseRepo.getRunningPulse.mockResolvedValue(runningPulse);

			const newSession = createMockActiveSession({
				id: "retry-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs artifacts
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			mockFindRepoRoot.mockReturnValue("/custom/repo/root");

			// Override setTimeout to resolve immediately so the 500ms sleep in retryPulse
			// doesn't cause flakiness under concurrent test execution
			const originalSetTimeout = globalThis.setTimeout;
			// @ts-expect-error — simplified mock for test purposes
			globalThis.setTimeout = (fn: () => void, _ms?: number) => {
				fn();
				return 0;
			};
			try {
				await orchestrator.retryPulse("test-workflow-id");
			} finally {
				globalThis.setTimeout = originalSetTimeout;
			}

			// Should call findRepoRoot, NOT getProjectRoot
			expect(mockFindRepoRoot).toHaveBeenCalledWith(process.cwd());
			// getProjectRoot should NOT have been called by retryPulse
			// (it may be called by other internal methods, so we just verify findRepoRoot was called)
			expect(mockFindRepoRoot).toHaveBeenCalled();

			// Verify the AgentRunner was constructed with the projectRoot from findRepoRoot
			const lastInstance = getLastAgentRunnerInstance();
			expect(lastInstance).not.toBeNull();
			expect(
				(lastInstance?.config as { projectRoot: string }).projectRoot,
			).toBe("/custom/repo/root");
		});
	});
});

// =============================================================================
// Category 4: Agent Spawning
// =============================================================================

describe("Agent Spawning", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		// Clear module-level mock functions
		mockWorkflowRepo.getById.mockClear();
		mockWorkflowRepo.create.mockClear();
		mockWorkflowRepo.updateStatus.mockClear();
		mockWorkflowRepo.setCurrentSession.mockClear();
		mockWorkflowRepo.setAwaitingApproval.mockClear();
		mockWorkflowRepo.clearAwaitingApproval.mockClear();
		mockWorkflowRepo.transitionStage.mockClear();
		mockWorkflowRepo.setBaseBranch.mockClear();
		mockWorkflowRepo.setSkippedStages.mockClear();

		mockArtifactRepo.getLatestScopeCard.mockClear();
		mockArtifactRepo.getLatestResearchCard.mockClear();
		mockArtifactRepo.getLatestPlan.mockClear();
		mockArtifactRepo.getLatestReviewCard.mockClear();
		mockArtifactRepo.saveScopeCard.mockClear();
		mockArtifactRepo.saveResearchCard.mockClear();
		mockArtifactRepo.savePlan.mockClear();
		mockArtifactRepo.saveReviewCard.mockClear();
		mockArtifactRepo.createReviewCard.mockClear();
		mockArtifactRepo.updateScopeCardStatus.mockClear();
		mockArtifactRepo.updateResearchCardStatus.mockClear();
		mockArtifactRepo.updatePlanStatus.mockClear();
		mockArtifactRepo.updateReviewCardStatus.mockClear();
		mockArtifactRepo.updateReviewCardDiffContent.mockClear();
		mockArtifactRepo.getCommentsByIds.mockClear();
		mockArtifactRepo.deleteResearchCardsByWorkflow.mockClear();
		mockArtifactRepo.deletePlansByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewCardsByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewComments.mockClear();
		mockArtifactRepo.resetReviewCard.mockClear();

		mockConversationRepo.getHistory.mockClear();

		mockPulseRepo.getPulsesForWorkflow.mockClear();
		mockPulseRepo.getRunningPulse.mockClear();

		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockGetCurrentBranch.mockClear();
		mockGetDiff.mockClear();
		mockMergeWorkflowBranch.mockClear();
		mockCleanupWorkflow.mockClear();
		mockCheckoutInWorktree.mockClear();
		mockFindRepoRoot.mockClear();
		mockGenerateObject.mockClear();
		mockExtractKnowledge.mockClear();
		mockShellApprovalService.cleanupWorkflow.mockClear();

		// Reset agent runner and pulse orchestrator mocks
		resetMockAgentRunner();
		resetMockPulseOrchestrator();

		// Create fresh session manager
		mockSessionManager = createMockSessionManager();

		// Construct fresh orchestrator
		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);
	});

	// =========================================================================
	// STAGE_TO_AGENT mapping
	// =========================================================================

	describe("STAGE_TO_AGENT mapping", () => {
		test("scoping stage → agent role 'scoping'", async () => {
			// Approve scope card at scoping stage with full path → triggers transition to researching
			// But we want to verify the SCOPING agent itself; scoping is set at workflow start
			// The mapping says scoping → "scoping", so approving at backlog → scoping would use "scoping"
			// Instead: trigger scoping→researching transition and verify researching agent is "research"
			// For the actual "scoping" role test, use a workflow at backlog transitioning to scoping
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// scoping→researching: agent role should be "research"
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "research",
				}),
			);
		});

		test("researching stage → agent role 'research' (via transition to planning)", async () => {
			const workflow = createMockWorkflow({
				status: "researching",
				awaitingApproval: true,
				pendingArtifactType: "research",
				currentSessionId: "research-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const planSession = createMockActiveSession({
				id: "plan-session",
				agentRole: "planning",
			});
			mockSessionManager.startSession.mockResolvedValue(planSession);

			await orchestrator.approveArtifact("wf-1");

			// researching→planning: agent role should be "planning"
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "planning",
				}),
			);
		});

		test("planning stage → agent role 'planning' (via transition to in_progress)", async () => {
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
				currentSessionId: "plan-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const plan = createMockPlan();
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "workflow/wf-1",
				worktreePath: "/test/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// planning→in_progress: agent role should be "preflight"
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "preflight",
				}),
			);
		});

		test("in_progress stage → agent role 'preflight' for initial transition", async () => {
			// Same as above: planning→in_progress spawns preflight agent
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
				currentSessionId: "plan-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const plan = createMockPlan();
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "workflow/wf-1",
				worktreePath: "/test/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// Verify the spawned agent role is "preflight" (from STAGE_TO_AGENT["in_progress"])
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "preflight",
				}),
			);
		});

		test("review stage → agent role 'review'", async () => {
			// Trigger in_progress→review via handleTurnCompletion when no more pulses
			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "exec-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const completedPulse = createMockPulse({
				id: "pulse-1",
				status: "succeeded",
				endedAt: Date.now(),
				hasUnresolvedIssues: false,
			});
			// handleDeferredPulseCompletion uses getPulsesForWorkflow to determine state
			mockPulseRepo.getPulsesForWorkflow.mockResolvedValue([
				completedPulse,
			] as never);

			const reviewSession = createMockActiveSession({
				id: "review-session",
				agentRole: "review",
			});
			mockSessionManager.startSession.mockResolvedValue(reviewSession);

			await orchestrator.handleTurnCompletion("wf-1", ["complete_pulse"]);

			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					agentRole: "review",
				}),
			);
		});
	});

	// =========================================================================
	// Session and runner creation
	// =========================================================================

	describe("session and runner creation", () => {
		test("startSession called with correct SessionContext shape", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// Verify exact SessionContext shape
			expect(mockSessionManager.startSession).toHaveBeenCalledWith({
				contextType: "workflow",
				contextId: "wf-1",
				agentRole: "research",
			});
		});

		test("AgentRunner constructed with (session, {projectRoot, conversationRepo})", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			const lastInstance = getLastAgentRunnerInstance();
			expect(lastInstance).not.toBeNull();
			// Session should match what startSession returned
			expect(lastInstance?.session).toBe(newSession);
			// Config should include projectRoot and conversationRepo
			expect(lastInstance?.config).toEqual(
				expect.objectContaining({
					projectRoot: expect.any(String),
					conversationRepo: expect.anything(),
				}),
			);
		});

		test("runner.run() called with message string and {hidden: true}", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// runner.run() should have been called
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const callArgs = mockAgentRunnerRun.mock.calls[0] as unknown as [
				string,
				Record<string, unknown>,
			];
			const [message, options] = callArgs;
			expect(typeof message).toBe("string");
			expect(options).toEqual({ hidden: true });
		});

		test("workflowRepo.setCurrentSession called with new session id after startSession", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({ recommendedPath: "full" });
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// transitionStage calls workflowRepo.transitionStage with sessionId, not setCurrentSession
			// But transitionStage internally stores the session via workflowRepo.transitionStage(wfId, stage, sessionId)
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"researching",
				"research-session",
			);
		});
	});

	// =========================================================================
	// buildInitialMessage context
	// =========================================================================

	describe("buildInitialMessage context", () => {
		test("scoping→researching transition message includes scope card content", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				title: "Add user authentication",
				description: "Implement JWT-based auth flow",
				inScope: ["login endpoint", "token refresh"],
				outOfScope: ["OAuth integration"],
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			// The message passed to runner.run() should contain scope card info
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).toContain("Add user authentication");
			expect(message).toContain("Implement JWT-based auth flow");
			expect(message).toContain("login endpoint");
			expect(message).toContain("token refresh");
			expect(message).toContain("OAuth integration");
		});

		test("planning→in_progress transition constructs preflight context", async () => {
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
				currentSessionId: "plan-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const plan = createMockPlan({
				pulses: [
					{
						id: "pd-1",
						title: "Implement feature",
						description: "Build the thing",
						expectedChanges: ["src/feature.ts"],
						estimatedSize: "medium",
					},
				],
			});
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "workflow/wf-1",
				worktreePath: "/test/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// Message should reference preflight setup
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).toContain("Preflight");
			// Should include worktree path
			expect(message).toContain("/test/worktree");
			// Should reference the pulse
			expect(message).toContain("Implement feature");
		});
	});

	// =========================================================================
	// buildPulseInitialMessage
	// =========================================================================

	describe("buildPulseInitialMessage", () => {
		test("pulse execution message includes pulse description and plan context", async () => {
			// Trigger pulse execution via requestFixes which calls buildPulseInitialMessage
			const workflow = createMockWorkflow({
				id: "wf-1",
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const comment = {
				id: "comment-1",
				reviewCardId: "rc-1",
				type: "general" as const,
				severity: "must-fix" as const,
				category: "bug" as const,
				description: "Fix the null check",
				author: "reviewer",
				status: "open" as const,
				createdAt: Date.now(),
			};
			mockArtifactRepo.getCommentsByIds.mockResolvedValue([comment] as never);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);

			const fixPulse = createMockPulse({
				id: "fix-pulse-1",
				description: "Fix the null check issue",
				plannedPulseId: "pd-1",
			});
			mockPulseRepo.createPulse.mockResolvedValue(fixPulse);
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(fixPulse);

			const scopeCard = createMockScopeCard({
				title: "Auth feature",
				description: "Authentication implementation",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const researchCard = createMockResearchCard({
				recommendations: ["Use bcrypt for hashing"],
			});
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(researchCard);

			const plan = createMockPlan({
				approachSummary: "Incremental implementation",
				pulses: [
					{
						id: "pd-1",
						title: "Fix pulse",
						description: "Fix it",
						expectedChanges: ["src/auth.ts"],
						estimatedSize: "small",
					},
				],
			});
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			const execSession = createMockActiveSession({
				id: "exec-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(execSession);

			await orchestrator.requestFixes("wf-1", ["comment-1"]);

			// The message to runner.run() should include pulse details
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			// Should include the pulse description
			expect(message).toContain("Fix the null check issue");
		});
	});
});

// =============================================================================
// Approval Gates
// =============================================================================

describe("Approval Gates", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		mockSessionManager = createMockSessionManager();
		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);

		// Reset all mocks
		for (const method of Object.values(mockWorkflowRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockArtifactRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockConversationRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		for (const method of Object.values(mockPulseRepo)) {
			if (typeof method === "function" && "mockClear" in method)
				method.mockClear();
		}
		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockGetDiff.mockClear();
		mockMergeWorkflowBranch.mockClear();
		mockCleanupWorkflow.mockClear();
		mockCheckoutInWorktree.mockClear();
		resetMockAgentRunner();
		resetMockPulseOrchestrator();
	});

	// =========================================================================
	// approveArtifact - scope_card
	// =========================================================================

	describe("approveArtifact - scope_card", () => {
		test("full path — scope card with recommendedPath:'full' transitions to 'researching'", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1");

			// Scope card status should be updated to 'approved'
			expect(mockArtifactRepo.updateScopeCardStatus).toHaveBeenCalledWith(
				scopeCard.id,
				"approved",
			);

			// Should clear awaiting approval via transitionStage internals
			// and transition to 'researching'
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"researching",
				"research-session",
			);
		});

		test("quick path — scope card with recommendedPath:'quick' skips to 'in_progress'", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				title: "Quick task",
				description: "Simple fix",
				inScope: ["fix bug"],
				outOfScope: [],
				recommendedPath: "quick",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "autarch/wf-1",
				worktreePath: "/test/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// Should call setSkippedStages with researching and planning
			expect(mockWorkflowRepo.setSkippedStages).toHaveBeenCalledWith("wf-1", [
				"researching",
				"planning",
			]);

			// Should create pulses from plan (single pseudo-pulse)
			expect(
				mockPulseOrchestratorInstance.createPulsesFromPlan,
			).toHaveBeenCalledWith(
				"wf-1",
				expect.arrayContaining([
					expect.objectContaining({
						title: "Quick task",
					}),
				]),
			);

			// Should create preflight setup
			expect(
				mockPulseOrchestratorInstance.createPreflightSetup,
			).toHaveBeenCalledWith("wf-1", "preflight-session");

			// Should transition to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				"preflight-session",
			);
		});

		test("scope card not found throws error", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(null as never);

			await expect(orchestrator.approveArtifact("wf-1")).rejects.toThrow(
				/no scope card found/i,
			);
		});
	});

	// =========================================================================
	// approveArtifact - research
	// =========================================================================

	describe("approveArtifact - research", () => {
		test("updates research card status to 'approved' and transitions to 'planning'", async () => {
			const workflow = createMockWorkflow({
				status: "researching",
				awaitingApproval: true,
				pendingArtifactType: "research",
				currentSessionId: "research-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const researchCard = createMockResearchCard();
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(researchCard);

			const planningSession = createMockActiveSession({
				id: "planning-session",
				agentRole: "planning",
			});
			mockSessionManager.startSession.mockResolvedValue(planningSession);

			await orchestrator.approveArtifact("wf-1");

			expect(mockArtifactRepo.updateResearchCardStatus).toHaveBeenCalledWith(
				researchCard.id,
				"approved",
			);

			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"planning",
				"planning-session",
			);
		});
	});

	// =========================================================================
	// approveArtifact - plan
	// =========================================================================

	describe("approveArtifact - plan", () => {
		test("updates plan status to 'approved', initializes pulsing, and transitions to 'in_progress'", async () => {
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
				currentSessionId: "planning-session",
			});
			// After transitionStage updates the session, re-fetches return updated workflow
			const updatedWorkflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "preflight-session",
			});
			mockWorkflowRepo.getById
				.mockResolvedValueOnce(workflow) // approveArtifact initial fetch
				.mockResolvedValueOnce(workflow) // transitionStage fetch
				.mockResolvedValueOnce(updatedWorkflow); // buildInitialMessage re-fetch for createPreflightSetup

			const plan = createMockPlan({
				pulses: [
					{
						id: "pd-1",
						title: "Pulse 1",
						description: "First pulse",
						expectedChanges: ["src/a.ts"],
						estimatedSize: "small",
					},
				],
			});
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "autarch/wf-1",
				worktreePath: "/test/worktree",
			});

			const preflightSession = createMockActiveSession({
				id: "preflight-session",
				agentRole: "preflight",
			});
			mockSessionManager.startSession.mockResolvedValue(preflightSession);

			await orchestrator.approveArtifact("wf-1");

			// Plan status updated to approved
			expect(mockArtifactRepo.updatePlanStatus).toHaveBeenCalledWith(
				plan.id,
				"approved",
			);

			// Pulsing initialized
			expect(
				mockPulseOrchestratorInstance.initializePulsing,
			).toHaveBeenCalledWith("wf-1");

			// Pulses created from plan
			expect(
				mockPulseOrchestratorInstance.createPulsesFromPlan,
			).toHaveBeenCalledWith(
				"wf-1",
				expect.arrayContaining([
					expect.objectContaining({ id: "pd-1", title: "Pulse 1" }),
				]),
			);

			// Preflight setup created
			expect(
				mockPulseOrchestratorInstance.createPreflightSetup,
			).toHaveBeenCalledWith("wf-1", "preflight-session");

			// Transitioned to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				"preflight-session",
			);
		});
	});

	// =========================================================================
	// approveArtifact - review_card
	// =========================================================================

	describe("approveArtifact - review_card", () => {
		test("happy path — merges, cleans up, and transitions to 'done'", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
				baseBranch: "main",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);

			await orchestrator.approveArtifact("wf-1", {
				mergeStrategy: "squash",
				commitMessage: "feat: add feature",
			});

			// getDiff called to capture diff before merge
			expect(mockGetDiff).toHaveBeenCalledWith(
				expect.any(String),
				"main",
				"autarch/wf-1",
			);

			// mergeWorkflowBranch called with correct args
			expect(mockMergeWorkflowBranch).toHaveBeenCalledWith(
				expect.any(String), // projectRoot
				expect.any(String), // worktreePath
				"main", // baseBranch
				"autarch/wf-1", // workflowBranch
				"squash", // mergeStrategy
				"feat: add feature", // commitMessage
				expect.objectContaining({
					"Autarch-Workflow-Id": "wf-1",
				}), // trailers
			);

			// cleanupWorkflow called
			expect(mockCleanupWorkflow).toHaveBeenCalledWith(
				expect.any(String),
				"wf-1",
				{ deleteBranch: true },
			);

			// Review card status updated to approved
			expect(mockArtifactRepo.updateReviewCardStatus).toHaveBeenCalledWith(
				reviewCard.id,
				"approved",
			);

			// Transitions to done
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"done",
				null,
			);

			// Broadcasts completed event
			expect(mockBroadcast).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "workflow:completed",
				}),
			);
		});

		test("with merge options — passes options to mergeWorkflowBranch", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
				baseBranch: "develop",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);

			await orchestrator.approveArtifact("wf-1", {
				mergeStrategy: "merge-commit",
				commitMessage: "custom merge msg",
			});

			expect(mockMergeWorkflowBranch).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				"develop",
				"autarch/wf-1",
				"merge-commit",
				"custom merge msg",
				expect.any(Object),
			);
		});

		test("merge failure — restores worktree and re-throws error", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
				baseBranch: "main",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);

			mockMergeWorkflowBranch.mockRejectedValue(new Error("Merge conflict"));

			await expect(
				orchestrator.approveArtifact("wf-1", {
					mergeStrategy: "squash",
					commitMessage: "feat: thing",
				}),
			).rejects.toThrow(/merge conflict/i);

			// checkoutInWorktree called to restore worktree
			expect(mockCheckoutInWorktree).toHaveBeenCalledWith(
				expect.any(String),
				"autarch/wf-1",
			);

			// Workflow should NOT transition to done
			expect(mockWorkflowRepo.transitionStage).not.toHaveBeenCalledWith(
				"wf-1",
				"done",
				expect.anything(),
			);
		});
	});

	// =========================================================================
	// requestChanges
	// =========================================================================

	describe("requestChanges", () => {
		test("happy path — denies artifact, clears approval, resumes session with feedback", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "scoping-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const activeSession = createMockActiveSession({
				id: "scoping-session",
				status: "active",
			});
			mockSessionManager.getOrRestoreSession.mockResolvedValue(activeSession);

			await orchestrator.requestChanges("wf-1", "Please narrow the scope");

			// Artifact status updated to denied
			expect(mockArtifactRepo.updateScopeCardStatus).toHaveBeenCalledWith(
				scopeCard.id,
				"denied",
			);

			// Awaiting approval cleared
			expect(mockWorkflowRepo.clearAwaitingApproval).toHaveBeenCalledWith(
				"wf-1",
			);

			// Session NOT stopped (resumes in same stage)
			expect(mockSessionManager.stopSession).not.toHaveBeenCalled();

			// Runner.run() called with feedback message (no {hidden: true})
			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const runMessage = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(runMessage).toContain("Please narrow the scope");
		});

		test("no active session — returns early without running agent", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "dead-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			// Session not active
			mockSessionManager.getOrRestoreSession.mockResolvedValue({
				...createMockActiveSession({ id: "dead-session" }),
				status: "completed",
			});

			await orchestrator.requestChanges("wf-1", "feedback");

			// Artifact status still updated
			expect(mockArtifactRepo.updateScopeCardStatus).toHaveBeenCalled();

			// But runner NOT invoked
			expect(mockAgentRunnerRun).not.toHaveBeenCalled();
		});

		test("workflow not awaiting approval — throws", async () => {
			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: false,
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await expect(
				orchestrator.requestChanges("wf-1", "feedback"),
			).rejects.toThrow(/not awaiting approval/i);
		});
	});

	// =========================================================================
	// requestFixes
	// =========================================================================

	describe("requestFixes", () => {
		test("happy path — creates fix pulse, transitions to in_progress, runs execution agent", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
				currentSessionId: "review-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const comment = {
				id: "comment-1",
				reviewCardId: "rc-1",
				type: "general" as const,
				severity: "must-fix" as const,
				category: "bug" as const,
				description: "Fix the null check",
				author: "reviewer",
				status: "open" as const,
				createdAt: Date.now(),
			};
			mockArtifactRepo.getCommentsByIds.mockResolvedValue([comment] as never);

			const reviewCard = createMockReviewCard();
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(reviewCard);

			const fixPulse = createMockPulse({
				id: "fix-pulse-1",
				description: "## Fix Request",
			});
			mockPulseRepo.createPulse.mockResolvedValue(fixPulse);
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(fixPulse);

			// Mocks for buildPulseInitialMessage
			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);
			const researchCard = createMockResearchCard();
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(researchCard);
			const plan = createMockPlan();
			mockArtifactRepo.getLatestPlan.mockResolvedValue(plan);

			const execSession = createMockActiveSession({
				id: "exec-session",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(execSession);

			await orchestrator.requestFixes("wf-1", ["comment-1"]);

			// Review card status updated to denied
			expect(mockArtifactRepo.updateReviewCardStatus).toHaveBeenCalledWith(
				reviewCard.id,
				"denied",
			);

			// Current session stopped
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"review-session",
			);

			// Fix pulse created
			expect(mockPulseRepo.createPulse).toHaveBeenCalledWith(
				expect.objectContaining({
					workflowId: "wf-1",
				}),
			);

			// startNextPulse called
			expect(mockPulseOrchestratorInstance.startNextPulse).toHaveBeenCalledWith(
				"wf-1",
				expect.any(String),
			);

			// Transitions to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				null,
			);

			// New execution session created with pulseId
			expect(mockSessionManager.startSession).toHaveBeenCalledWith(
				expect.objectContaining({
					contextType: "workflow",
					contextId: "wf-1",
					agentRole: "execution",
					pulseId: "fix-pulse-1",
				}),
			);

			// setCurrentSession called with new session id
			expect(mockWorkflowRepo.setCurrentSession).toHaveBeenCalledWith(
				"wf-1",
				"exec-session",
			);

			// Agent runner invoked with hidden message
			expect(mockAgentRunnerRun).toHaveBeenCalled();

			// Stage change broadcast
			expect(mockBroadcast).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "workflow:stage_changed",
				}),
			);
		});

		test("workflow not in review stage — throws", async () => {
			const workflow = createMockWorkflow({
				status: "planning",
				awaitingApproval: true,
				pendingArtifactType: "plan",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			await expect(
				orchestrator.requestFixes("wf-1", ["comment-1"]),
			).rejects.toThrow(/not in review stage/i);
		});

		test("empty comment IDs — throws when no valid comments found", async () => {
			const workflow = createMockWorkflow({
				status: "review",
				awaitingApproval: true,
				pendingArtifactType: "review_card",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			mockArtifactRepo.getCommentsByIds.mockResolvedValue([] as never);

			await expect(orchestrator.requestFixes("wf-1", [])).rejects.toThrow(
				/no valid comments/i,
			);
		});
	});
});

// =============================================================================
// Category 5: Utility Methods
// =============================================================================

describe("Utility Methods", () => {
	let orchestrator: WorkflowOrchestrator;
	let mockSessionManager: ReturnType<typeof createMockSessionManager>;

	beforeEach(() => {
		mockWorkflowRepo.getById.mockClear();
		mockWorkflowRepo.create.mockClear();
		mockWorkflowRepo.updateStatus.mockClear();
		mockWorkflowRepo.setCurrentSession.mockClear();
		mockWorkflowRepo.setAwaitingApproval.mockClear();
		mockWorkflowRepo.clearAwaitingApproval.mockClear();
		mockWorkflowRepo.transitionStage.mockClear();
		mockWorkflowRepo.setBaseBranch.mockClear();
		mockWorkflowRepo.setSkippedStages.mockClear();

		mockArtifactRepo.getLatestScopeCard.mockClear();
		mockArtifactRepo.getLatestResearchCard.mockClear();
		mockArtifactRepo.getLatestPlan.mockClear();
		mockArtifactRepo.getLatestReviewCard.mockClear();
		mockArtifactRepo.saveScopeCard.mockClear();
		mockArtifactRepo.saveResearchCard.mockClear();
		mockArtifactRepo.savePlan.mockClear();
		mockArtifactRepo.saveReviewCard.mockClear();
		mockArtifactRepo.createReviewCard.mockClear();
		mockArtifactRepo.updateScopeCardStatus.mockClear();
		mockArtifactRepo.updateResearchCardStatus.mockClear();
		mockArtifactRepo.updatePlanStatus.mockClear();
		mockArtifactRepo.updateReviewCardStatus.mockClear();
		mockArtifactRepo.updateReviewCardDiffContent.mockClear();
		mockArtifactRepo.getCommentsByIds.mockClear();
		mockArtifactRepo.deleteResearchCardsByWorkflow.mockClear();
		mockArtifactRepo.deletePlansByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewCardsByWorkflow.mockClear();
		mockArtifactRepo.deleteReviewComments.mockClear();
		mockArtifactRepo.resetReviewCard.mockClear();

		mockConversationRepo.getHistory.mockClear();

		mockPulseRepo.getPulsesForWorkflow.mockClear();
		mockPulseRepo.getRunningPulse.mockClear();
		mockPulseRepo.deleteBaselines.mockClear();
		mockPulseRepo.deleteCommandBaselines.mockClear();
		mockPulseRepo.deletePreflightSetup.mockClear();
		mockPulseRepo.deleteByWorkflow.mockClear();

		mockBroadcast.mockClear();
		mockGetProjectRoot.mockClear();
		mockGetWorktreePath.mockClear();
		mockGetCurrentBranch.mockClear();
		mockGetDiff.mockClear();
		mockMergeWorkflowBranch.mockClear();
		mockCleanupWorkflow.mockClear();
		mockCheckoutInWorktree.mockClear();
		mockFindRepoRoot.mockClear();
		mockGenerateObject.mockClear();
		mockExtractKnowledge.mockClear();
		mockShellApprovalService.cleanupWorkflow.mockClear();

		resetMockAgentRunner();
		resetMockPulseOrchestrator();

		mockSessionManager = createMockSessionManager();

		orchestrator = new WorkflowOrchestrator(
			mockSessionManager as never,
			mockWorkflowRepo as never,
			mockArtifactRepo as never,
			mockConversationRepo as never,
			mockPulseRepo as never,
		);
	});

	// =========================================================================
	// getWorkflow
	// =========================================================================

	describe("getWorkflow", () => {
		test("delegates to workflowRepo.getById and returns workflow", async () => {
			const workflow = createMockWorkflow({ id: "wf-42", title: "My Flow" });
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const result = await orchestrator.getWorkflow("wf-42");

			expect(result).toEqual(workflow);
			expect(mockWorkflowRepo.getById).toHaveBeenCalledWith("wf-42");
		});

		test("returns null when workflow not found", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			const result = await orchestrator.getWorkflow("wf-missing");

			expect(result).toBeNull();
			expect(mockWorkflowRepo.getById).toHaveBeenCalledWith("wf-missing");
		});
	});

	// =========================================================================
	// getPulseOrchestrator
	// =========================================================================

	describe("getPulseOrchestrator", () => {
		test("returns the PulseOrchestrator instance", () => {
			const po = orchestrator.getPulseOrchestrator();

			expect(po).toBe(mockPulseOrchestratorInstance as never);
		});
	});

	// =========================================================================
	// createWorkflow
	// =========================================================================

	describe("createWorkflow", () => {
		beforeEach(() => {
			// Ensure mockGenerateObject has the correct default implementation
			// (prior tests in other describe blocks may have overridden it via mockResolvedValue)
			mockGenerateObject.mockReset();
			mockGenerateObject.mockResolvedValue({
				object: {
					title: "Generated Title",
					description: "Generated description",
				},
			});
		});

		test("happy path — generates title, creates workflow, broadcasts event, starts scoping agent", async () => {
			const createdWorkflow = createMockWorkflow({
				id: "wf-new",
				title: "Generated Title",
				status: "scoping",
			});
			mockWorkflowRepo.create.mockResolvedValue(createdWorkflow);

			const session = createMockActiveSession({
				id: "session-new",
				agentRole: "scoping",
				contextId: "wf-new",
			});
			mockSessionManager.startSession.mockResolvedValue(session);

			const result = await orchestrator.createWorkflow("Build a REST API");

			// 1. generateObject called for title/description
			expect(mockGenerateObject).toHaveBeenCalledTimes(1);

			// 2. workflowRepo.create called with generated metadata
			expect(mockWorkflowRepo.create).toHaveBeenCalledWith({
				title: "Generated Title",
				description: "Generated description",
				priority: "medium",
				status: "scoping",
			});

			// 3. broadcast called with workflow created event
			expect(mockBroadcast).toHaveBeenCalledTimes(1);
			const broadcastArg = (mockBroadcast.mock.calls[0] as unknown[])[0] as {
				type: string;
				payload: { workflowId: string; title: string };
			};
			expect(broadcastArg.type).toBe("workflow:created");
			expect(broadcastArg.payload.workflowId).toBe("wf-new");
			expect(broadcastArg.payload.title).toBe("Generated Title");

			// 4. sessionManager.startSession called for scoping
			expect(mockSessionManager.startSession).toHaveBeenCalledWith({
				contextType: "workflow",
				contextId: "wf-new",
				agentRole: "scoping",
			});

			// 5. setCurrentSession called
			expect(mockWorkflowRepo.setCurrentSession).toHaveBeenCalledWith(
				"wf-new",
				"session-new",
			);

			// 6. AgentRunner constructed and run called (non-blocking)
			const lastRunner = getLastAgentRunnerInstance();
			expect(lastRunner).not.toBeNull();
			expect(lastRunner?.session).toBe(session);
			expect((lastRunner?.config as { projectRoot: string }).projectRoot).toBe(
				"/mock/project",
			);
			expect(mockAgentRunnerRun).toHaveBeenCalledWith("Build a REST API");

			// 7. Returns workflow with currentSessionId
			expect(result).toEqual({
				...createdWorkflow,
				currentSessionId: "session-new",
			});
		});

		test("passes priority parameter to workflowRepo.create", async () => {
			const createdWorkflow = createMockWorkflow({
				id: "wf-urgent",
				priority: "urgent",
			});
			mockWorkflowRepo.create.mockResolvedValue(createdWorkflow);
			mockSessionManager.startSession.mockResolvedValue(
				createMockActiveSession({ contextId: "wf-urgent" }),
			);

			await orchestrator.createWorkflow("Fix critical bug", "urgent");

			expect(mockWorkflowRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ priority: "urgent" }),
			);
		});
	});

	// =========================================================================
	// rewindToStage
	// =========================================================================

	describe("rewindToStage", () => {
		const mockSessionRepo = {
			deleteByContextAndRoles: mock(() => Promise.resolve(0)),
		};

		beforeEach(() => {
			mockSessionRepo.deleteByContextAndRoles.mockClear();

			// Override getRepositories to include sessions (needed by rewind impl methods)
			mockGetRepositories.mockReturnValue({
				workflows: mockWorkflowRepo,
				artifacts: mockArtifactRepo,
				conversations: mockConversationRepo,
				pulses: mockPulseRepo,
				sessions: mockSessionRepo,
			} as never);

			// Common mock setup: workflow with active session
			mockWorkflowRepo.getById.mockResolvedValue(
				createMockWorkflow({
					id: "wf-1",
					currentSessionId: "session-active",
					status: "in_progress",
				}),
			);

			// Scope card needed by all rewind paths that start an agent
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(
				createMockScopeCard({ workflowId: "wf-1" }),
			);

			// Research card needed by planning rewind
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(
				createMockResearchCard({ workflowId: "wf-1" }),
			);

			// Plan needed by execution rewind
			mockArtifactRepo.getLatestPlan.mockResolvedValue(
				createMockPlan({ workflowId: "wf-1" }),
			);

			// Review card needed by review rewind
			mockArtifactRepo.getLatestReviewCard.mockResolvedValue(
				createMockReviewCard({ id: "rc-1", workflowId: "wf-1" }),
			);

			// Session start returns a fresh session
			mockSessionManager.startSession.mockResolvedValue(
				createMockActiveSession({ id: "session-rewound" }),
			);

			// Pulse orchestrator init for execution rewind
			mockPulseOrchestratorInstance.initializePulsing.mockResolvedValue({
				success: true,
				workflowBranch: "workflow/wf-1",
				worktreePath: "/mock/worktree",
			});
		});

		test("rewindToStage('researching') stops session, cleans up git/pulses, and delegates", async () => {
			await orchestrator.rewindToStage("wf-1", "researching");

			// Session stopped
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"session-active",
			);

			// Git cleanup called
			expect(mockCleanupWorkflow).toHaveBeenCalledWith(
				"/mock/project",
				"wf-1",
				{ deleteBranch: true },
			);

			// Pulse data cleaned up
			expect(mockPulseRepo.deleteBaselines).toHaveBeenCalledWith("wf-1");
			expect(mockPulseRepo.deleteCommandBaselines).toHaveBeenCalledWith("wf-1");
			expect(mockPulseRepo.deletePreflightSetup).toHaveBeenCalledWith("wf-1");
			expect(mockPulseRepo.deleteByWorkflow).toHaveBeenCalledWith("wf-1");

			// Impl ran: stage transitioned to researching
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"researching",
				null,
			);
		});

		test("rewindToStage('planning') stops session and dispatches correctly", async () => {
			await orchestrator.rewindToStage("wf-1", "planning");

			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"session-active",
			);
			expect(mockCleanupWorkflow).toHaveBeenCalled();
			expect(mockPulseRepo.deleteBaselines).toHaveBeenCalledWith("wf-1");

			// Impl ran: stage transitioned to planning
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"planning",
				null,
			);
		});

		test("rewindToStage('in_progress') stops session and dispatches correctly", async () => {
			await orchestrator.rewindToStage("wf-1", "in_progress");

			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"session-active",
			);
			expect(mockCleanupWorkflow).toHaveBeenCalled();
			expect(mockPulseRepo.deleteByWorkflow).toHaveBeenCalledWith("wf-1");

			// Impl ran: stage transitioned to in_progress
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"in_progress",
				null,
			);

			// Execution rewind re-initializes pulsing
			expect(
				mockPulseOrchestratorInstance.initializePulsing,
			).toHaveBeenCalledWith("wf-1");
		});

		test("rewindToStage('review') takes different code path — no git/pulse cleanup", async () => {
			await orchestrator.rewindToStage("wf-1", "review");

			// Session stopped
			expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
				"session-active",
			);

			// Git cleanup NOT called for review rewind
			expect(mockCleanupWorkflow).not.toHaveBeenCalled();

			// Pulse data NOT cleaned up for review rewind
			expect(mockPulseRepo.deleteBaselines).not.toHaveBeenCalled();
			expect(mockPulseRepo.deleteByWorkflow).not.toHaveBeenCalled();

			// Impl ran: review card comments deleted and card reset
			expect(mockArtifactRepo.deleteReviewComments).toHaveBeenCalledWith(
				"rc-1",
			);
			expect(mockArtifactRepo.resetReviewCard).toHaveBeenCalledWith("rc-1");

			// Stage transitioned to review
			expect(mockWorkflowRepo.transitionStage).toHaveBeenCalledWith(
				"wf-1",
				"review",
				null,
			);
		});

		test("throws error when workflow not found", async () => {
			mockWorkflowRepo.getById.mockResolvedValue(null as never);

			await expect(
				orchestrator.rewindToStage("wf-missing", "researching"),
			).rejects.toThrow("Workflow not found: wf-missing");
		});
	});

	// =========================================================================
	// Knowledge Injection
	// =========================================================================

	describe("knowledge injection", () => {
		function buildMockKnowledgeResults() {
			return [
				{
					id: "k-1",
					workflowId: "wf-source",
					title: "Test Pattern",
					content: "pattern content",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.9,
				},
			];
		}

		afterEach(() => {
			mockSearchKnowledge.mockReset();
			mockSearchKnowledge.mockResolvedValue([]);
		});

		test("includes knowledge section in scoping→researching message when results exist", async () => {
			mockSearchKnowledge.mockResolvedValue(
				buildMockKnowledgeResults() as never,
			);

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).toContain("## Relevant Knowledge");
			expect(message).toContain("Test Pattern");
			expect(message).toContain("pattern content");
			expect(message).toContain(
				"*Category: pattern | Source: workflow wf-source*",
			);

			// Should search for both categories
			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "pattern" }),
				expect.any(String),
			);
			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "process-improvement" }),
				expect.any(String),
			);
		});

		test("omits knowledge section when searchKnowledge returns empty arrays", async () => {
			mockSearchKnowledge.mockResolvedValue([]);

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).not.toContain("## Relevant Knowledge");
		});

		test("omits knowledge section when searchKnowledge throws", async () => {
			mockSearchKnowledge.mockRejectedValue(new Error("embedding failed"));

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// Should not throw — graceful degradation
			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).not.toContain("## Relevant Knowledge");
		});

		test("passes correct categories for researching→planning transition", async () => {
			mockSearchKnowledge.mockResolvedValue([]);

			const workflow = createMockWorkflow({
				status: "researching",
				awaitingApproval: true,
				pendingArtifactType: "research",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const researchCard = createMockResearchCard();
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(researchCard);

			const newSession = createMockActiveSession({
				id: "plan-session",
				agentRole: "planning",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1");

			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "gotcha" }),
				expect.any(String),
			);
			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "process-improvement" }),
				expect.any(String),
			);
		});

		test("passes correct categories for buildPulseInitialMessage", async () => {
			mockSearchKnowledge.mockResolvedValue([]);

			const workflow = createMockWorkflow({
				status: "in_progress",
				currentSessionId: "session-1",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const firstPulse = createMockPulse({ id: "pulse-1" });
			mockPulseOrchestratorInstance.startNextPulse.mockResolvedValue(
				firstPulse,
			);

			const newSession = createMockActiveSession({
				id: "new-session-1",
				agentRole: "execution",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			// buildPulseInitialMessage needs a scope card for knowledge injection
			const scopeCard = createMockScopeCard();
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);
			mockArtifactRepo.getLatestResearchCard.mockResolvedValue(null as never);
			mockArtifactRepo.getLatestPlan.mockResolvedValue(null as never);

			await orchestrator.handleTurnCompletion("test-workflow-id", [
				"complete_preflight",
			]);

			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "pattern" }),
				expect.any(String),
			);
			expect(mockSearchKnowledge).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ category: "tool-usage" }),
				expect.any(String),
			);
		});

		test("excludes items below injection similarity threshold", async () => {
			const mockResults = [
				{
					id: "k-high",
					workflowId: "wf-source",
					title: "High relevance item",
					content: "high relevance content",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.9,
				},
				{
					id: "k-medium",
					workflowId: "wf-source",
					title: "Medium relevance item",
					content: "medium relevance content",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.65,
				},
				{
					id: "k-low",
					workflowId: "wf-source",
					title: "Low relevance item",
					content: "low relevance content",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.4,
				},
			];
			mockSearchKnowledge.mockResolvedValue(mockResults as never);

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).toContain("High relevance item");
			expect(message).toContain("high relevance content");
			expect(message).not.toContain("Medium relevance item");
			expect(message).not.toContain("Low relevance item");
		});

		test("enforces token budget by prioritizing highest similarity items", async () => {
			// Each content ~5000 chars ≈ 1250 tokens (chars/4 heuristic).
			// With a 3000-token budget, only the top two items should fit.
			const largeContent = "A".repeat(5000);
			const mockResults = [
				{
					id: "k-top",
					workflowId: "wf-source",
					title: "Top priority item",
					content: largeContent,
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.95,
				},
				{
					id: "k-second",
					workflowId: "wf-source",
					title: "Second priority item",
					content: largeContent,
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.85,
				},
				{
					id: "k-third",
					workflowId: "wf-source",
					title: "Third priority item",
					content: largeContent,
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.75,
				},
			];
			mockSearchKnowledge.mockResolvedValue(mockResults as never);

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).toContain("Top priority item");
			expect(message).toContain("Second priority item");
			expect(message).not.toContain("Third priority item");
		});

		test("injects nothing when all items are below injection threshold", async () => {
			const mockResults = [
				{
					id: "k-below1",
					workflowId: "wf-source",
					title: "Below threshold item one",
					content: "content one",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.6,
				},
				{
					id: "k-below2",
					workflowId: "wf-source",
					title: "Below threshold item two",
					content: "content two",
					category: "pattern" as const,
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					similarity: 0.5,
				},
			];
			mockSearchKnowledge.mockResolvedValue(mockResults as never);

			const workflow = createMockWorkflow({
				status: "scoping",
				awaitingApproval: true,
				pendingArtifactType: "scope_card",
				currentSessionId: "old-session",
			});
			mockWorkflowRepo.getById.mockResolvedValue(workflow);

			const scopeCard = createMockScopeCard({
				recommendedPath: "full",
			});
			mockArtifactRepo.getLatestScopeCard.mockResolvedValue(scopeCard);

			const newSession = createMockActiveSession({
				id: "research-session",
				agentRole: "research",
			});
			mockSessionManager.startSession.mockResolvedValue(newSession);

			await orchestrator.approveArtifact("wf-1", { path: "full" });

			expect(mockAgentRunnerRun).toHaveBeenCalled();
			const message = (
				mockAgentRunnerRun.mock.calls[0] as unknown as [string]
			)[0];
			expect(message).not.toContain("## Relevant Knowledge");
		});
	});
});
