import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

/**
 * Props for the ToolSelector component.
 */
export interface ToolSelectorProps {
	/** List of available tool names */
	tools: string[];
	/** Currently selected tool name, or null if none selected */
	selectedTool: string | null;
	/** Callback when a tool is selected */
	onSelectTool: (tool: string) => void;
	/** Whether the selector is disabled */
	disabled?: boolean;
}

/**
 * A dropdown selector for choosing a tool from the registry.
 * Used in the Tool Testbench to select which tool to test.
 */
export function ToolSelector({
	tools,
	selectedTool,
	onSelectTool,
	disabled = false,
}: ToolSelectorProps) {
	return (
		<Select
			value={selectedTool ?? undefined}
			onValueChange={onSelectTool}
			disabled={disabled}
		>
			<SelectTrigger className="w-full">
				<SelectValue placeholder="Select a tool..." />
			</SelectTrigger>
			<SelectContent>
				{tools.map((tool) => (
					<SelectItem key={tool} value={tool}>
						{tool}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
