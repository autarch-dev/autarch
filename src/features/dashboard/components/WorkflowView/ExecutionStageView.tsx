/**
 * ExecutionStageView - View for the execution (in_progress) workflow stage
 *
 * Displays preflight setup (if exists) and pulses as collapsible sections.
 * Each section shows its status with appropriate icon and auto-expands/collapses
 * based on running/completed state.
 */

import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Circle,
	Loader2,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
	Plan,
	PreflightSetup,
	Pulse,
	PulseDefinition,
} from "@/shared/schemas/workflow";
import { ChannelMessageBubble } from "../ChannelView/MessageBubble";
import type { StageViewProps } from "./types";

/**
 * Extended props for ExecutionStageView.
 * Includes pulses and preflightSetup data for execution stage rendering.
 */
export interface ExecutionStageViewProps extends StageViewProps {
	/** Pulses for this workflow */
	pulses: Pulse[];
	/** Preflight setup for this workflow (optional - quick path workflows skip this) */
	preflightSetup?: PreflightSetup;
	/** Plans for this workflow (used to retrieve pulse metadata via plannedPulseId) */
	plans: Plan[];
}

/**
 * Status badge component for preflight and pulse items
 */
function StatusBadge({
	status,
}: {
	status: Pulse["status"] | PreflightSetup["status"];
}) {
	switch (status) {
		case "proposed":
			return (
				<span className="flex items-center gap-1 text-gray-500">
					<Circle className="h-4 w-4" />
					<span className="text-xs">Proposed</span>
				</span>
			);
		case "running":
			return (
				<span className="flex items-center gap-1 text-orange-500">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-xs">Running</span>
				</span>
			);
		case "completed":
		case "succeeded":
			return (
				<span className="flex items-center gap-1 text-green-500">
					<CheckCircle className="h-4 w-4" />
					<span className="text-xs">Succeeded</span>
				</span>
			);
		case "failed":
			return (
				<span className="flex items-center gap-1 text-red-500">
					<XCircle className="h-4 w-4" />
					<span className="text-xs">Failed</span>
				</span>
			);
		case "stopped":
			return (
				<span className="flex items-center gap-1 text-gray-500">
					<XCircle className="h-4 w-4" />
					<span className="text-xs">Stopped</span>
				</span>
			);
	}
}

/**
 * Collapsible item for preflight setup
 */
function PreflightCollapsibleItem({
	preflightSetup,
	messages,
}: {
	preflightSetup: PreflightSetup;
	messages: ExecutionStageViewProps["messages"];
}) {
	// Auto-expand based on status: running = true, completed/failed = false
	const [isOpen, setIsOpen] = useState(preflightSetup.status === "running");

	// Update open state when status changes
	useEffect(() => {
		setIsOpen(preflightSetup.status === "running");
	}, [preflightSetup.status]);

	// Filter messages for preflight - messages where agentRole is "preflight"
	const preflightMessages = messages.filter(
		(msg) => msg.agentRole === "preflight",
	);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
				>
					<div className="flex items-center gap-2">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<span className="font-medium">Preflight Setup</span>
					</div>
					<StatusBadge status={preflightSetup.status} />
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-2 space-y-2 pl-6">
					{preflightSetup.progressMessage && (
						<p className="text-sm text-muted-foreground">
							{preflightSetup.progressMessage}
						</p>
					)}
					{preflightSetup.errorMessage && (
						<p className="text-sm text-red-500">
							{preflightSetup.errorMessage}
						</p>
					)}
					{preflightMessages.map((message) => (
						<ChannelMessageBubble key={message.id} message={message} />
					))}
					{preflightMessages.length === 0 &&
						preflightSetup.status === "running" && (
							<p className="text-sm text-muted-foreground italic">
								Setting up environment...
							</p>
						)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Collapsible item for a pulse
 */
function PulseCollapsibleItem({
	pulse,
	messages,
}: {
	pulse: Pulse;
	messages: ExecutionStageViewProps["messages"];
}) {
	// Auto-expand based on status: running = true, completed/failed = false
	const [isOpen, setIsOpen] = useState(pulse.status === "running");

	// Update open state when status changes
	useEffect(() => {
		setIsOpen(pulse.status === "running");
	}, [pulse.status]);

	// Filter messages for this pulse - messages where agentRole is "execution"
	// Note: In a future enhancement, this could be filtered by session.pulseId matching pulse.id
	// For now, we show all execution messages under all pulses (to be refined when session-pulse linking is complete)
	const pulseMessages = messages.filter((msg) => msg.agentRole === "execution");
	const pulseTitle = pulse.description.split("\n")[0];
	const pulseDescription = pulse.description.split("\n").slice(1).join("\n");

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
				>
					<div className="flex items-center gap-2">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<span className="font-medium">{pulseTitle}</span>
					</div>
					<div className="flex items-center gap-2">
						{pulse.hasUnresolvedIssues && (
							<span className="flex items-center gap-1 text-yellow-500">
								<AlertTriangle className="h-4 w-4" />
								<span className="text-xs">Unresolved Issues</span>
							</span>
						)}
						<StatusBadge status={pulse.status} />
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-2 space-y-2 pl-6">
					{pulse.hasUnresolvedIssues && (
						<div className="flex items-center gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2">
							<AlertTriangle className="h-4 w-4 text-yellow-500" />
							<span className="text-sm text-yellow-500">
								This pulse has unresolved issues that need attention.
							</span>
						</div>
					)}
					{pulseDescription && (
						<p className="text-sm text-muted-foreground">{pulseDescription}</p>
					)}
					{pulseMessages.map((message) => (
						<ChannelMessageBubble key={message.id} message={message} />
					))}
					{pulseMessages.length === 0 && pulse.status === "running" && (
						<p className="text-sm text-muted-foreground italic">
							Executing pulse...
						</p>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * ExecutionStageView component
 *
 * Renders the execution stage with collapsible sections for:
 * 1. Preflight Setup (if exists - skipped for quick path workflows)
 * 2. Each pulse in the execution plan
 */
export function ExecutionStageView({
	messages,
	pulses,
	preflightSetup,
	plans,
}: ExecutionStageViewProps) {
	// Build lookup map from plannedPulseId to PulseDefinition from the latest approved plan
	// Prefixed with underscore as it will be used in a future pulse for metadata display
	const _pulseDefinitionMap = useMemo(() => {
		const approvedPlans = plans.filter((plan) => plan.status === "approved");
		if (approvedPlans.length === 0) {
			return new Map<string, PulseDefinition>();
		}

		// Sort by createdAt descending and take the first (latest)
		const sortedPlans = approvedPlans.sort((a, b) => b.createdAt - a.createdAt);
		const latestPlan = sortedPlans[0];
		if (!latestPlan) {
			return new Map<string, PulseDefinition>();
		}

		// Build map from pulse id to PulseDefinition
		const map = new Map<string, PulseDefinition>();
		for (const pulse of latestPlan.pulses) {
			map.set(pulse.id, pulse);
		}
		return map;
	}, [plans]);

	return (
		<div className="flex flex-col gap-3 p-4">
			{/* Preflight Setup - only render if it exists (quick path workflows skip this) */}
			{preflightSetup && (
				<PreflightCollapsibleItem
					preflightSetup={preflightSetup}
					messages={messages}
				/>
			)}

			{/* Pulses */}
			{pulses.map((pulse) => (
				<PulseCollapsibleItem
					key={pulse.id}
					pulse={pulse}
					messages={messages}
				/>
			))}

			{/* Empty state when no pulses yet */}
			{pulses.length === 0 && !preflightSetup && (
				<div className="flex items-center justify-center p-8 text-muted-foreground">
					<p>Waiting for execution to begin...</p>
				</div>
			)}
		</div>
	);
}
