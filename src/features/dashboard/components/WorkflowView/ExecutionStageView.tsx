/**
 * ExecutionStageView - View for the execution (in_progress) workflow stage
 *
 * Displays preflight setup (if exists) and pulses as collapsible sections.
 * Each section shows its status with appropriate icon and auto-expands/collapses
 * based on running/completed state.
 */

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Circle,
	Loader2,
	Ruler,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
	Plan,
	PreflightSetup,
	Pulse,
	PulseDefinition,
} from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";
import {
	WorkflowMessageBubble,
	WorkflowStreamingBubble,
} from "../ChannelView/MessageBubble";
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
 * Status-based container styling for pulse and preflight cards.
 * Maps status values to Tailwind border and background classes.
 * Includes both Pulse statuses and PreflightSetup statuses.
 */
const STATUS_CONTAINER_STYLES = {
	proposed: "border-gray-300 bg-gray-50/50",
	running: "border-orange-500/50 bg-orange-500/5",
	succeeded: "border-green-500/30 bg-green-500/5",
	completed: "border-green-500/30 bg-green-500/5", // PreflightSetup equivalent of succeeded
	failed: "border-red-500/50 bg-red-500/10",
	stopped: "border-gray-400/50 bg-gray-100/50",
} as const;

/**
 * Get the style classes for a pulse size badge.
 * Duplicated from PlanCardApproval for consistency.
 */
function getSizeBadgeClasses(size: PulseDefinition["estimatedSize"]): string {
	switch (size) {
		case "small":
			return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
		case "medium":
			return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
		case "large":
			return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
		default:
			return "bg-muted text-muted-foreground";
	}
}

/**
 * Get container classes for a pulse or preflight based on its status.
 * Includes transition classes with reduced-motion accessibility support.
 */
function getStatusContainerClasses(
	status: Pulse["status"] | PreflightSetup["status"],
): string {
	return `${STATUS_CONTAINER_STYLES[status]} transition-colors duration-200 motion-reduce:transition-none`;
}

/**
 * Collapsible item for preflight setup
 */
function PreflightCollapsibleItem({
	preflightSetup,
	messages,
	streamingMessage,
}: {
	preflightSetup: PreflightSetup;
	messages: ExecutionStageViewProps["messages"];
	streamingMessage?: StreamingMessage | null;
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

	// Check if streaming message is for preflight
	const isStreamingPreflight = streamingMessage?.agentRole === "preflight";

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={`flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent/30 transition-colors ${getStatusContainerClasses(preflightSetup.status)}`}
				>
					<div className="flex items-center gap-3">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<span className="font-medium text-base">Preflight Setup</span>
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
						<WorkflowMessageBubble key={message.id} message={message} />
					))}
					{isStreamingPreflight && (
						<WorkflowStreamingBubble message={streamingMessage} />
					)}
					{preflightMessages.length === 0 &&
						!isStreamingPreflight &&
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
	index,
	messages,
	pulseDefinitionMap,
	streamingMessage,
}: {
	pulse: Pulse;
	index: number;
	messages: ExecutionStageViewProps["messages"];
	pulseDefinitionMap: Map<string, PulseDefinition>;
	streamingMessage?: StreamingMessage | null;
}) {
	// Auto-expand based on status: running = true, completed/failed = false
	const [isOpen, setIsOpen] = useState(pulse.status === "running");

	// Update open state when status changes
	useEffect(() => {
		setIsOpen(pulse.status === "running");
	}, [pulse.status]);

	// Filter messages for this pulse by pulseId
	const pulseMessages = messages.filter(
		(msg) => msg.agentRole === "execution" && msg.pulseId === pulse.id,
	);

	// Check if streaming message is for this pulse
	const isStreamingThisPulse =
		streamingMessage?.agentRole === "execution" &&
		streamingMessage?.pulseId === pulse.id;

	// Get pulse definition from plan for title/description
	const pulseDef = pulse.plannedPulseId
		? pulseDefinitionMap.get(pulse.plannedPulseId)
		: undefined;

	// Use plan's title/description if available, otherwise fall back to pulse.description
	const pulseTitle = pulseDef?.title ?? pulse.description.split("\n")[0];
	const pulseDescription =
		pulseDef?.description ?? pulse.description.split("\n").slice(1).join("\n");

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={`flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent/30 transition-colors ${getStatusContainerClasses(pulse.status)}`}
				>
					<div className="flex items-center gap-3">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
							{index + 1}
						</span>
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
					{/* Pulse Metadata from Plan */}
					{pulseDef && (
						<div className="border rounded-lg p-3 bg-background mb-3">
							{/* Size Estimate */}
							<div className="flex items-center gap-2 mb-2">
								<Badge
									variant="outline"
									className={cn(
										"text-xs",
										getSizeBadgeClasses(pulseDef.estimatedSize),
									)}
								>
									<Ruler className="h-3 w-3 mr-1" />
									{pulseDef.estimatedSize}
								</Badge>
							</div>

							{/* Expected Files */}
							<div className="text-xs">
								<span className="text-muted-foreground font-medium">
									Files:{" "}
								</span>
								<span className="flex flex-wrap gap-1.5 mt-1">
									{pulseDef.expectedChanges.map((file) => (
										<code
											key={file}
											className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs"
										>
											{file}
										</code>
									))}
								</span>
							</div>

							{/* Dependencies */}
							{pulseDef.dependsOn && pulseDef.dependsOn.length > 0 && (
								<div className="text-xs mt-2">
									<span className="text-muted-foreground font-medium">
										Depends on:{" "}
									</span>
									<span className="inline-flex items-center gap-1">
										{pulseDef.dependsOn.map((dep, i) => (
											<span key={dep} className="inline-flex items-center">
												<code className="font-mono text-amber-600 dark:text-amber-400">
													{dep}
												</code>
												{i < (pulseDef.dependsOn?.length ?? 0) - 1 && (
													<ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
												)}
											</span>
										))}
									</span>
								</div>
							)}
						</div>
					)}

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
						<WorkflowMessageBubble key={message.id} message={message} />
					))}
					{isStreamingThisPulse && (
						<WorkflowStreamingBubble message={streamingMessage} />
					)}
					{pulseMessages.length === 0 &&
						!isStreamingThisPulse &&
						pulse.status === "running" && (
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
	streamingMessage,
	pulses,
	preflightSetup,
	plans,
}: ExecutionStageViewProps) {
	// Build lookup map from plannedPulseId to PulseDefinition from the latest approved plan
	const pulseDefinitionMap = useMemo(() => {
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

	const completedCount = pulses.filter((p) => p.status === "succeeded").length;
	const unresolvedCount = pulses.filter((p) => p.hasUnresolvedIssues).length;
	const runningPulse = pulses.find((p) => p.status === "running") ?? null;
	const progressPct =
		pulses.length > 0 ? Math.round((completedCount / pulses.length) * 100) : 0;

	return (
		<div className="flex flex-col gap-3">
			<div className="rounded-xl border bg-card p-4">
				<div className="mb-3 flex items-center justify-between">
					<div>
						<p className="text-sm font-medium">Execution Progress</p>
						<p className="text-xs text-muted-foreground">
							{completedCount} of {pulses.length} pulses completed
							{runningPulse && ` · Running: ${runningPulse.description}`}
						</p>
					</div>
					<div className="text-right">
						<p className="text-lg font-semibold tabular-nums">{progressPct}%</p>
						{unresolvedCount > 0 && (
							<p className="text-xs text-amber-600 dark:text-amber-400">
								{unresolvedCount} unresolved
							</p>
						)}
					</div>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full bg-primary transition-all duration-500"
						style={{ width: `${progressPct}%` }}
					/>
				</div>
			</div>
			{/* Preflight Setup - only render if it exists (quick path workflows skip this) */}
			{preflightSetup && (
				<PreflightCollapsibleItem
					preflightSetup={preflightSetup}
					messages={messages}
					streamingMessage={streamingMessage}
				/>
			)}

			{/* Pulses */}
			{pulses.map((pulse, index) => (
				<PulseCollapsibleItem
					key={pulse.id}
					pulse={pulse}
					index={index}
					messages={messages}
					pulseDefinitionMap={pulseDefinitionMap}
					streamingMessage={streamingMessage}
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
