/**
 * WorkflowOrchestrator unit tests — Category 1: Stage Transitions
 *
 * Covers full pipeline transitions (scoping→researching→planning→in_progress→review→done),
 * quick path, handleToolResult routing, handleTurnCompletion deferred transitions,
 * and STAGE_TRANSITIONS constant validation.
 */

import { beforeEach, describe, expect, test } from "bun:test";

// =============================================================================
// Mock setup — MUST happen before importing WorkflowOrchestrator
// =============================================================================

import {
	createMockActiveSession,
	createMockPulse,
	createMockReviewCard,
	createMockScopeCard,
	createMockSessionManager,
	createMockWorkflow,
	mockAgentRunnerRun,
	mockArtifactRepo,
	mockBroadcast,
	mockCleanupWorkflow,
	mockConversationRepo,
	mockExtractKnowledge,
	mockGetCurrentBranch,
	mockGetDiff,
	mockGetProjectRoot,
	mockGetWorktreePath,
	mockMergeWorkflowBranch,
	mockPulseOrchestratorInstance,
	mockPulseRepo,
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
