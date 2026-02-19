import type { StopCondition, ToolSet } from "ai";
import type { ToolName } from "@/backend/tools";

export function hasToolResult<T extends ToolSet>(toolName: ToolName): StopCondition<T> {
	return (options) => {
		return options.steps.some((step) =>
			step.toolResults.some((result) => result.toolName === toolName),
		);
	};
}
