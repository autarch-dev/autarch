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

import { diffWords } from "diff";
import {
	ChevronDown,
	ChevronRight,
	FileCode,
	FileMinus,
	FilePlus,
	Filter,
	Folder,
	GitCompareArrows,
	MessageSquarePlus,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { codeToHtml } from "shiki";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflowsStore } from "@/features/dashboard/store/workflowsStore";
import { cn } from "@/lib/utils";
import type { ReviewComment } from "@/shared/schemas/workflow";

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

/** Payload for adding a new comment */
interface AddCommentPayload {
	type: "line" | "file";
	filePath: string;
	startLine?: number;
	description: string;
}

interface DiffViewerProps {
	/** Raw unified diff content */
	diff: string;
	/** Review comments to display inline */
	comments?: ReviewComment[];
	/** Callback when user adds a comment */
	onAddComment?: (payload: AddCommentPayload) => void;
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

// =============================================================================
// File Tree Types & Helpers
// =============================================================================

/** Tree node representing a folder or file in the hierarchy */
interface TreeNode {
	type: "folder" | "file";
	name: string;
	children: Map<string, TreeNode>;
	file?: DiffFile;
}

/**
 * Build a hierarchical tree structure from a flat list of files
 */
function buildFileTree(files: DiffFile[]): TreeNode {
	const root: TreeNode = {
		type: "folder",
		name: "",
		children: new Map(),
	};

	for (const file of files) {
		const parts = file.path.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) continue;

			const isLastPart = i === parts.length - 1;

			if (isLastPart) {
				// This is the file
				current.children.set(part, {
					type: "file",
					name: part,
					children: new Map(),
					file,
				});
			} else {
				// This is a folder - create if it doesn't exist
				let next = current.children.get(part);
				if (!next) {
					next = {
						type: "folder",
						name: part,
						children: new Map(),
					};
					current.children.set(part, next);
				}
				current = next;
			}
		}
	}

	return root;
}

/**
 * Recursive tree node renderer for folders and files
 */
function FileTreeNode({
	node,
	selectedFile,
	onSelect,
	depth = 0,
	expandedFolders,
	setExpandedFolders,
}: {
	node: TreeNode;
	selectedFile: DiffFile | null;
	onSelect: (file: DiffFile) => void;
	depth?: number;
	expandedFolders: Set<string>;
	setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
	const sortedChildren = useMemo(() => {
		const entries = Array.from(node.children.entries());
		// Sort: folders first, then files, alphabetically within each group
		return entries.sort((a, b) => {
			if (a[1].type !== b[1].type) {
				return a[1].type === "folder" ? -1 : 1;
			}
			return a[0].localeCompare(b[0]);
		});
	}, [node.children]);

	if (node.type === "file" && node.file) {
		const file = node.file;
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
				onClick={() => onSelect(file)}
				className={cn(
					"w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors",
					"hover:bg-muted/50",
					selectedFile === file && "bg-muted",
				)}
				style={{ paddingLeft: `${depth * 12 + 8}px` }}
			>
				<StatusIcon className={cn("size-4 shrink-0", statusColor)} />
				<span className="truncate flex-1 font-mono text-xs">{node.name}</span>
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

	// Folder node
	const folderPath = node.name; // Use name as unique identifier for expansion state
	const isOpen = expandedFolders.has(folderPath);

	const toggleFolder = () => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			if (next.has(folderPath)) {
				next.delete(folderPath);
			} else {
				next.add(folderPath);
			}
			return next;
		});
	};

	return (
		<Collapsible open={isOpen} onOpenChange={toggleFolder}>
			<CollapsibleTrigger
				className={cn(
					"w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors",
					"hover:bg-muted/50",
				)}
				style={{ paddingLeft: `${depth * 12 + 8}px` }}
			>
				{isOpen ? (
					<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
				)}
				<Folder className="size-4 shrink-0 text-muted-foreground" />
				<span className="truncate flex-1 font-mono text-xs">{node.name}</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{sortedChildren.map(([name, child]) => (
					<FileTreeNode
						key={name}
						node={child}
						selectedFile={selectedFile}
						onSelect={onSelect}
						depth={depth + 1}
						expandedFolders={expandedFolders}
						setExpandedFolders={setExpandedFolders}
					/>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Hierarchical file tree component
 */
function FileTree({
	files,
	selectedFile,
	onSelect,
}: {
	files: DiffFile[];
	selectedFile: DiffFile | null;
	onSelect: (file: DiffFile) => void;
}) {
	const tree = useMemo(() => buildFileTree(files), [files]);

	// Initialize all folders as expanded by collecting all folder names
	const allFolderNames = useMemo(() => {
		const names = new Set<string>();
		const collectFolders = (node: TreeNode) => {
			if (node.type === "folder" && node.name) {
				names.add(node.name);
			}
			for (const child of node.children.values()) {
				collectFolders(child);
			}
		};
		collectFolders(tree);
		return names;
	}, [tree]);

	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		() => new Set(allFolderNames),
	);

	const sortedChildren = useMemo(() => {
		const entries = Array.from(tree.children.entries());
		// Sort: folders first, then files, alphabetically within each group
		return entries.sort((a, b) => {
			if (a[1].type !== b[1].type) {
				return a[1].type === "folder" ? -1 : 1;
			}
			return a[0].localeCompare(b[0]);
		});
	}, [tree.children]);

	return (
		<div className="space-y-0.5">
			{sortedChildren.map(([name, child]) => (
				<FileTreeNode
					key={name}
					node={child}
					selectedFile={selectedFile}
					onSelect={onSelect}
					depth={0}
					expandedFolders={expandedFolders}
					setExpandedFolders={setExpandedFolders}
				/>
			))}
		</div>
	);
}

// Module-level cache for highlighted diff lines
// Cache key format:
// - Single content: "<language>:<content>"
// - Word diff pair: "<language>:word:<oldContent>:<newContent>:<side>"
const diffHighlightCache = new Map<string, string>();

/**
 * Escape HTML entities in a string to prevent XSS and ensure proper rendering
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Apply word-level diff highlighting to paired lines.
 * Returns { left, right } with HTML markup for changed segments.
 * Falls back to original content if diffWords fails or returns empty.
 */
function applyWordDiff(
	oldContent: string,
	newContent: string,
): { left: string; right: string } | null {
	try {
		const changes = diffWords(oldContent, newContent);

		// Defensive: if no changes returned, fall back
		if (!changes || changes.length === 0) {
			return null;
		}

		let leftHtml = "";
		let rightHtml = "";

		for (const change of changes) {
			const escapedValue = escapeHtml(change.value);

			if (change.removed) {
				// Removed text: only appears on the left (old) side
				leftHtml += `<mark class="bg-red-500/30">${escapedValue}</mark>`;
			} else if (change.added) {
				// Added text: only appears on the right (new) side
				rightHtml += `<mark class="bg-green-500/30">${escapedValue}</mark>`;
			} else {
				// Unchanged text: appears on both sides
				leftHtml += escapedValue;
				rightHtml += escapedValue;
			}
		}

		return { left: leftHtml, right: rightHtml };
	} catch {
		// If diffWords throws, fall back to original content
		return null;
	}
}

/**
 * Inline form for adding a comment
 */
function AddCommentForm({
	onSubmit,
	onCancel,
}: {
	onSubmit: (description: string) => void;
	onCancel: () => void;
}) {
	const [description, setDescription] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (description.trim()) {
			onSubmit(description.trim());
		}
	};

	return (
		<div className="mx-4 my-2 p-3 rounded-lg border bg-violet-500/5 border-violet-500/30">
			<form onSubmit={handleSubmit} className="space-y-2">
				<Textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Add your comment..."
					rows={2}
					autoFocus
					className="bg-background"
				/>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit" size="sm" disabled={!description.trim()}>
						Add Comment
					</Button>
				</div>
			</form>
		</div>
	);
}

/**
 * Hook for syntax highlighting a single line of code
 */
function useHighlightedCode(content: string, language: string) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const cacheKey = `${language}:${content}`;
	const cachedHtml = diffHighlightCache.get(cacheKey);

	useEffect(() => {
		if (cachedHtml) {
			setHighlightedHtml(cachedHtml);
			return;
		}

		// Skip highlighting for empty lines
		if (!content.trim()) {
			return;
		}

		let cancelled = false;

		codeToHtml(content, {
			lang: language,
			theme: "github-dark",
		}).then((result) => {
			if (!cancelled) {
				// Extract just the code content, stripping wrapper elements
				const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
				const codeContent = match?.[1] ?? content;
				diffHighlightCache.set(cacheKey, codeContent);
				setHighlightedHtml(codeContent);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [cacheKey, cachedHtml, language, content]);

	return highlightedHtml ?? cachedHtml ?? null;
}

/** Paired row for side-by-side diff: left (old/del) and right (new/add) */
interface SideBySidePair {
	left: DiffLine | null;
	right: DiffLine | null;
}

/**
 * Process hunk lines into paired rows for side-by-side display.
 * - Consecutive del/add lines are paired together
 * - Del without matching add: left=del, right=null
 * - Add without matching del: left=null, right=add
 * - Context lines: render identically on both sides
 */
function pairHunkLines(lines: DiffLine[]): SideBySidePair[] {
	const pairs: SideBySidePair[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (!line) {
			i++;
			continue;
		}

		if (line.type === "context") {
			// Context lines render identically on both sides
			pairs.push({ left: line, right: line });
			i++;
		} else if (line.type === "del") {
			// Check if next line is an add (paired modification)
			const nextLine = lines[i + 1];
			if (nextLine?.type === "add") {
				// Paired: del on left, add on right
				pairs.push({ left: line, right: nextLine });
				i += 2;
			} else {
				// Pure deletion: del on left, empty right
				pairs.push({ left: line, right: null });
				i++;
			}
		} else if (line.type === "add") {
			// Pure addition: empty left, add on right
			pairs.push({ left: null, right: line });
			i++;
		} else {
			i++;
		}
	}

	return pairs;
}

/**
 * Hook for word-level diff highlighting on paired del/add lines.
 * Returns { leftHtml, rightHtml } with word-level diff markup applied,
 * or null if word diff is not applicable (context lines, unpaired lines, or failure).
 */
function useWordDiffHighlightedCode(
	leftContent: string | null,
	rightContent: string | null,
	leftType: "add" | "del" | "context" | undefined,
	rightType: "add" | "del" | "context" | undefined,
	language: string,
): { leftHtml: string | null; rightHtml: string | null } | null {
	const [result, setResult] = useState<{
		leftHtml: string | null;
		rightHtml: string | null;
	} | null>(null);

	// Only apply word diff to paired del/add lines (not context, not unpaired)
	const isPairedModification =
		leftType === "del" &&
		rightType === "add" &&
		leftContent !== null &&
		rightContent !== null;

	// Cache key includes both contents for word diff scenarios
	const cacheKeyLeft = isPairedModification
		? `${language}:word:${leftContent}:${rightContent}:left`
		: null;
	const cacheKeyRight = isPairedModification
		? `${language}:word:${leftContent}:${rightContent}:right`
		: null;

	const cachedLeft = cacheKeyLeft
		? diffHighlightCache.get(cacheKeyLeft)
		: undefined;
	const cachedRight = cacheKeyRight
		? diffHighlightCache.get(cacheKeyRight)
		: undefined;

	useEffect(() => {
		if (!isPairedModification || !leftContent || !rightContent) {
			setResult(null);
			return;
		}

		// Check cache first
		if (cachedLeft !== undefined && cachedRight !== undefined) {
			setResult({ leftHtml: cachedLeft, rightHtml: cachedRight });
			return;
		}

		// Compute word diff
		const wordDiffResult = applyWordDiff(leftContent, rightContent);
		if (!wordDiffResult) {
			setResult(null);
			return;
		}

		let cancelled = false;

		// Now apply syntax highlighting to the word-diff result
		// We pass the pre-escaped HTML content with marks to Shiki
		// Since the content already has HTML, we need to handle this carefully
		// Actually, we should apply syntax highlighting first, then word diff
		// But that's complex. For now, skip syntax highlighting for word-diff lines
		// and just use the word-diff markup directly.

		// Store in cache
		if (cacheKeyLeft && cacheKeyRight) {
			diffHighlightCache.set(cacheKeyLeft, wordDiffResult.left);
			diffHighlightCache.set(cacheKeyRight, wordDiffResult.right);
		}

		if (!cancelled) {
			setResult({
				leftHtml: wordDiffResult.left,
				rightHtml: wordDiffResult.right,
			});
		}

		return () => {
			cancelled = true;
		};
	}, [
		isPairedModification,
		leftContent,
		rightContent,
		cacheKeyLeft,
		cacheKeyRight,
		cachedLeft,
		cachedRight,
	]);

	return isPairedModification ? result : null;
}

/**
 * Side-by-side diff line component - renders a paired row with left (old) and right (new) columns
 */
const SideBySideDiffLine = memo(function SideBySideDiffLine({
	pair,
	language,
	onLineClick,
}: {
	pair: SideBySidePair;
	language: string;
	onLineClick?: (lineNumber: number) => void;
}) {
	const { left, right } = pair;

	// For context lines, left and right are the same line object
	const isContext = left?.type === "context" && right?.type === "context";

	// Check if this is a paired del/add (modification)
	const isPairedModification = left?.type === "del" && right?.type === "add";

	// Try word-level diff for paired modifications
	const wordDiffResult = useWordDiffHighlightedCode(
		left?.content ?? null,
		right?.content ?? null,
		left?.type,
		right?.type,
		language,
	);

	// Fall back to regular syntax highlighting if word diff is not applicable or failed
	const leftHighlighted = useHighlightedCode(left?.content ?? "", language);
	const rightHighlighted = useHighlightedCode(right?.content ?? "", language);

	// Use word diff result if available, otherwise use regular highlighting
	const leftHtml =
		isPairedModification && wordDiffResult?.leftHtml
			? wordDiffResult.leftHtml
			: leftHighlighted;
	const rightHtml =
		isPairedModification && wordDiffResult?.rightHtml
			? wordDiffResult.rightHtml
			: rightHighlighted;

	const handleRightClick = () => {
		if (
			onLineClick &&
			right?.newLineNumber !== null &&
			right?.newLineNumber !== undefined
		) {
			onLineClick(right.newLineNumber);
		}
	};

	const isRightClickable =
		onLineClick &&
		right?.newLineNumber !== null &&
		right?.newLineNumber !== undefined;

	const rightInteractiveProps = isRightClickable
		? {
				onClick: handleRightClick,
				onKeyDown: (e: React.KeyboardEvent) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleRightClick();
					}
				},
				role: "button" as const,
				tabIndex: 0,
			}
		: {};

	return (
		<div className="grid grid-cols-2 gap-0">
			{/* Left column (old/deletion) */}
			<div
				className={cn(
					"flex items-stretch border-r border-border",
					left?.type === "del" && "bg-red-500/10 dark:bg-red-500/15",
					isContext && "bg-transparent",
					!left && "bg-muted/30",
				)}
			>
				{/* Line number */}
				<span className="text-muted-foreground text-xs w-12 text-right px-2 py-0.5 shrink-0 border-r border-border/50">
					{left?.oldLineNumber ?? ""}
				</span>
				{/* Code content */}
				<code className="min-w-0 flex-1 font-mono text-sm px-2 whitespace-pre overflow-x-auto">
					{left ? (
						leftHtml ? (
							<span
								// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki/word-diff output
								dangerouslySetInnerHTML={{ __html: leftHtml }}
							/>
						) : (
							<span>{left.content}</span>
						)
					) : (
						<span>&nbsp;</span>
					)}
				</code>
			</div>

			{/* Right column (new/addition) */}
			<div
				className={cn(
					"flex items-stretch group",
					right?.type === "add" && "bg-green-500/10 dark:bg-green-500/15",
					isContext && "bg-transparent",
					!right && "bg-muted/30",
					isRightClickable && "cursor-pointer hover:bg-muted/30",
				)}
				{...rightInteractiveProps}
			>
				{/* Line number */}
				<span className="text-muted-foreground text-xs w-12 text-right px-2 py-0.5 shrink-0 border-r border-border/50">
					{right?.newLineNumber ?? ""}
				</span>
				{/* Add comment indicator */}
				<span className="w-5 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
					{isRightClickable && (
						<MessageSquarePlus className="size-3 text-violet-500" />
					)}
				</span>
				{/* Code content */}
				<code className="min-w-0 flex-1 font-mono text-sm px-2 whitespace-pre overflow-x-auto">
					{right ? (
						rightHtml ? (
							<span
								// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki/word-diff output
								dangerouslySetInnerHTML={{ __html: rightHtml }}
							/>
						) : (
							<span>{right.content}</span>
						)
					) : (
						<span>&nbsp;</span>
					)}
				</code>
			</div>
		</div>
	);
});

/** State for tracking active comment form */
interface CommentFormState {
	isOpen: boolean;
	lineNumber: number | null;
}

/**
 * A single diff hunk
 */
function DiffHunkView({
	hunk,
	language,
	commentsByLine,
	newFileLineNumbers,
	onLineClick,
	activeCommentLine,
	onCommentSubmit,
	onCommentCancel,
}: {
	hunk: DiffHunk;
	language: string;
	/** Pre-computed map of line number -> comments for this line */
	commentsByLine: Map<number, ReviewComment[]>;
	/** Set of all line numbers that exist in the new file (additions + context) */
	newFileLineNumbers: Set<number>;
	/** Callback when a line is clicked */
	onLineClick?: (lineNumber: number) => void;
	/** Currently active line for comment form */
	activeCommentLine: number | null;
	/** Callback when comment is submitted */
	onCommentSubmit?: (description: string) => void;
	/** Callback when comment form is cancelled */
	onCommentCancel?: () => void;
}) {
	// Pair lines for side-by-side display
	const pairs = useMemo(() => pairHunkLines(hunk.lines), [hunk.lines]);

	return (
		<div className="border-b last:border-b-0">
			{/* Hunk header */}
			<div className="bg-muted/50 px-4 py-1 font-mono text-xs text-muted-foreground border-b">
				{hunk.header}
			</div>
			{/* Hunk lines - side by side */}
			<div>
				{pairs.map((pair, idx) => {
					// Determine which line number to use for comments
					// For paired rows, use the right (new) line number
					// For pure deletions, use old line number if it doesn't exist in new file
					let comments: ReviewComment[] = [];
					let targetLineNumber: number | null = null;

					if (pair.right?.newLineNumber) {
						// Additions/context/paired: use new line number
						targetLineNumber = pair.right.newLineNumber;
						comments = commentsByLine.get(targetLineNumber) ?? [];
					} else if (pair.left?.type === "del" && pair.left.oldLineNumber) {
						// Pure deletion: only show comment if line doesn't exist in new file
						if (!newFileLineNumbers.has(pair.left.oldLineNumber)) {
							targetLineNumber = pair.left.oldLineNumber;
							comments = commentsByLine.get(targetLineNumber) ?? [];
						}
					}

					const showCommentForm =
						activeCommentLine !== null &&
						pair.right?.newLineNumber !== null &&
						activeCommentLine === pair.right?.newLineNumber;

					return (
						<div key={`${hunk.oldStart}-${hunk.newStart}-${idx}`}>
							<SideBySideDiffLine
								pair={pair}
								language={language}
								onLineClick={onLineClick}
							/>
							{showCommentForm && onCommentSubmit && onCommentCancel && (
								<AddCommentForm
									onSubmit={onCommentSubmit}
									onCancel={onCommentCancel}
								/>
							)}
							{comments.map((comment) => (
								<InlineComment key={comment.id} comment={comment} />
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}

/**
 * A single file's diff content
 */
function DiffFileContent({
	file,
	comments,
	onAddComment,
}: {
	file: DiffFile;
	comments?: ReviewComment[];
	onAddComment?: (payload: AddCommentPayload) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(true);
	const [commentForm, setCommentForm] = useState<CommentFormState>({
		isOpen: false,
		lineNumber: null,
	});
	const [showFileCommentForm, setShowFileCommentForm] = useState(false);
	const language = getLanguageFromExtension(file.extension);

	const handleLineClick = (lineNumber: number) => {
		if (!onAddComment) return;
		setCommentForm({ isOpen: true, lineNumber });
	};

	const handleLineCommentSubmit = (description: string) => {
		if (onAddComment && commentForm.lineNumber !== null) {
			onAddComment({
				type: "line",
				filePath: file.path,
				startLine: commentForm.lineNumber,
				description,
			});
		}
		setCommentForm({ isOpen: false, lineNumber: null });
	};

	const handleLineCommentCancel = () => {
		setCommentForm({ isOpen: false, lineNumber: null });
	};

	const handleFileCommentSubmit = (description: string) => {
		if (onAddComment) {
			onAddComment({
				type: "file",
				filePath: file.path,
				description,
			});
		}
		setShowFileCommentForm(false);
	};

	// Separate file-level comments from line comments
	const fileComments = comments?.filter((c) => c.type === "file") ?? [];
	const lineComments = comments?.filter((c) => c.type === "line") ?? [];
	const hasComments = (comments?.length ?? 0) > 0;

	// Pre-compute which line each comment should appear after (its endLine or startLine)
	// This ensures each comment appears exactly once
	const commentsByLine = useMemo(() => {
		const map = new Map<number, ReviewComment[]>();
		for (const comment of lineComments) {
			const targetLine = comment.endLine ?? comment.startLine;
			if (targetLine) {
				const existing = map.get(targetLine) ?? [];
				existing.push(comment);
				map.set(targetLine, existing);
			}
		}
		return map;
	}, [lineComments]);

	// Collect all line numbers that exist in the new file (additions + context lines)
	// Used to determine if a deletion is "pure" (line removed) vs "modified" (line changed)
	const newFileLineNumbers = useMemo(() => {
		const lineNumbers = new Set<number>();
		for (const hunk of file.hunks) {
			for (const line of hunk.lines) {
				if (line.newLineNumber !== null) {
					lineNumbers.add(line.newLineNumber);
				}
			}
		}
		return lineNumbers;
	}, [file.hunks]);

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
		<div
			className={cn(
				"border rounded-lg overflow-hidden mb-4",
				hasComments && "ring-2 ring-amber-500/30",
			)}
		>
			{/* File header - using div with role="button" instead of <button> to avoid
			 nested button issue (the "Add comment" Button inside would cause hydration errors) */}
			{/* biome-ignore lint/a11y/useSemanticElements: div required to avoid nested button hydration error */}
			<div
				role="button"
				tabIndex={0}
				onClick={() => setIsExpanded(!isExpanded)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setIsExpanded(!isExpanded);
					}
				}}
				className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 border-b hover:bg-muted/50 transition-colors cursor-pointer"
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
				{hasComments && (
					<Badge
						variant="outline"
						className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
					>
						{comments?.length} comment{comments?.length !== 1 ? "s" : ""}
					</Badge>
				)}
				{onAddComment && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							setShowFileCommentForm(true);
							setIsExpanded(true);
						}}
					>
						<MessageSquarePlus className="size-3 mr-1" />
						Add comment
					</Button>
				)}
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
			</div>

			{/* File-level comments */}
			{isExpanded && (fileComments.length > 0 || showFileCommentForm) && (
				<div className="border-b bg-muted/20">
					{showFileCommentForm && (
						<AddCommentForm
							onSubmit={handleFileCommentSubmit}
							onCancel={() => setShowFileCommentForm(false)}
						/>
					)}
					{fileComments.map((comment) => (
						<InlineComment key={comment.id} comment={comment} />
					))}
				</div>
			)}

			{/* File content */}
			{isExpanded && (
				<div className="overflow-x-auto">
					{file.hunks.map((hunk, idx) => (
						<DiffHunkView
							key={`${file.path}-hunk-${idx}`}
							hunk={hunk}
							language={language}
							commentsByLine={commentsByLine}
							newFileLineNumbers={newFileLineNumbers}
							onLineClick={onAddComment ? handleLineClick : undefined}
							activeCommentLine={
								commentForm.isOpen ? commentForm.lineNumber : null
							}
							onCommentSubmit={handleLineCommentSubmit}
							onCommentCancel={handleLineCommentCancel}
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

/** Group comments by file path */
function groupCommentsByFile(comments: ReviewComment[] = []) {
	const byFile = new Map<string, ReviewComment[]>();
	for (const comment of comments) {
		if (comment.filePath) {
			const existing = byFile.get(comment.filePath) ?? [];
			existing.push(comment);
			byFile.set(comment.filePath, existing);
		}
	}
	return byFile;
}

/** Severity colors for comment badges */
const SEVERITY_COLORS = {
	High: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
	Medium:
		"bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
	Low: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
} as const;

/** Inline comment bubble for diff view */
function InlineComment({ comment }: { comment: ReviewComment }) {
	// Explicit check for user comments
	const isUserComment = comment.author === "user";

	// User comments get a distinct purple/violet tint, agent comments use severity-based colors
	const colorClass = isUserComment
		? "bg-violet-500/10 text-foreground border-violet-500/40"
		: comment.severity
			? SEVERITY_COLORS[comment.severity]
			: "bg-muted/50 text-foreground border-border";

	return (
		<div className={cn("mx-4 my-2 p-3 rounded-lg border text-sm", colorClass)}>
			<div className="flex items-center gap-2 mb-1">
				{isUserComment ? (
					<Badge
						variant="outline"
						className="text-xs bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
					>
						You
					</Badge>
				) : (
					<>
						{comment.severity && (
							<Badge variant="outline" className="text-xs">
								{comment.severity}
							</Badge>
						)}
						{comment.category && (
							<Badge variant="secondary" className="text-xs">
								{comment.category}
							</Badge>
						)}
					</>
				)}
				{comment.type === "line" && comment.startLine && (
					<span className="text-xs text-muted-foreground font-mono">
						Line {comment.startLine}
						{comment.endLine && comment.endLine !== comment.startLine
							? `-${comment.endLine}`
							: ""}
					</span>
				)}
			</div>
			<p className="text-foreground">{comment.description}</p>
		</div>
	);
}

/**
 * DiffViewer - Renders a unified diff with syntax highlighting
 */
export function DiffViewer({
	diff,
	comments,
	onAddComment,
	className,
}: DiffViewerProps) {
	const files = useMemo(() => parseUnifiedDiff(diff), [diff]);
	const extensions = useMemo(() => getUniqueExtensions(files), [files]);
	const commentsByFile = useMemo(
		() => groupCommentsByFile(comments),
		[comments],
	);

	const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
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

	const scrollToFile = (file: DiffFile) => {
		const element = document.getElementById(
			`diff-file-${file.path.replace(/[^a-zA-Z0-9]/g, "-")}`,
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
					<div className="p-2">
						<FileTree
							files={filteredFiles}
							selectedFile={selectedFile}
							onSelect={(file) => {
								setSelectedFile(file);
								scrollToFile(file);
							}}
						/>
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
							<DiffFileContent
								file={file}
								comments={commentsByFile.get(file.path)}
								onAddComment={onAddComment}
							/>
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
	/** Review comments to display inline */
	comments?: ReviewComment[];
	/** Workflow ID for creating comments via store */
	workflowId?: string;
	/** Callback when user adds a comment (alternative to workflowId) */
	onAddComment?: (payload: AddCommentPayload) => void;
	/** Trigger element (defaults to a button) */
	trigger?: React.ReactNode;
	/** Optional additional className for the dialog content */
	className?: string;
}

/**
 * DiffViewerModal - A full-screen sheet for viewing diffs
 * Uses Sheet component for better full-screen experience
 */
export function DiffViewerModal({
	diff,
	comments,
	workflowId,
	onAddComment,
	trigger,
	className,
}: DiffViewerModalProps) {
	const createReviewComment = useWorkflowsStore(
		(state) => state.createReviewComment,
	);

	// Use store-based comment creation when workflowId is provided
	const handleAddComment = async (payload: AddCommentPayload) => {
		if (workflowId) {
			await createReviewComment(workflowId, {
				type: payload.type,
				filePath: payload.filePath,
				startLine: payload.startLine,
				description: payload.description,
			});
		} else if (onAddComment) {
			onAddComment(payload);
		}
	};

	// Enable comment creation if workflowId or onAddComment is provided
	const canAddComments = workflowId || onAddComment;

	return (
		<Sheet>
			<SheetTrigger asChild>
				{trigger ?? (
					<Button variant="outline" size="sm">
						<GitCompareArrows className="size-4 mr-1" />
						View Diff
					</Button>
				)}
			</SheetTrigger>
			<SheetContent
				side="right"
				className={cn("!w-[100vw] !max-w-[100vw] p-0 flex flex-col", className)}
			>
				<SheetHeader className="px-4 py-3 border-b shrink-0">
					<SheetTitle className="flex items-center gap-2">
						<GitCompareArrows className="size-5" />
						Code Changes
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 overflow-hidden">
					<DiffViewer
						diff={diff}
						comments={comments}
						onAddComment={canAddComments ? handleAddComment : undefined}
						className="h-full"
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}

// Export types for external use
export type { AddCommentPayload, DiffFile, DiffHunk, DiffLine };
