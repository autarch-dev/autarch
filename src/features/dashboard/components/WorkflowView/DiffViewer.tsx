/**
 * DiffViewer - Display unified diff with syntax highlighting
 *
 * Features:
 * - Parses unified diff format into files
 * - Renders with Shiki syntax highlighting
 * - File tree sidebar with collapse/expand
 * - File type filter dropdown
 * - Modal trigger for viewing from ReviewCardApproval
 */

import {
	ChevronDown,
	ChevronRight,
	FileCode,
	FileMinus,
	FilePlus,
	Filter,
	GitCompareArrows,
	Minus,
	Plus,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { codeToHtml } from "shiki";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface DiffHunk {
	/** Original file start line */
	oldStart: number;
	/** Original file line count */
	oldCount: number;
	/** New file start line */
	newStart: number;
	/** New file line count */
	newCount: number;
	/** Hunk header (e.g., @@ -1,10 +1,12 @@) */
	header: string;
	/** Lines in this hunk */
	lines: DiffLine[];
}

interface DiffLine {
	/** Line type: addition, deletion, or context */
	type: "add" | "del" | "context";
	/** Line content (without +/- prefix) */
	content: string;
	/** Original line number (null for additions) */
	oldLineNumber: number | null;
	/** New line number (null for deletions) */
	newLineNumber: number | null;
}

interface DiffFile {
	/** Original file path (a/...) */
	oldPath: string;
	/** New file path (b/...) */
	newPath: string;
	/** Display path (without a/ or b/ prefix) */
	path: string;
	/** File extension */
	extension: string;
	/** File status: added, deleted, or modified */
	status: "added" | "deleted" | "modified";
	/** Hunks in this file */
	hunks: DiffHunk[];
	/** Total additions in this file */
	additions: number;
	/** Total deletions in this file */
	deletions: number;
}

interface DiffViewerProps {
	/** Raw unified diff content */
	diff: string;
	/** Optional className for the root element */
	className?: string;
}

// =============================================================================
// Diff Parsing
// =============================================================================

/**
 * Parse a unified diff string into structured DiffFile objects
 */
function parseUnifiedDiff(diff: string): DiffFile[] {
	const files: DiffFile[] = [];
	const lines = diff.split("\n");

	let currentFile: DiffFile | null = null;
	let currentHunk: DiffHunk | null = null;
	let oldLineNum = 0;
	let newLineNum = 0;

	for (const line of lines) {
		// Match diff --git header
		const gitDiffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
		if (gitDiffMatch) {
			// Save previous file
			if (currentFile) {
				if (currentHunk) {
					currentFile.hunks.push(currentHunk);
				}
				files.push(currentFile);
			}

			const oldPath = gitDiffMatch[1] ?? "";
			const newPath = gitDiffMatch[2] ?? "";
			const filePath = newPath || oldPath;
			const extension = filePath.split(".").pop() ?? "";

			currentFile = {
				oldPath: `a/${oldPath}`,
				newPath: `b/${newPath}`,
				path: filePath,
				extension,
				status: "modified",
				hunks: [],
				additions: 0,
				deletions: 0,
			};
			currentHunk = null;
			continue;
		}

		// Check for new file mode (indicates file was added)
		if (line.startsWith("new file mode") && currentFile) {
			currentFile.status = "added";
			continue;
		}

		// Check for deleted file mode
		if (line.startsWith("deleted file mode") && currentFile) {
			currentFile.status = "deleted";
			continue;
		}

		// Match @@ hunk header
		const hunkMatch = line.match(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/,
		);
		if (hunkMatch && currentFile) {
			// Save previous hunk
			if (currentHunk) {
				currentFile.hunks.push(currentHunk);
			}

			oldLineNum = parseInt(hunkMatch[1] ?? "0", 10);
			newLineNum = parseInt(hunkMatch[3] ?? "0", 10);

			currentHunk = {
				oldStart: oldLineNum,
				oldCount: parseInt(hunkMatch[2] ?? "1", 10),
				newStart: newLineNum,
				newCount: parseInt(hunkMatch[4] ?? "1", 10),
				header: line,
				lines: [],
			};
			continue;
		}

		// Process diff lines
		if (currentHunk && currentFile) {
			if (line.startsWith("+") && !line.startsWith("+++")) {
				currentHunk.lines.push({
					type: "add",
					content: line.slice(1),
					oldLineNumber: null,
					newLineNumber: newLineNum++,
				});
				currentFile.additions++;
			} else if (line.startsWith("-") && !line.startsWith("---")) {
				currentHunk.lines.push({
					type: "del",
					content: line.slice(1),
					oldLineNumber: oldLineNum++,
					newLineNumber: null,
				});
				currentFile.deletions++;
			} else if (line.startsWith(" ") || line === "") {
				// Context line or empty line
				currentHunk.lines.push({
					type: "context",
					content: line.startsWith(" ") ? line.slice(1) : line,
					oldLineNumber: oldLineNum++,
					newLineNumber: newLineNum++,
				});
			}
		}
	}

	// Save last file and hunk
	if (currentFile) {
		if (currentHunk) {
			currentFile.hunks.push(currentHunk);
		}
		files.push(currentFile);
	}

	return files;
}

/**
 * Get the language identifier for Shiki from file extension
 */
function getLanguageFromExtension(extension: string): string {
	const languageMap: Record<string, string> = {
		ts: "typescript",
		tsx: "tsx",
		js: "javascript",
		jsx: "jsx",
		json: "json",
		md: "markdown",
		css: "css",
		scss: "scss",
		less: "less",
		html: "html",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		c: "c",
		cpp: "cpp",
		h: "c",
		hpp: "cpp",
		cs: "csharp",
		php: "php",
		sql: "sql",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		dockerfile: "dockerfile",
		toml: "toml",
		ini: "ini",
		vue: "vue",
		svelte: "svelte",
	};

	return languageMap[extension.toLowerCase()] ?? "text";
}

/**
 * Get unique file extensions from files
 */
function getUniqueExtensions(files: DiffFile[]): string[] {
	const extensions = new Set<string>();
	for (const file of files) {
		if (file.extension) {
			extensions.add(file.extension.toLowerCase());
		}
	}
	return Array.from(extensions).sort();
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * File tree item showing a single file with stats
 */
function FileTreeItem({
	file,
	isSelected,
	onSelect,
}: {
	file: DiffFile;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const StatusIcon =
		file.status === "added"
			? FilePlus
			: file.status === "deleted"
				? FileMinus
				: FileCode;

	const statusColor =
		file.status === "added"
			? "text-green-500"
			: file.status === "deleted"
				? "text-red-500"
				: "text-blue-500";

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors",
				"hover:bg-muted/50",
				isSelected && "bg-muted",
			)}
		>
			<StatusIcon className={cn("size-4 shrink-0", statusColor)} />
			<span className="truncate flex-1 font-mono text-xs">{file.path}</span>
			<div className="flex items-center gap-1 text-xs shrink-0">
				{file.additions > 0 && (
					<span className="text-green-600 dark:text-green-400">
						+{file.additions}
					</span>
				)}
				{file.deletions > 0 && (
					<span className="text-red-600 dark:text-red-400">
						-{file.deletions}
					</span>
				)}
			</div>
		</button>
	);
}

// Module-level cache for highlighted diff lines
const diffHighlightCache = new Map<string, string>();

/**
 * A single diff line with syntax highlighting
 */
const DiffLineView = memo(function DiffLineView({
	line,
	language,
}: {
	line: DiffLine;
	language: string;
}) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

	const cacheKey = `${language}:${line.content}`;
	const cachedHtml = diffHighlightCache.get(cacheKey);

	useEffect(() => {
		if (cachedHtml) {
			setHighlightedHtml(cachedHtml);
			return;
		}

		// Skip highlighting for empty lines
		if (!line.content.trim()) {
			return;
		}

		let cancelled = false;

		codeToHtml(line.content, {
			lang: language,
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
		}).then((result) => {
			if (!cancelled) {
				// Extract just the code content, stripping wrapper elements
				const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
				const codeContent = match?.[1] ?? line.content;
				diffHighlightCache.set(cacheKey, codeContent);
				setHighlightedHtml(codeContent);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [cacheKey, cachedHtml, language, line.content]);

	const bgColor =
		line.type === "add"
			? "bg-green-500/10 dark:bg-green-500/15"
			: line.type === "del"
				? "bg-red-500/10 dark:bg-red-500/15"
				: "";

	const borderColor =
		line.type === "add"
			? "border-l-green-500"
			: line.type === "del"
				? "border-l-red-500"
				: "border-l-transparent";

	const lineNumberClass = "text-muted-foreground text-xs w-10 text-right px-2";

	return (
		<div className={cn("flex items-stretch border-l-2", bgColor, borderColor)}>
			{/* Old line number */}
			<span className={lineNumberClass}>
				{line.oldLineNumber !== null ? line.oldLineNumber : ""}
			</span>
			{/* New line number */}
			<span className={cn(lineNumberClass, "border-r border-border")}>
				{line.newLineNumber !== null ? line.newLineNumber : ""}
			</span>
			{/* Change indicator */}
			<span className="w-5 text-center shrink-0 select-none">
				{line.type === "add" && (
					<Plus className="size-3 inline text-green-600 dark:text-green-400" />
				)}
				{line.type === "del" && (
					<Minus className="size-3 inline text-red-600 dark:text-red-400" />
				)}
			</span>
			{/* Code content */}
			<code className="flex-1 font-mono text-sm px-2 whitespace-pre overflow-x-auto">
				{(highlightedHtml ?? cachedHtml) ? (
					<span
						// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output
						dangerouslySetInnerHTML={{
							__html: highlightedHtml ?? cachedHtml ?? "",
						}}
					/>
				) : (
					<span>{line.content}</span>
				)}
			</code>
		</div>
	);
});

/**
 * A single diff hunk
 */
function DiffHunkView({
	hunk,
	language,
}: {
	hunk: DiffHunk;
	language: string;
}) {
	return (
		<div className="border-b last:border-b-0">
			{/* Hunk header */}
			<div className="bg-muted/50 px-4 py-1 font-mono text-xs text-muted-foreground border-b">
				{hunk.header}
			</div>
			{/* Hunk lines */}
			<div>
				{hunk.lines.map((hunkLine, idx) => (
					<DiffLineView
						key={`${hunk.oldStart}-${hunk.newStart}-${idx}`}
						line={hunkLine}
						language={language}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * A single file's diff content
 */
function DiffFileContent({ file }: { file: DiffFile }) {
	const [isExpanded, setIsExpanded] = useState(true);
	const language = getLanguageFromExtension(file.extension);

	const StatusIcon =
		file.status === "added"
			? FilePlus
			: file.status === "deleted"
				? FileMinus
				: FileCode;

	const statusColor =
		file.status === "added"
			? "text-green-500"
			: file.status === "deleted"
				? "text-red-500"
				: "text-blue-500";

	const statusBadgeClass =
		file.status === "added"
			? "bg-green-500/10 text-green-600 border-green-500/30"
			: file.status === "deleted"
				? "bg-red-500/10 text-red-600 border-red-500/30"
				: "bg-blue-500/10 text-blue-600 border-blue-500/30";

	return (
		<div className="border rounded-lg overflow-hidden mb-4">
			{/* File header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 border-b hover:bg-muted/50 transition-colors"
			>
				{isExpanded ? (
					<ChevronDown className="size-4 shrink-0" />
				) : (
					<ChevronRight className="size-4 shrink-0" />
				)}
				<StatusIcon className={cn("size-4 shrink-0", statusColor)} />
				<span className="font-mono text-sm truncate flex-1 text-left">
					{file.path}
				</span>
				<Badge variant="outline" className={cn("text-xs", statusBadgeClass)}>
					{file.status}
				</Badge>
				<div className="flex items-center gap-2 text-xs shrink-0">
					{file.additions > 0 && (
						<span className="text-green-600 dark:text-green-400 font-medium">
							+{file.additions}
						</span>
					)}
					{file.deletions > 0 && (
						<span className="text-red-600 dark:text-red-400 font-medium">
							-{file.deletions}
						</span>
					)}
				</div>
			</button>

			{/* File content */}
			{isExpanded && (
				<div className="overflow-x-auto">
					{file.hunks.map((hunk, idx) => (
						<DiffHunkView
							key={`${file.path}-hunk-${idx}`}
							hunk={hunk}
							language={language}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * DiffViewer - Renders a unified diff with syntax highlighting
 */
export function DiffViewer({ diff, className }: DiffViewerProps) {
	const files = useMemo(() => parseUnifiedDiff(diff), [diff]);
	const extensions = useMemo(() => getUniqueExtensions(files), [files]);

	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [filterExtension, setFilterExtension] = useState<string>("all");

	// Filter files by extension
	const filteredFiles = useMemo(() => {
		if (filterExtension === "all") return files;
		return files.filter(
			(f) => f.extension.toLowerCase() === filterExtension.toLowerCase(),
		);
	}, [files, filterExtension]);

	// Calculate totals
	const totals = useMemo(() => {
		return files.reduce(
			(acc, file) => ({
				additions: acc.additions + file.additions,
				deletions: acc.deletions + file.deletions,
			}),
			{ additions: 0, deletions: 0 },
		);
	}, [files]);

	if (files.length === 0) {
		return (
			<div className={cn("text-center text-muted-foreground py-8", className)}>
				No changes to display
			</div>
		);
	}

	const handleFileSelect = (filePath: string) => {
		setSelectedFile(selectedFile === filePath ? null : filePath);
		// Scroll to file in main view
		const element = document.getElementById(
			`diff-file-${filePath.replace(/[^a-zA-Z0-9]/g, "-")}`,
		);
		element?.scrollIntoView({ behavior: "smooth" });
	};

	return (
		<div className={cn("flex h-full", className)}>
			{/* File tree sidebar */}
			<div className="w-64 border-r flex flex-col shrink-0">
				{/* Header with filter */}
				<div className="p-3 border-b space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">
							Files ({filteredFiles.length})
						</span>
						<div className="flex items-center gap-1 text-xs">
							<span className="text-green-600 dark:text-green-400">
								+{totals.additions}
							</span>
							<span className="text-muted-foreground">/</span>
							<span className="text-red-600 dark:text-red-400">
								-{totals.deletions}
							</span>
						</div>
					</div>

					{/* Extension filter */}
					{extensions.length > 1 && (
						<Select value={filterExtension} onValueChange={setFilterExtension}>
							<SelectTrigger size="sm" className="w-full">
								<Filter className="size-3 mr-1" />
								<SelectValue placeholder="Filter by type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All files</SelectItem>
								{extensions.map((ext) => (
									<SelectItem key={ext} value={ext}>
										.{ext}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>

				{/* File list */}
				<ScrollArea className="flex-1">
					<div className="p-2 space-y-0.5">
						{filteredFiles.map((file) => (
							<FileTreeItem
								key={file.path}
								file={file}
								isSelected={selectedFile === file.path}
								onSelect={() => handleFileSelect(file.path)}
							/>
						))}
					</div>
				</ScrollArea>
			</div>

			{/* Diff content */}
			<ScrollArea className="flex-1">
				<div className="p-4">
					{filteredFiles.map((file) => (
						<div
							key={file.path}
							id={`diff-file-${file.path.replace(/[^a-zA-Z0-9]/g, "-")}`}
						>
							<DiffFileContent file={file} />
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

// =============================================================================
// Modal Trigger Component
// =============================================================================

interface DiffViewerModalProps {
	/** Raw unified diff content */
	diff: string;
	/** Trigger element (defaults to a button) */
	trigger?: React.ReactNode;
	/** Optional additional className for the dialog content */
	className?: string;
}

/**
 * DiffViewerModal - A modal wrapper for the DiffViewer
 * Used to trigger the diff viewer from ReviewCardApproval
 */
export function DiffViewerModal({
	diff,
	trigger,
	className,
}: DiffViewerModalProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button variant="outline" size="sm">
						<GitCompareArrows className="size-4 mr-1" />
						View Diff
					</Button>
				)}
			</DialogTrigger>
			<DialogContent
				className={cn(
					"max-w-[90vw] w-[90vw] h-[85vh] p-0 flex flex-col",
					className,
				)}
				showCloseButton={true}
			>
				<DialogHeader className="px-4 py-3 border-b shrink-0">
					<DialogTitle className="flex items-center gap-2">
						<GitCompareArrows className="size-5" />
						Code Changes
					</DialogTitle>
				</DialogHeader>
				<div className="flex-1 overflow-hidden">
					<DiffViewer diff={diff} className="h-full" />
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Export types for external use
export type { DiffFile, DiffHunk, DiffLine };
