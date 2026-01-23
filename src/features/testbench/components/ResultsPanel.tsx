import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolExecutionResult } from "../types";

/**
 * Props for the ResultsPanel component.
 */
export interface ResultsPanelProps {
	/** The result of tool execution, or null if no execution has occurred */
	result: ToolExecutionResult | null;
	/** Whether a tool is currently executing */
	isExecuting: boolean;
}

/**
 * Displays the results of tool execution in the Tool Testbench.
 * Shows loading state during execution, placeholder when idle, or
 * success/error results with styled output.
 */
export function ResultsPanel({ result, isExecuting }: ResultsPanelProps) {
	// Loading state
	if (isExecuting) {
		return (
			<Card className="h-full">
				<CardHeader>
					<CardTitle>Results</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center h-48">
					<div className="flex flex-col items-center gap-3">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
						<p className="text-muted-foreground text-sm">Executing tool...</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Placeholder state - no result yet
	if (result === null) {
		return (
			<Card className="h-full">
				<CardHeader>
					<CardTitle>Results</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Execute a tool to see results
					</p>
				</CardContent>
			</Card>
		);
	}

	// Result state - show success or error
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Results
					<span
						className={`text-xs font-medium px-2 py-0.5 rounded ${
							result.success
								? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
						}`}
					>
						{result.success ? "Success" : "Error"}
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px] w-full rounded-md border">
					<pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
						<code>{result.output}</code>
					</pre>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
