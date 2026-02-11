/**
 * Test fixture factories
 *
 * Each factory returns a default object with sensible test values.
 * Pass overrides to customize specific fields via shallow merge.
 */

import type { Pulse } from "@/backend/repositories/PulseRepository";
import type {
	Plan,
	ResearchCard,
	ReviewCard,
	ScopeCard,
	Workflow,
} from "@/shared/schemas/workflow";
import type { ActiveSession } from "../../types";

// =============================================================================
// Workflow
// =============================================================================

export function createMockWorkflow(overrides?: Partial<Workflow>): Workflow {
	return {
		id: "wf-1",
		title: "Test Workflow",
		status: "scoping",
		priority: "medium",
		awaitingApproval: false,
		archived: false,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// ActiveSession
// =============================================================================

export function createMockActiveSession(
	overrides?: Partial<ActiveSession>,
): ActiveSession {
	return {
		id: "session-1",
		contextType: "workflow",
		contextId: "wf-1",
		agentRole: "scoping",
		status: "active",
		abortController: new AbortController(),
		createdAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// Pulse
// =============================================================================

export function createMockPulse(overrides?: Partial<Pulse>): Pulse {
	return {
		id: "pulse-1",
		workflowId: "wf-1",
		plannedPulseId: "planned-1",
		status: "running",
		description: "Test pulse",
		hasUnresolvedIssues: false,
		isRecoveryCheckpoint: false,
		rejectionCount: 0,
		createdAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// ScopeCard
// =============================================================================

export function createMockScopeCard(overrides?: Partial<ScopeCard>): ScopeCard {
	return {
		id: "sc-1",
		workflowId: "wf-1",
		title: "Test",
		description: "Test scope",
		inScope: ["item1"],
		outOfScope: ["item2"],
		recommendedPath: "full",
		status: "approved",
		createdAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// Plan
// =============================================================================

export function createMockPlan(overrides?: Partial<Plan>): Plan {
	return {
		id: "plan-1",
		workflowId: "wf-1",
		approachSummary: "Test approach",
		pulses: [
			{
				id: "pd-1",
				title: "Pulse 1",
				description: "Do thing",
				expectedChanges: ["file.ts"],
				estimatedSize: "small",
			},
		],
		status: "approved",
		createdAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// ReviewCard
// =============================================================================

export function createMockReviewCard(
	overrides?: Partial<ReviewCard>,
): ReviewCard {
	return {
		id: "rc-1",
		workflowId: "wf-1",
		recommendation: "approve",
		summary: "Looks good",
		comments: [],
		status: "approved",
		createdAt: Date.now(),
		...overrides,
	};
}

// =============================================================================
// ResearchCard
// =============================================================================

export function createMockResearchCard(
	overrides?: Partial<ResearchCard>,
): ResearchCard {
	return {
		id: "research-1",
		workflowId: "wf-1",
		summary: "Test research summary",
		keyFiles: [{ path: "src/index.ts", purpose: "Entry point" }],
		recommendations: ["Use existing patterns"],
		status: "approved",
		createdAt: Date.now(),
		...overrides,
	};
}
