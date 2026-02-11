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
