/**
 * Markdown formatters for workflow artifacts
 *
 * Converts scope cards, research cards, and plans to well-formatted markdown
 * for easy copying and sharing.
 */

import type {
	Plan,
	ResearchCard,
	ReviewCard,
	ScopeCard,
} from "@/shared/schemas/workflow";

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
	const pathLabel =
		scopeCard.recommendedPath === "quick" ? "Quick Path" : "Full Path";
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
			lines.push(
				`Found in: ${pattern.locations.map((l) => `\`${l}\``).join(", ")}`,
			);
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

	if (
		researchCard.integrationPoints &&
		researchCard.integrationPoints.length > 0
	) {
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
		lines.push(
			`**Files:** ${pulse.expectedChanges.map((f) => `\`${f}\``).join(", ")}`,
		);
		if (pulse.dependsOn && pulse.dependsOn.length > 0) {
			lines.push("");
			lines.push(`**Depends on:** ${pulse.dependsOn.join(", ")}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Convert a review card to markdown
 */
export function reviewCardToMarkdown(reviewCard: ReviewCard): string {
	const lines: string[] = [];

	lines.push("# Code Review");
	lines.push("");

	// Recommendation
	if (reviewCard.recommendation) {
		const recommendationLabel = {
			approve: "✅ Approve",
			deny: "❌ Deny",
			manual_review: "⚠️ Manual Review Required",
		}[reviewCard.recommendation];
		lines.push(`**Recommendation:** ${recommendationLabel}`);
		lines.push("");
	}

	// Summary
	if (reviewCard.summary) {
		lines.push("## Summary");
		lines.push("");
		lines.push(reviewCard.summary);
		lines.push("");
	}

	// Group comments by type
	const lineComments = reviewCard.comments.filter((c) => c.type === "line");
	const fileComments = reviewCard.comments.filter((c) => c.type === "file");
	const reviewComments = reviewCard.comments.filter((c) => c.type === "review");

	// Line Comments
	if (lineComments.length > 0) {
		lines.push("## Line Comments");
		lines.push("");
		for (const comment of lineComments) {
			const location = comment.filePath
				? `\`${comment.filePath}:${comment.startLine}${comment.endLine && comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}\``
				: "";
			lines.push(`### ${location}`);
			lines.push("");
			lines.push(
				`**Severity:** ${comment.severity} | **Category:** ${comment.category}`,
			);
			lines.push("");
			lines.push(comment.description);
			lines.push("");
		}
	}

	// File Comments
	if (fileComments.length > 0) {
		lines.push("## File Comments");
		lines.push("");
		for (const comment of fileComments) {
			const location = comment.filePath ? `\`${comment.filePath}\`` : "";
			lines.push(`### ${location}`);
			lines.push("");
			lines.push(
				`**Severity:** ${comment.severity} | **Category:** ${comment.category}`,
			);
			lines.push("");
			lines.push(comment.description);
			lines.push("");
		}
	}

	// Review Comments
	if (reviewComments.length > 0) {
		lines.push("## Review Comments");
		lines.push("");
		for (const comment of reviewComments) {
			lines.push(`### ${comment.category}`);
			lines.push("");
			lines.push(`**Severity:** ${comment.severity}`);
			lines.push("");
			lines.push(comment.description);
			lines.push("");
		}
	}

	return lines.join("\n");
}
