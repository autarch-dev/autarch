/**
 * Tests for editContext helper functions
 */

import { describe, expect, it } from "bun:test";
import {
	buildContextOutput,
	calculateReplacementPositions,
	mergeLineRanges,
	positionsToLineRanges,
	trackMultiEditPositions,
} from "../editContext";

describe("calculateReplacementPositions", () => {
	it("calculates position for single replacement", () => {
		const content = "hello world";
		const positions = calculateReplacementPositions(
			content,
			"world",
			"universe",
			false,
		);

		expect(positions).toHaveLength(1);
		expect(positions[0]?.charPosition).toBe(6); // "world" starts at index 6
		expect(positions[0]?.newStringLineCount).toBe(1);
	});

	it("calculates positions for replaceAll with multiple occurrences", () => {
		const content = "foo bar foo baz foo";
		const positions = calculateReplacementPositions(
			content,
			"foo",
			"qux",
			true,
		);

		expect(positions).toHaveLength(3);
		// After first replacement: "qux bar foo baz foo" (offset 0)
		// After second replacement: "qux bar qux baz foo" (offset 0)
		// After third replacement: "qux bar qux baz qux" (offset 0)
		// All positions should be in final content coordinates
		expect(positions[0]?.charPosition).toBe(0); // First "qux" at 0
		expect(positions[1]?.charPosition).toBe(8); // Second "qux" at 8
		expect(positions[2]?.charPosition).toBe(16); // Third "qux" at 16
	});

	it("handles multiline newString correctly", () => {
		const content = "single line";
		const positions = calculateReplacementPositions(
			content,
			"single",
			"multi\nline\nreplacement",
			false,
		);

		expect(positions).toHaveLength(1);
		expect(positions[0]?.newStringLineCount).toBe(3);
	});

	it("returns empty array when oldString not found", () => {
		const content = "hello world";
		const positions = calculateReplacementPositions(
			content,
			"notfound",
			"replacement",
			false,
		);

		expect(positions).toHaveLength(0);
	});

	it("handles replacement that changes length", () => {
		const content = "aa bb aa";
		const positions = calculateReplacementPositions(
			content,
			"aa",
			"XXXX",
			true,
		);

		expect(positions).toHaveLength(2);
		// In final content "XXXX bb XXXX":
		// First XXXX at 0
		// Second XXXX at 8 (0 + 4 + 4)
		expect(positions[0]?.charPosition).toBe(0);
		expect(positions[1]?.charPosition).toBe(8);
	});
});

describe("positionsToLineRanges", () => {
	it("converts single position to line range", () => {
		const content = "line1\nline2\nline3";
		const positions = [{ charPosition: 6, newStringLineCount: 1 }]; // "line2" starts at 6

		const ranges = positionsToLineRanges(content, positions);

		expect(ranges).toHaveLength(1);
		expect(ranges[0]?.startLine).toBe(2);
		expect(ranges[0]?.endLine).toBe(2);
	});

	it("handles multiline replacement", () => {
		const content = "line1\nmulti\nline\nreplacement\nline5";
		const positions = [{ charPosition: 6, newStringLineCount: 3 }]; // starts at "multi"

		const ranges = positionsToLineRanges(content, positions);

		expect(ranges).toHaveLength(1);
		expect(ranges[0]?.startLine).toBe(2);
		expect(ranges[0]?.endLine).toBe(4); // 3 lines: 2, 3, 4
	});

	it("handles position at start of file", () => {
		const content = "first\nsecond";
		const positions = [{ charPosition: 0, newStringLineCount: 1 }];

		const ranges = positionsToLineRanges(content, positions);

		expect(ranges).toHaveLength(1);
		expect(ranges[0]?.startLine).toBe(1);
		expect(ranges[0]?.endLine).toBe(1);
	});
});

describe("mergeLineRanges", () => {
	it("does not merge ranges more than 10 lines apart", () => {
		const ranges = [
			{ startLine: 1, endLine: 5 },
			{ startLine: 20, endLine: 25 },
		];

		const merged = mergeLineRanges(ranges);

		expect(merged).toHaveLength(2);
		expect(merged[0]).toEqual({ startLine: 1, endLine: 5 });
		expect(merged[1]).toEqual({ startLine: 20, endLine: 25 });
	});

	it("merges ranges within 10 lines", () => {
		const ranges = [
			{ startLine: 1, endLine: 5 },
			{ startLine: 10, endLine: 15 }, // Gap of 5 lines, should merge
		];

		const merged = mergeLineRanges(ranges);

		expect(merged).toHaveLength(1);
		expect(merged[0]).toEqual({ startLine: 1, endLine: 15 });
	});

	it("handles overlapping ranges", () => {
		const ranges = [
			{ startLine: 1, endLine: 10 },
			{ startLine: 5, endLine: 15 },
		];

		const merged = mergeLineRanges(ranges);

		expect(merged).toHaveLength(1);
		expect(merged[0]).toEqual({ startLine: 1, endLine: 15 });
	});

	it("handles unsorted input", () => {
		const ranges = [
			{ startLine: 20, endLine: 25 },
			{ startLine: 1, endLine: 5 },
		];

		const merged = mergeLineRanges(ranges);

		expect(merged).toHaveLength(2);
		expect(merged[0]?.startLine).toBe(1);
		expect(merged[1]?.startLine).toBe(20);
	});

	it("returns empty array for empty input", () => {
		const merged = mergeLineRanges([]);
		expect(merged).toHaveLength(0);
	});
});

describe("buildContextOutput", () => {
	it("formats context with header and content", () => {
		const content = "line1\nline2\nline3\nline4\nline5";
		const ranges = [{ startLine: 2, endLine: 4 }];

		const output = buildContextOutput("test.ts", content, ranges);

		expect(output).toContain("### test.ts:");
		expect(output).toContain("line2");
		expect(output).toContain("line3");
		expect(output).toContain("line4");
	});

	it("includes context lines around the range", () => {
		// Create a file with 15 lines
		const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`);
		const content = lines.join("\n");
		const ranges = [{ startLine: 8, endLine: 8 }]; // Target line 8

		const output = buildContextOutput("test.ts", content, ranges);

		// Should include 5 lines of context (lines 3-13)
		expect(output).toContain("line3");
		expect(output).toContain("line8");
		expect(output).toContain("line13");
	});

	it("handles file boundary at start", () => {
		const content = "line1\nline2\nline3";
		const ranges = [{ startLine: 1, endLine: 1 }];

		const output = buildContextOutput("test.ts", content, ranges);

		expect(output).toContain("line1");
		// Should not error even though context would extend before line 1
	});

	it("handles multiple separate ranges", () => {
		const lines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`);
		const content = lines.join("\n");
		const ranges = [
			{ startLine: 5, endLine: 5 },
			{ startLine: 45, endLine: 45 },
		];

		const output = buildContextOutput("test.ts", content, ranges);

		// Should have two separate sections
		expect(output.match(/### test\.ts:/g)?.length).toBe(2);
		expect(output).toContain("line5");
		expect(output).toContain("line45");
	});

	it("returns empty string for empty ranges", () => {
		const output = buildContextOutput("test.ts", "content", []);
		expect(output).toBe("");
	});
});

describe("trackMultiEditPositions", () => {
	it("tracks single edit correctly", () => {
		const content = "hello world";
		const edits = [{ oldString: "world", newString: "universe" }];

		const ranges = trackMultiEditPositions(content, edits);

		expect(ranges).toHaveLength(1);
		expect(ranges[0]?.startLine).toBe(1);
		expect(ranges[0]?.endLine).toBe(1);
	});

	it("tracks multiple edits with correct offset adjustment", () => {
		// This is the key test for the bug fix:
		// Edit 1 at line 2 adds 2 lines, so edit 2's tracked position
		// should be adjusted to account for this
		const content = "line1\nOLD1\nline3\nOLD2\nline5";
		const edits = [
			{ oldString: "OLD1", newString: "NEW1\nEXTRA1\nEXTRA2" }, // Adds 2 lines
			{ oldString: "OLD2", newString: "NEW2" },
		];

		const ranges = trackMultiEditPositions(content, edits);

		expect(ranges).toHaveLength(2);
		// First edit at line 2, spans 3 lines (NEW1, EXTRA1, EXTRA2)
		expect(ranges[0]?.startLine).toBe(2);
		expect(ranges[0]?.endLine).toBe(4);
		// Second edit was originally at line 4, but now at line 6 due to +2 lines
		expect(ranges[1]?.startLine).toBe(6);
		expect(ranges[1]?.endLine).toBe(6);
	});

	it("handles edit that removes lines", () => {
		const content = "line1\nOLD1\nOLD2\nOLD3\nline5\nTARGET\nline7";
		const edits = [
			{ oldString: "OLD1\nOLD2\nOLD3", newString: "NEW" }, // Removes 2 lines
			{ oldString: "TARGET", newString: "FOUND" },
		];

		const ranges = trackMultiEditPositions(content, edits);

		expect(ranges).toHaveLength(2);
		// First edit at line 2
		expect(ranges[0]?.startLine).toBe(2);
		expect(ranges[0]?.endLine).toBe(2);
		// Second edit was originally at line 6, now at line 4 due to -2 lines
		expect(ranges[1]?.startLine).toBe(4);
		expect(ranges[1]?.endLine).toBe(4);
	});

	it("handles replaceAll in multi-edit", () => {
		const content = "foo bar foo baz foo";
		const edits = [{ oldString: "foo", newString: "qux", replaceAll: true }];

		const ranges = trackMultiEditPositions(content, edits);

		expect(ranges).toHaveLength(3);
	});

	it("handles sequential edits where second depends on first result", () => {
		const content = "AAA BBB CCC";
		const edits = [
			{ oldString: "BBB", newString: "XXX" },
			{ oldString: "XXX", newString: "YYY" }, // Depends on first edit result
		];

		const ranges = trackMultiEditPositions(content, edits);

		// Both edits target the same location
		expect(ranges).toHaveLength(2);
		expect(ranges[0]?.startLine).toBe(1);
		expect(ranges[1]?.startLine).toBe(1);
	});

	it("returns empty array when edit not found", () => {
		const content = "hello world";
		const edits = [{ oldString: "notfound", newString: "replacement" }];

		const ranges = trackMultiEditPositions(content, edits);

		expect(ranges).toHaveLength(0);
	});
});
