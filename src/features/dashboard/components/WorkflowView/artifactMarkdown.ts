/**
 * Markdown formatters for workflow artifacts
 *
 * Converts scope cards, research cards, and plans to well-formatted markdown
 * for easy copying and sharing.
 */

import type { Plan, ResearchCard, ScopeCard } from "@/shared/schemas/workflow";

/**
 * Convert a scope card to markdown
 */
export function scopeCardToMarkdown(scopeCard: ScopeCard): string {
	const lines: string[] = [];

	lines.push(`# Scope: ${scopeCard.title}`);
	lines.push("");
	lines.push(scopeCard.description);
	lines.push("");

	lines.push("## In Scope");
	lines.push("");
	for (const item of scopeCard.inScope) {
		lines.push(`- ${item}`);
	}
	lines.push("");

	lines.push("## Out of Scope");
	lines.push("");
	for (const item of scopeCard.outOfScope) {
		lines.push(`- ${item}`);
	}
	lines.push("");

	if (scopeCard.constraints && scopeCard.constraints.length > 0) {
		lines.push("## Constraints");
		lines.push("");
		for (const item of scopeCard.constraints) {
			lines.push(`- ${item}`);
		}
		lines.push("");
	}

	lines.push("## Recommended Path");
	lines.push("");
	const pathLabel = scopeCard.recommendedPath === "quick" ? "Quick Path" : "Full Path";
	if (scopeCard.rationale) {
		lines.push(`**${pathLabel}**: ${scopeCard.rationale}`);
	} else {
		lines.push(`**${pathLabel}**`);
	}

	return lines.join("\n");
}

/**
 * Convert a research card to markdown
 */
export function researchCardToMarkdown(researchCard: ResearchCard): string {
	const lines: string[] = [];

	lines.push("# Research Findings");
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(researchCard.summary);
	lines.push("");

	lines.push("## Key Files");
	lines.push("");
	for (const file of researchCard.keyFiles) {
		const lineInfo = file.lineRanges ? ` (L${file.lineRanges})` : "";
		lines.push(`### \`${file.path}\`${lineInfo}`);
		lines.push("");
		lines.push(file.purpose);
		lines.push("");
	}

	if (researchCard.patterns && researchCard.patterns.length > 0) {
		lines.push("## Patterns");
		lines.push("");
		for (const pattern of researchCard.patterns) {
			lines.push(`### ${pattern.category}`);
			lines.push("");
			lines.push(pattern.description);
			lines.push("");
			lines.push(`> "${pattern.example}"`);
			lines.push("");
			lines.push(`Found in: ${pattern.locations.map((l) => `\`${l}\``).join(", ")}`);
			lines.push("");
		}
	}

	if (researchCard.dependencies && researchCard.dependencies.length > 0) {
		lines.push("## Dependencies");
		lines.push("");
		for (const dep of researchCard.dependencies) {
			lines.push(`### \`${dep.name}\``);
			lines.push("");
			lines.push(dep.purpose);
			lines.push("");
			lines.push("```");
			lines.push(dep.usageExample);
			lines.push("```");
			lines.push("");
		}
	}

	if (researchCard.integrationPoints && researchCard.integrationPoints.length > 0) {
		lines.push("## Integration Points");
		lines.push("");
		for (const point of researchCard.integrationPoints) {
			lines.push(`### \`${point.location}\``);
			lines.push("");
			lines.push(point.description);
			lines.push("");
			lines.push(`See: \`${point.existingCode}\``);
			lines.push("");
		}
	}

	if (researchCard.challenges && researchCard.challenges.length > 0) {
		lines.push("## Challenges & Risks");
		lines.push("");
		for (const challenge of researchCard.challenges) {
			lines.push(`### ${challenge.issue}`);
			lines.push("");
			lines.push(`**Mitigation:** ${challenge.mitigation}`);
			lines.push("");
		}
	}

	lines.push("## Recommendations");
	lines.push("");
	for (const rec of researchCard.recommendations) {
		lines.push(`- ${rec}`);
	}

	return lines.join("\n");
}

/**
 * Convert a plan to markdown
 */
export function planToMarkdown(plan: Plan): string {
	const lines: string[] = [];

	lines.push("# Execution Plan");
	lines.push("");
	lines.push("## Approach");
	lines.push("");
	lines.push(plan.approachSummary);
	lines.push("");

	lines.push("## Pulses");
	lines.push("");
	for (let i = 0; i < plan.pulses.length; i++) {
		const pulse = plan.pulses[i];
		if (!pulse) continue;
		
		lines.push(`### ${i + 1}. ${pulse.title}`);
		lines.push("");
		lines.push(`**Size:** ${pulse.estimatedSize}`);
		lines.push("");
		lines.push(pulse.description);
		lines.push("");
		lines.push(`**Files:** ${pulse.expectedChanges.map((f) => `\`${f}\``).join(", ")}`);
		if (pulse.dependsOn && pulse.dependsOn.length > 0) {
			lines.push("");
			lines.push(`**Depends on:** ${pulse.dependsOn.join(", ")}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
