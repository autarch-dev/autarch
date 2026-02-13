import { ThreadPool } from "bun-threads";
import type { ToolContext } from "../types";

export const getDiagnosticsThreadPool = new ThreadPool(
	async (context: ToolContext, fullPath: string) => {
		const { Project } = await import("ts-morph");
		const { log } = await import("@/backend/logger");
		const { getTsconfigPath } = await import("@/backend/services/project");

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
	},
);
