/**
 * Markdown formatter for roadmaps
 *
 * Converts a roadmap with its milestones, initiatives, and dependencies
 * to a well-formatted GitHub-Flavored Markdown string for clipboard export.
 */

import type {
	Initiative,
	InitiativePriority,
	InitiativeStatus,
	Milestone,
	Roadmap,
	RoadmapDependency,
	RoadmapStatus,
} from "@/shared/schemas/roadmap";

// =============================================================================
// Label Maps
// =============================================================================

const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
	draft: "Draft",
	active: "Active",
	completed: "Completed",
	archived: "Archived",
};

const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
	not_started: "Not Started",
	in_progress: "In Progress",
	completed: "Completed",
	blocked: "Blocked",
};

const INITIATIVE_PRIORITY_LABELS: Record<InitiativePriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

// =============================================================================
// Helpers
// =============================================================================

function getDependencyNames(
	initiativeId: string,
	dependencies: RoadmapDependency[],
	milestones: Milestone[],
	initiatives: Initiative[],
): string[] {
	const blocking = dependencies.filter(
		(d) => d.targetId === initiativeId && d.targetType === "initiative",
	);

	return blocking
		.map((dep) => {
			if (dep.sourceType === "milestone") {
				return milestones.find((m) => m.id === dep.sourceId)?.title;
			}
			return initiatives.find((i) => i.id === dep.sourceId)?.title;
		})
		.filter((name): name is string => name != null);
}

// =============================================================================
// Markdown Export
// =============================================================================

/**
 * Convert a roadmap to GitHub-Flavored Markdown
 */
export function roadmapToMarkdown(
	roadmap: Roadmap,
	milestones: Milestone[],
	initiatives: Initiative[],
	dependencies: RoadmapDependency[],
): string {
	const lines: string[] = [];

	lines.push(`# ${roadmap.title}`);

	if (roadmap.description) {
		lines.push("");
		lines.push(roadmap.description);
	}

	lines.push("");
	lines.push(`**Status:** ${ROADMAP_STATUS_LABELS[roadmap.status]}`);
	lines.push("");

	const sortedMilestones = [...milestones].sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);

	for (const milestone of sortedMilestones) {
		lines.push(`## ${milestone.title}`);
		lines.push("");

		const milestoneInitiatives = initiatives
			.filter((i) => i.milestoneId === milestone.id)
			.sort((a, b) => a.sortOrder - b.sortOrder);

		if (milestoneInitiatives.length === 0) {
			lines.push("*No initiatives*");
			lines.push("");
			continue;
		}

		lines.push("| Title | Status | Priority | Size | Dependencies |");
		lines.push("| --- | --- | --- | --- | --- |");

		for (const initiative of milestoneInitiatives) {
			const title = initiative.title.replace(/\|/g, "\\|");
			const status = INITIATIVE_STATUS_LABELS[initiative.status];
			const priority = INITIATIVE_PRIORITY_LABELS[initiative.priority];
			const size = initiative.size != null ? String(initiative.size) : "\u2014";
			const depNames = getDependencyNames(
				initiative.id,
				dependencies,
				milestones,
				initiatives,
			);
			const deps =
				depNames.length > 0
					? depNames.map((n) => n.replace(/\|/g, "\\|")).join(", ")
					: "\u2014";

			lines.push(`| ${title} | ${status} | ${priority} | ${size} | ${deps} |`);
		}

		lines.push("");
	}

	return lines.join("\n");
}
