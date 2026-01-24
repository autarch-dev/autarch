import { Project } from "ts-morph";
import { log } from "@/backend/logger";
import { getTsconfigPath } from "@/backend/services/project";
import type { ToolContext } from "../types";

const PROJECT_CACHE = new Map<string, Project>();

export async function getTSProject(
	context: ToolContext,
): Promise<Project | null> {
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

export async function getDiagnostics(
	context: ToolContext,
	fullPath: string,
): Promise<string | null> {
	if (!/\.tsx?$/.test(fullPath)) {
		log.tools.info(`getDiagnostics: ${fullPath} is not a TypeScript file`);
		return null;
	}

	const tsconfigPath = await getTsconfigPath(context.worktreePath ?? context.projectRoot);
	if (!tsconfigPath) {
		log.tools.info(
			`getDiagnostics: no tsconfig.json found for project ${context.worktreePath ?? context.projectRoot}`,
		);
		return null;
	}

	const project = new Project({
		tsConfigFilePath: tsconfigPath,
	});

	project.resolveSourceFileDependencies();
	const diagnostics = project.getPreEmitDiagnostics();

	log.tools.info(
		`getDiagnostics: ${fullPath} has ${diagnostics.length} type error(s)`,
	);

	return project.formatDiagnosticsWithColorAndContext(diagnostics);
}
