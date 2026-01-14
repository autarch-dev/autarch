import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
	children: string;
	className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
	return (
		<div
			className={cn(
				"prose prose-sm max-w-none",
				// Use theme colors instead of prose-invert
				"prose-headings:text-foreground",
				"prose-p:text-foreground",
				"prose-strong:text-foreground prose-strong:font-semibold",
				"prose-li:text-foreground",
				// Headings
				"prose-headings:font-semibold prose-headings:tracking-tight",
				"prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
				// Paragraphs
				"prose-p:my-2 prose-p:leading-relaxed",
				// Lists - ensure proper styling
				"prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6 prose-ul:marker:text-muted-foreground",
				"prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6 prose-ol:marker:text-muted-foreground",
				"prose-li:my-0.5 prose-li:pl-1",
				// Inline code
				"prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal",
				"prose-code:before:content-none prose-code:after:content-none",
				// Code blocks container (shiki handles bg colors)
				"prose-pre:border-0 prose-pre:p-0 prose-pre:my-3 prose-pre:bg-transparent",
				// Links
				"prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
				// Blockquotes
				"prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
				// Tables
				"prose-table:text-sm",
				"prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-th:text-foreground",
				"prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-foreground",
				// Horizontal rules
				"prose-hr:border-border",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// Custom code rendering with syntax highlighting
					code({ className, children }) {
						const match = /language-(\w+)/.exec(className || "");
						const language = match?.[1];
						const codeString = extractTextFromChildren(children);

						// If it's a code block (has language or is inside pre)
						if (language || className) {
							return (
								<CodeBlock
									code={codeString}
									language={language || "text"}
									className="text-sm"
								/>
							);
						}

						// Inline code
						return <code>{children}</code>;
					},
					// Remove default pre wrapper since CodeBlock handles it
					pre({ children }) {
						return <>{children}</>;
					},
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}

/**
 * Extract plain text from React children (handles nested elements)
 */
function extractTextFromChildren(children: ReactNode): string {
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (!children) return "";

	if (Array.isArray(children)) {
		return children.map(extractTextFromChildren).join("");
	}

	if (
		typeof children === "object" &&
		"props" in children &&
		children.props &&
		typeof children.props === "object" &&
		"children" in children.props
	) {
		return extractTextFromChildren(
			(children.props as { children: ReactNode }).children,
		);
	}

	return "";
}
