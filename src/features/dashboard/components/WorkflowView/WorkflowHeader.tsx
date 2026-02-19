import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	fetchCostByModel,
	fetchCostByRole,
} from "@/features/costs/api/costApi";
import { shortModelName } from "@/features/costs/utils/formatModelName";
import { cn } from "@/lib/utils";
import { AGENT_ROLE_DISPLAY_LABELS } from "@/shared/schemas/costs";
import type { Workflow, WorkflowStatus } from "@/shared/schemas/workflow";
import { useWorkflowsStore } from "../../store/workflowsStore";
import { statusConfig } from "./config";
import { PhaseIndicator } from "./PhaseIndicator";

interface CostData {
	modelId: string;
	totalCost: number;
	promptTokens: number;
	completionTokens: number;
}

interface RoleData {
	agentRole: string;
	totalCost: number;
	promptTokens: number;
	completionTokens: number;
}

interface WorkflowHeaderProps {
	workflow: Workflow;
	totalCost: number | null;
	onArchived?: () => void;
	viewedStage?: WorkflowStatus;
	onStageClick?: (stage: WorkflowStatus) => void;
}

export function WorkflowHeader({
	workflow,
	totalCost,
	onArchived,
	viewedStage,
	onStageClick,
}: WorkflowHeaderProps) {
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] =
		useState<boolean>(false);
	const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
	const [costByModel, setCostByModel] = useState<CostData[] | null>(null);
	const [costByRole, setCostByRole] = useState<RoleData[] | null>(null);
	const [costLoading, setCostLoading] = useState<boolean>(false);
	const [costError, setCostError] = useState<Error | null>(null);
	const archiveWorkflow = useWorkflowsStore((state) => state.archiveWorkflow);

	const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

	const loadCostData = async (open: boolean) => {
		if (!open) return;
		setCostLoading(true);
		setCostError(null);
		try {
			const [modelData, roleData] = await Promise.all([
				fetchCostByModel({ workflowId: workflow.id }),
				fetchCostByRole({ workflowId: workflow.id }),
			]);
			setCostByModel(modelData);
			setCostByRole(roleData);
		} catch (error) {
			setCostError(
				error instanceof Error ? error : new Error("Failed to load cost data"),
			);
		} finally {
			setCostLoading(false);
		}
	};
	const status = statusConfig[workflow.status];
	const StatusIcon = status.icon;

	return (
		<>
			<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-4">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 flex-1">
							<div className="mb-1 flex items-center gap-2">
								<StatusIcon className={cn("size-4", status.color)} />
								<h2 className="truncate text-lg font-semibold">
									{workflow.title}
								</h2>
							</div>
							{workflow.description && (
								<p className="line-clamp-2 text-sm text-muted-foreground">
									{workflow.description}
								</p>
							)}
						</div>
						<div className="ml-4 flex items-center gap-2">
							<Badge
								variant="secondary"
								className={cn(status.bg, status.color)}
							>
								{status.label}
							</Badge>
							<Popover
								open={isPopoverOpen}
								onOpenChange={(open) => {
									setIsPopoverOpen(open);
									loadCostData(open);
								}}
							>
								<PopoverTrigger asChild>
									<Badge
										variant="secondary"
										className="cursor-pointer bg-muted hover:bg-muted/80"
									>
										Cost: {totalCost ? formatCurrency(totalCost) : "—"}
									</Badge>
								</PopoverTrigger>
								<PopoverContent align="end" className="w-80">
									<ScrollArea className="max-h-48">
										{costLoading && (
											<p className="text-sm text-muted-foreground">
												Loading...
											</p>
										)}
										{costError && (
											<p className="text-sm text-destructive">
												{costError.message}
											</p>
										)}
										{!costLoading &&
											!costError &&
											!costByModel &&
											!costByRole && (
												<p className="text-sm text-muted-foreground">
													No cost data available
												</p>
											)}
										{!costLoading &&
											!costError &&
											(costByModel?.length || costByRole?.length) && (
												<div className="space-y-3">
													{costByModel && costByModel.length > 0 && (
														<div>
															<p className="mb-1 text-xs font-medium text-muted-foreground">
																Cost by Model
															</p>
															{costByModel.map((item) => (
																<div
																	key={item.modelId}
																	className="flex justify-between text-sm"
																>
																	<span>{shortModelName(item.modelId)}</span>
																	<span>
																		{formatCurrency(item.totalCost)} (
																		{item.promptTokens + item.completionTokens}{" "}
																		tokens)
																	</span>
																</div>
															))}
														</div>
													)}
													{costByRole && costByRole.length > 0 && (
														<div>
															<p className="mb-1 text-xs font-medium text-muted-foreground">
																Cost by Role
															</p>
															{costByRole.map((item) => (
																<div
																	key={item.agentRole}
																	className="flex justify-between text-sm"
																>
																	<span>
																		{AGENT_ROLE_DISPLAY_LABELS[
																			item.agentRole
																		] || item.agentRole}
																	</span>
																	<span>
																		{formatCurrency(item.totalCost)} (
																		{item.promptTokens + item.completionTokens}{" "}
																		tokens)
																	</span>
																</div>
															))}
														</div>
													)}
													{costByModel && costByModel.length > 0 && (
														<div className="border-t pt-2">
															<p className="mb-1 text-xs font-medium text-muted-foreground">
																Token Totals
															</p>
															<div className="flex justify-between text-sm">
																<span>Prompt Tokens</span>
																<span>
																	{costByModel.reduce(
																		(sum, m) => sum + m.promptTokens,
																		0,
																	)}
																</span>
															</div>
															<div className="flex justify-between text-sm">
																<span>Completion Tokens</span>
																<span>
																	{costByModel.reduce(
																		(sum, m) => sum + m.completionTokens,
																		0,
																	)}
																</span>
															</div>
														</div>
													)}
												</div>
											)}
									</ScrollArea>
								</PopoverContent>
							</Popover>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon-sm">
										<MoreHorizontal className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={() => setIsArchiveDialogOpen(true)}
									>
										Archive
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
					{/* Phase Progress */}
					{workflow.status !== "backlog" && (
						<PhaseIndicator
							currentStatus={workflow.status}
							skippedStages={workflow.skippedStages}
							viewedStage={viewedStage}
							onStageClick={onStageClick}
						/>
					)}
				</div>
			</header>

			<Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive Workflow</DialogTitle>
						<DialogDescription>
							Archive this workflow? It will be hidden from the workflow list.
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsArchiveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								archiveWorkflow(workflow.id)
									.then(() => {
										onArchived?.();
									})
									.catch((error) => {
										console.error("Failed to archive workflow:", error);
									});
								setIsArchiveDialogOpen(false);
							}}
						>
							Archive
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
