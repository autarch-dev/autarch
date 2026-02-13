/**
 * Tests for roadmapMarkdown module
 *
 * Tests the roadmapToMarkdown pure function covering:
 * - Basic markdown structure (title, description, status, milestones, initiative tables)
 * - Empty milestones array
 * - Milestones with no initiatives
 * - Pipe characters in titles and dependency names
 * - Null/undefined initiative size
 * - Initiatives with multiple dependencies
 * - Missing dependency targets (unresolved references)
 * - Milestone and initiative sort ordering
 * - All roadmap status labels
 * - Milestone-type dependencies
 */

import { describe, expect, test } from "bun:test";
import type {
	Initiative,
	Milestone,
	Roadmap,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";
import { roadmapToMarkdown } from "../roadmapMarkdown";

// =============================================================================
// Helpers
// =============================================================================

const now = Date.now();

function makeRoadmap(overrides: Partial<Roadmap> = {}): Roadmap {
	return {
		id: "roadmap-1",
		title: "Test Roadmap",
		status: "active",
		perspective: "balanced",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
	return {
		id: "milestone-1",
		roadmapId: "roadmap-1",
		title: "Milestone 1",
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
	return {
		id: "initiative-1",
		milestoneId: "milestone-1",
		roadmapId: "roadmap-1",
		title: "Initiative 1",
		status: "not_started",
		priority: "medium",
		progress: 0,
		size: null,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeDependency(
	overrides: Partial<RoadmapDependency> = {},
): RoadmapDependency {
	return {
		id: "dep-1",
		sourceType: "initiative",
		sourceId: "initiative-1",
		targetType: "initiative",
		targetId: "initiative-2",
		createdAt: now,
		...overrides,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe("roadmapMarkdown", () => {
	describe("roadmapToMarkdown", () => {
		test("produces basic markdown structure with title, description, and status", () => {
			const roadmap = makeRoadmap({
				title: "My Roadmap",
				description: "A great roadmap.",
				status: "active",
			});

			const result = roadmapToMarkdown(roadmap, [], [], []);

			expect(result).toContain("# My Roadmap");
			expect(result).toContain("A great roadmap.");
			expect(result).toContain("**Status:** Active");
		});

		test("omits description paragraph when description is absent", () => {
			const roadmap = makeRoadmap({ description: undefined });

			const result = roadmapToMarkdown(roadmap, [], [], []);
			const lines = result.split("\n");

			// Title should be immediately followed by a blank line and then status
			const titleIndex = lines.indexOf("# Test Roadmap");
			expect(titleIndex).toBeGreaterThanOrEqual(0);
			expect(lines[titleIndex + 1]).toBe("");
			expect(lines[titleIndex + 2]).toBe("**Status:** Active");
		});

		test("renders all roadmap status labels correctly", () => {
			const statuses: Array<{ value: Roadmap["status"]; label: string }> = [
				{ value: "draft", label: "Draft" },
				{ value: "active", label: "Active" },
				{ value: "completed", label: "Completed" },
				{ value: "archived", label: "Archived" },
			];

			for (const { value, label } of statuses) {
				const roadmap = makeRoadmap({ status: value });
				const result = roadmapToMarkdown(roadmap, [], [], []);
				expect(result).toContain(`**Status:** ${label}`);
			}
		});

		test("produces no milestone sections when milestones array is empty", () => {
			const roadmap = makeRoadmap();
			const result = roadmapToMarkdown(roadmap, [], [], []);

			expect(result).not.toContain("## ");
		});

		test("renders milestone with no initiatives as 'No initiatives'", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone({ title: "Empty Milestone" });

			const result = roadmapToMarkdown(roadmap, [milestone], [], []);

			expect(result).toContain("## Empty Milestone");
			expect(result).toContain("*No initiatives*");
			expect(result).not.toContain("| Title |");
		});

		test("renders a GFM table for milestones with initiatives", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({
				title: "Build Feature",
				status: "in_progress",
				priority: "high",
				size: 5,
			});

			const result = roadmapToMarkdown(roadmap, [milestone], [initiative], []);

			expect(result).toContain(
				"| Title | Status | Priority | Size | Dependencies |",
			);
			expect(result).toContain("| --- | --- | --- | --- | --- |");
			expect(result).toContain(
				"| Build Feature | In Progress | High | 5 | \u2014 |",
			);
		});

		test("shows em dash for null size", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({ size: null });

			const result = roadmapToMarkdown(roadmap, [milestone], [initiative], []);

			expect(result).toContain(
				"| Initiative 1 | Not Started | Medium | \u2014 | \u2014 |",
			);
		});

		test("shows em dash for undefined size", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({ size: undefined });

			const result = roadmapToMarkdown(roadmap, [milestone], [initiative], []);

			expect(result).toContain(
				"| Initiative 1 | Not Started | Medium | \u2014 | \u2014 |",
			);
		});

		test("escapes pipe characters in initiative titles", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({ title: "Feature | Phase 1" });

			const result = roadmapToMarkdown(roadmap, [milestone], [initiative], []);

			expect(result).toContain("Feature \\| Phase 1");
			// Should not break the table structure
			const tableRows = result
				.split("\n")
				.filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));
			const dataRows = tableRows.filter((line) => !line.startsWith("| Title"));
			expect(dataRows).toHaveLength(1);
		});

		test("escapes pipe characters in dependency names", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiativeA = makeInitiative({
				id: "init-a",
				title: "Dep | Source",
				sortOrder: 0,
			});
			const initiativeB = makeInitiative({
				id: "init-b",
				title: "Target Initiative",
				sortOrder: 1,
			});
			const dep = makeDependency({
				sourceType: "initiative",
				sourceId: "init-a",
				targetType: "initiative",
				targetId: "init-b",
			});

			const result = roadmapToMarkdown(
				roadmap,
				[milestone],
				[initiativeA, initiativeB],
				[dep],
			);

			expect(result).toContain("Dep \\| Source");
		});

		test("resolves and displays multiple dependencies as comma-separated list", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initA = makeInitiative({
				id: "init-a",
				title: "Prerequisite A",
				sortOrder: 0,
			});
			const initB = makeInitiative({
				id: "init-b",
				title: "Prerequisite B",
				sortOrder: 1,
			});
			const initC = makeInitiative({
				id: "init-c",
				title: "Dependent",
				sortOrder: 2,
			});
			const deps: RoadmapDependency[] = [
				makeDependency({
					id: "dep-1",
					sourceType: "initiative",
					sourceId: "init-a",
					targetType: "initiative",
					targetId: "init-c",
				}),
				makeDependency({
					id: "dep-2",
					sourceType: "initiative",
					sourceId: "init-b",
					targetType: "initiative",
					targetId: "init-c",
				}),
			];

			const result = roadmapToMarkdown(
				roadmap,
				[milestone],
				[initA, initB, initC],
				deps,
			);

			expect(result).toContain("Prerequisite A, Prerequisite B");
		});

		test("filters out unresolved dependencies when source is missing", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({
				id: "init-target",
				title: "Target",
			});
			const dep = makeDependency({
				sourceType: "initiative",
				sourceId: "nonexistent-id",
				targetType: "initiative",
				targetId: "init-target",
			});

			const result = roadmapToMarkdown(
				roadmap,
				[milestone],
				[initiative],
				[dep],
			);

			// With no resolvable dependencies, should show em dash
			expect(result).toContain(
				"| Target | Not Started | Medium | \u2014 | \u2014 |",
			);
		});

		test("resolves milestone-type dependencies", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone({
				id: "ms-1",
				title: "Phase 1",
			});
			const initiative = makeInitiative({
				id: "init-1",
				milestoneId: "ms-1",
				title: "Do Something",
			});
			const dep = makeDependency({
				sourceType: "milestone",
				sourceId: "ms-1",
				targetType: "initiative",
				targetId: "init-1",
			});

			const result = roadmapToMarkdown(
				roadmap,
				[milestone],
				[initiative],
				[dep],
			);

			expect(result).toContain(
				"| Do Something | Not Started | Medium | \u2014 | Phase 1 |",
			);
		});

		test("sorts milestones by sortOrder", () => {
			const roadmap = makeRoadmap();
			const milestoneB = makeMilestone({
				id: "ms-b",
				title: "Second Milestone",
				sortOrder: 1,
			});
			const milestoneA = makeMilestone({
				id: "ms-a",
				title: "First Milestone",
				sortOrder: 0,
			});

			// Pass in reverse order to verify sorting
			const result = roadmapToMarkdown(
				roadmap,
				[milestoneB, milestoneA],
				[],
				[],
			);

			const firstIdx = result.indexOf("## First Milestone");
			const secondIdx = result.indexOf("## Second Milestone");
			expect(firstIdx).toBeLessThan(secondIdx);
		});

		test("sorts initiatives by sortOrder within a milestone", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initB = makeInitiative({
				id: "init-b",
				title: "Second Initiative",
				sortOrder: 1,
			});
			const initA = makeInitiative({
				id: "init-a",
				title: "First Initiative",
				sortOrder: 0,
			});

			// Pass in reverse order to verify sorting
			const result = roadmapToMarkdown(
				roadmap,
				[milestone],
				[initB, initA],
				[],
			);

			const firstIdx = result.indexOf("First Initiative");
			const secondIdx = result.indexOf("Second Initiative");
			expect(firstIdx).toBeLessThan(secondIdx);
		});

		test("groups initiatives under their respective milestones", () => {
			const roadmap = makeRoadmap();
			const ms1 = makeMilestone({
				id: "ms-1",
				title: "Milestone A",
				sortOrder: 0,
			});
			const ms2 = makeMilestone({
				id: "ms-2",
				title: "Milestone B",
				sortOrder: 1,
			});
			const init1 = makeInitiative({
				id: "init-1",
				milestoneId: "ms-1",
				title: "Init for A",
			});
			const init2 = makeInitiative({
				id: "init-2",
				milestoneId: "ms-2",
				title: "Init for B",
			});

			const result = roadmapToMarkdown(roadmap, [ms1, ms2], [init1, init2], []);

			// "Init for A" should appear between "Milestone A" and "Milestone B"
			const msAIdx = result.indexOf("## Milestone A");
			const msBIdx = result.indexOf("## Milestone B");
			const initAIdx = result.indexOf("Init for A");
			const initBIdx = result.indexOf("Init for B");
			expect(initAIdx).toBeGreaterThan(msAIdx);
			expect(initAIdx).toBeLessThan(msBIdx);
			expect(initBIdx).toBeGreaterThan(msBIdx);
		});

		test("renders all initiative status labels correctly", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const statuses: Array<{
				value: Initiative["status"];
				label: string;
			}> = [
				{ value: "not_started", label: "Not Started" },
				{ value: "in_progress", label: "In Progress" },
				{ value: "completed", label: "Completed" },
				{ value: "blocked", label: "Blocked" },
			];

			for (const { value, label } of statuses) {
				const initiative = makeInitiative({ status: value });
				const result = roadmapToMarkdown(
					roadmap,
					[milestone],
					[initiative],
					[],
				);
				expect(result).toContain(`| ${label} |`);
			}
		});

		test("renders all initiative priority labels correctly", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const priorities: Array<{
				value: Initiative["priority"];
				label: string;
			}> = [
				{ value: "low", label: "Low" },
				{ value: "medium", label: "Medium" },
				{ value: "high", label: "High" },
				{ value: "critical", label: "Critical" },
			];

			for (const { value, label } of priorities) {
				const initiative = makeInitiative({ priority: value });
				const result = roadmapToMarkdown(
					roadmap,
					[milestone],
					[initiative],
					[],
				);
				expect(result).toContain(`| ${label} |`);
			}
		});

		test("renders numeric size values as strings", () => {
			const roadmap = makeRoadmap();
			const milestone = makeMilestone();
			const initiative = makeInitiative({ size: 13 });

			const result = roadmapToMarkdown(roadmap, [milestone], [initiative], []);

			expect(result).toContain("| 13 |");
		});
	});
});
