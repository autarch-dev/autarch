import { Project } from "ts-morph";
import { getTsconfigPath } from "@/backend/services/project";
import type { ToolContext } from "../types";

const PROJECT_CACHE = new Map<string, Project>();

export async function getTSProject(
	context: ToolContext,
): Promise<Project | null> {
	const tsconfigPath = await getTsconfigPath(
		context.worktreePath ?? context.projectRoot,
	);

	if (tsconfigPath) {
		let project = PROJECT_CACHE.get(tsconfigPath);

		if (!project) {
			project = new Project({
				tsConfigFilePath: tsconfigPath,
			});
			PROJECT_CACHE.set(tsconfigPath, project);
		}
		return project;
	}

	return null;
}

export function clearTSProjectCache() {
	PROJECT_CACHE.clear();
}
