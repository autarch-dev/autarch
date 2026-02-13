/**
 * PersonaRoadmapPreview - Preview card for a persona agent's submitted roadmap
 *
 * Renders a compact summary card showing the persona's vision (truncated with
 * expand toggle), milestone count, and per-milestone initiative counts. Displayed
 * at the bottom of a persona tab after the agent submits its roadmap.
 */

import { ChevronDown, ChevronRight, Layers, Target } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface PersonaRoadmapData {
	vision: string;
	milestones: Array<{
		title: string;
		description?: string;
		initiatives: Array<{ title: string }>;
	}>;
}

interface PersonaRoadmapPreviewProps {
	persona: string;
	roadmapData: PersonaRoadmapData;
}

// =============================================================================
// Component
// =============================================================================

export function PersonaRoadmapPreview({
	persona,
	roadmapData,
}: PersonaRoadmapPreviewProps) {
	const [isVisionExpanded, setIsVisionExpanded] = useState(false);
	const { vision, milestones } = roadmapData;

	const totalInitiatives = milestones.reduce(
		(sum, m) => sum + m.initiatives.length,
		0,
	);

	return (
		<div className="mx-4 my-3 rounded-lg border bg-card p-4 space-y-3">
			{/* Header with counts */}
			<div className="flex items-center gap-2">
				<Target className="size-4 text-primary shrink-0" />
				<span className="font-medium text-sm">Persona Roadmap</span>
				<Badge variant="secondary" className="text-xs">
					{milestones.length} milestone{milestones.length !== 1 ? "s" : ""}
				</Badge>
				<Badge variant="outline" className="text-xs">
					{totalInitiatives} initiative{totalInitiatives !== 1 ? "s" : ""}
				</Badge>
			</div>

			{/* Vision summary */}
			{vision && (
				<div>
					<button
						type="button"
						onClick={() => setIsVisionExpanded(!isVisionExpanded)}
						className="flex items-start gap-1.5 text-left w-full group"
					>
						{isVisionExpanded ? (
							<ChevronDown className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
						) : (
							<ChevronRight className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
						)}
						<p
							className={cn(
								"text-sm text-muted-foreground group-hover:text-foreground transition-colors",
								!isVisionExpanded && "line-clamp-3",
							)}
						>
							{vision}
						</p>
					</button>
				</div>
			)}

			{/* Milestones list */}
			{milestones.length > 0 && (
				<div className="space-y-1.5 pt-1 border-t">
					{milestones.map((milestone) => (
						<div
							key={`${persona}-${milestone.title}`}
							className="flex items-center gap-2 text-sm"
						>
							<Target className="size-3.5 text-muted-foreground shrink-0" />
							<span className="truncate flex-1">{milestone.title}</span>
							{milestone.initiatives.length > 0 && (
								<span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
									<Layers className="size-3" />
									{milestone.initiatives.length}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
