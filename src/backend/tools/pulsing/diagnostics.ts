import { Project } from "ts-morph";
import { getTsconfigPath } from "@/backend/services/project";
import type { ToolContext } from "../types";

const PROJECT_CACHE = new Map<string, Project>();

export async function getTSProject(context: ToolContext): Promise<Project | null> {
	const tsconfigPath = await getTsconfigPath(context.projectRoot);

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

export async function getDiagnostics(context: ToolContext, fullPath: string): Promise<string | null> {
	if (!/\.tsx?$/.test(fullPath)) {
		return null;
	}

	const tsconfigPath = await getTsconfigPath(context.projectRoot);
	if (!tsconfigPath) {
		return null;
	}

	const project = new Project({
		tsConfigFilePath: tsconfigPath,
	});

	const diagnostics = project.getPreEmitDiagnostics();
    return project.formatDiagnosticsWithColorAndContext(diagnostics);
}
