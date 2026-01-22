import { useEffect, useState } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResultsPanel, SchemaForm, ToolSelector } from "./components";
import type { ToolExecutionResult, ToolSchema } from "./types";

/**
 * Tool Testbench page component.
 *
 * Provides a development interface for testing tools from the registry.
 * Features a split-view layout with tool selection and input form on the left,
 * and execution results on the right.
 */
export function ToolTestbench() {
	// State for tool management
	const [tools, setTools] = useState<string[]>([]);
	const [selectedTool, setSelectedTool] = useState<string | null>(null);
	const [toolSchema, setToolSchema] = useState<ToolSchema | null>(null);
	const [result, setResult] = useState<ToolExecutionResult | null>(null);

	// Loading states
	const [isLoading, setIsLoading] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);

	// Fetch available tools on mount
	useEffect(() => {
		async function fetchTools() {
			setIsLoading(true);
			try {
				const response = await fetch("/api/tools");
				if (response.ok) {
					const data = await response.json();
					setTools(data.tools ?? []);
				}
			} catch (error) {
				console.error("Failed to fetch tools:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchTools();
	}, []);

	// Fetch tool schema when selection changes
	useEffect(() => {
		if (!selectedTool) {
			setToolSchema(null);
			return;
		}

		async function fetchToolSchema() {
			setIsLoading(true);
			try {
				const response = await fetch(`/api/tools/${selectedTool}`);
				if (response.ok) {
					const data = await response.json();
					setToolSchema(data);
				}
			} catch (error) {
				console.error("Failed to fetch tool schema:", error);
				setToolSchema(null);
			} finally {
				setIsLoading(false);
			}
		}

		fetchToolSchema();
	}, [selectedTool]);

	// Handle tool execution
	const handleExecute = async (values: Record<string, unknown>) => {
		if (!selectedTool) return;

		setIsExecuting(true);
		setResult(null);

		try {
			const response = await fetch(`/api/tools/${selectedTool}/execute`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...values,
					reason: "Tool Testbench execution",
				}),
			});

			const data = await response.json();
			setResult(data);
		} catch (error) {
			setResult({
				success: false,
				output:
					error instanceof Error ? error.message : "Unknown error occurred",
			});
		} finally {
			setIsExecuting(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<header className="border-b px-6 py-4 shrink-0">
				<h1 className="text-2xl font-semibold">Tool Testbench</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Test tools from the registry by selecting a tool, filling out the
					form, and executing.
				</p>
			</header>

			{/* Split view content */}
			<ResizablePanelGroup orientation="horizontal" className="flex-1">
				{/* Left panel: Tool selector and form */}
				<ResizablePanel defaultSize={50} minSize={30}>
					<div className="flex flex-col h-full p-4">
						{/* Tool selector */}
						<div className="shrink-0 mb-4">
							<ToolSelector
								tools={tools}
								selectedTool={selectedTool}
								onSelectTool={setSelectedTool}
								disabled={isLoading}
							/>
						</div>

						{/* Scrollable form area */}
						<ScrollArea className="flex-1">
							<div className="pr-4">
								{/* Tool info header when selected */}
								{toolSchema && (
									<div className="mb-4 pb-4 border-b">
										<h2 className="font-medium text-lg">{toolSchema.name}</h2>
										{toolSchema.description && (
											<p className="text-muted-foreground text-sm mt-1">
												{toolSchema.description}
											</p>
										)}
									</div>
								)}

								{/* Dynamic form */}
								<SchemaForm
									schema={toolSchema}
									onSubmit={handleExecute}
									isExecuting={isExecuting}
								/>
							</div>
						</ScrollArea>
					</div>
				</ResizablePanel>

				{/* Resize handle */}
				<ResizableHandle withHandle />

				{/* Right panel: Results */}
				<ResizablePanel defaultSize={50} minSize={30}>
					<div className="h-full p-4">
						<ResultsPanel result={result} isExecuting={isExecuting} />
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
