import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	code: string;
	language?: string;
	className?: string;
}

export function CodeBlock({
	code,
	language = "text",
	className,
}: CodeBlockProps) {
	const [html, setHtml] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		codeToHtml(code, {
			lang: language,
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
		}).then((result) => {
			if (!cancelled) {
				setHtml(result);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [code, language]);

	if (!html) {
		// Fallback while loading
		return (
			<pre className={cn("p-4 overflow-x-auto bg-muted rounded-lg", className)}>
				<code>{code}</code>
			</pre>
		);
	}

	return (
		<div
			className={cn(
				"[&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg",
				"[&_.shiki]:rounded-lg",
				className,
			)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is assumed safe
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
