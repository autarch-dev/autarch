import { Project } from "ts-morph";
import { log } from "@/backend/logger";
import { getTsconfigPath } from "@/backend/services/project";
import type { ToolContext } from "../types";

export const getDiagnostics = async (
	context: ToolContext,
	fullPath: string,
) => {
	if (!/\.tsx?$/.test(fullPath)) {
		log.tools.info(`getDiagnostics: ${fullPath} is not a TypeScript file`);
		return null;
	}

	const tsconfigPath = await getTsconfigPath(
		context.worktreePath ?? context.projectRoot,
	);
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

	if (diagnostics.length === 0) {
		return "✅ No type errors found";
	}

	return project.formatDiagnosticsWithColorAndContext(diagnostics);
};
