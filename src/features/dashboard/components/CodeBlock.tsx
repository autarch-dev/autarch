import { memo, useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	code: string;
	language?: string;
	className?: string;
	/** If true, skip syntax highlighting (for streaming) */
	isStreaming?: boolean;
}

// Module-level cache for highlighted code - persists across remounts
// Key: `${language}:${code}`, Value: highlighted HTML
const highlightCache = new Map<string, string>();

function getCacheKey(code: string, language: string): string {
	return `${language}:${code}`;
}

/**
 * CodeBlock with syntax highlighting via Shiki.
 * Uses a global cache to avoid re-highlighting the same code on remount,
 * which prevents flickering during streaming updates.
 */
export const CodeBlock = memo(function CodeBlock({
	code,
	language = "text",
	className,
	isStreaming = false,
}: CodeBlockProps) {
	const cacheKey = getCacheKey(code, language);
	const cachedHtml = highlightCache.get(cacheKey);

	// Initialize from cache if available (prevents flash on remount)
	const [html, setHtml] = useState<string | null>(cachedHtml ?? null);

	useEffect(() => {
		// Don't run highlighting while streaming - content is changing too fast
		if (isStreaming) {
			return;
		}

		// Already have cached result
		if (highlightCache.has(cacheKey)) {
			const cached = highlightCache.get(cacheKey)!;
			if (html !== cached) {
				setHtml(cached);
			}
			return;
		}

		let cancelled = false;

		codeToHtml(code, {
			lang: language,
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
		}).then((result) => {
			if (!cancelled) {
				highlightCache.set(cacheKey, result);
				setHtml(result);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [code, language, isStreaming, cacheKey, html]);

	const wrapperClasses = cn(
		"[&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg",
		"[&_.shiki]:rounded-lg",
		className,
	);

	// Show plain fallback while streaming or loading
	// Structure mirrors Shiki output: <div> → <pre> → <code>
	// Use Shiki CSS variables for consistent theming
	if ((isStreaming || !html) && !cachedHtml) {
		return (
			<div className={wrapperClasses}>
				<pre
					className="shiki rounded-lg"
					style={{
						backgroundColor: "var(--shiki-dark-bg, var(--shiki-light-bg))",
					}}
				>
					<code>{code}</code>
				</pre>
			</div>
		);
	}

	return (
		<div
			className={wrapperClasses}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is assumed safe
			dangerouslySetInnerHTML={{ __html: html ?? cachedHtml ?? "" }}
		/>
	);
});
