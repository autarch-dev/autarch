import { type ProjectInfo, ProjectInfoSchema } from "@/shared/schemas/project";

/**
 * Fetch project information (name, path, icon availability).
 */
export async function fetchProjectInfo(): Promise<ProjectInfo> {
	const response = await fetch("/api/project");
	const data = await response.json();
	return ProjectInfoSchema.parse(data);
}

/**
 * Rewind a workflow to restart execution from the beginning.
 * Cleans up all pulse/preflight state and restarts from preflight.
 */
export async function rewindWorkflow(workflowId: string): Promise<void> {
	const response = await fetch(`/api/workflows/${workflowId}/rewind`, {
		method: "POST",
	});
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error ?? "Failed to rewind workflow");
	}
}
