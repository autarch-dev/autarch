import { type ProjectInfo, ProjectInfoSchema } from "@/shared/schemas/project";

/**
 * Fetch project information (name, path, icon availability).
 */
export async function fetchProjectInfo(): Promise<ProjectInfo> {
	const response = await fetch("/api/project");
	const data = await response.json();
	return ProjectInfoSchema.parse(data);
}
