import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Workflow } from "@/shared/schemas/workflow";
import { statusConfig } from "./config";
import { PhaseIndicator } from "./PhaseIndicator";

interface WorkflowHeaderProps {
	workflow: Workflow;
	totalCost: number;
}

export function WorkflowHeader({ workflow, totalCost }: WorkflowHeaderProps) {
	const status = statusConfig[workflow.status];
	const StatusIcon = status.icon;

	return (
		<header className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="h-4" />
						<StatusIcon className={cn("size-4", status.color)} />
						<h2 className="font-semibold truncate">{workflow.title}</h2>
					</div>
					{workflow.description && (
						<p className="text-sm text-muted-foreground">
							{workflow.description}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2 ml-4">
					<Badge variant="secondary" className={cn(status.bg, status.color)}>
						{status.label}
					</Badge>
					<Badge variant="secondary" className="bg-muted">
						~${totalCost.toFixed(2)}
					</Badge>
					<Button variant="ghost" size="icon-sm">
						<MoreHorizontal className="size-4" />
					</Button>
				</div>
			</div>

			{/* Phase Progress */}
			{workflow.status !== "backlog" && workflow.status !== "done" && (
				<PhaseIndicator currentStatus={workflow.status} />
			)}
		</header>
	);
}
