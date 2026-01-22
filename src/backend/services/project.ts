import { homedir } from "node:os";
import { basename, join, relative } from "node:path";
import type { BunFile } from "bun";
import type { ProjectInfo } from "@/shared/schemas/project";
import { findRepoRoot } from "../git";
import { isGitIgnored } from "../tools/base/utils";

// =============================================================================
// Icon Finder
// =============================================================================

const ICON_FILENAMES = [
	"favicon.ico",
	"favicon.png",
	"favicon.svg",
	"logo.png",
	"logo.svg",
	"icon.png",
	"icon.svg",
	"app-icon.png",
];

/** Cache the icon path to avoid repeated file system scans */
let cachedIconPath: string | null | undefined;

/**
 * Find a project icon by scanning for common icon filenames.
 * Returns the shallowest match (closest to project root).
 */
export async function findProjectIcon(
	projectRoot: string,
): Promise<string | null> {
	// Return cached result if available
	if (cachedIconPath !== undefined) {
		return cachedIconPath;
	}

	const matches: string[] = [];

	for (const filename of ICON_FILENAMES) {
		const glob = new Bun.Glob(`**/${filename}`);

		for await (const match of glob.scan({
			cwd: projectRoot,
			absolute: true,
			onlyFiles: true,
		})) {
			// Skip node_modules and .git
			if (match.includes("node_modules") || match.includes(".git")) {
				continue;
			}

			const relativePath = relative(projectRoot, match);
			if (await isGitIgnored(projectRoot, relativePath)) {
				continue;
			}

			matches.push(match);
		}
	}

	if (matches.length === 0) {
		cachedIconPath = null;
		return null;
	}

	// Sort by depth (fewest path segments = shallowest), return first
	matches.sort((a, b) => {
		const depthA = relative(projectRoot, a).split("/").length;
		const depthB = relative(projectRoot, b).split("/").length;
		return depthA - depthB;
	});

	cachedIconPath = matches[0] ?? null;
	return cachedIconPath;
}

// =============================================================================
// Project Info
// =============================================================================

/**
 * Get project information for the current working directory.
 */
export async function getProjectInfo(): Promise<ProjectInfo> {
	const projectRoot = findRepoRoot(process.cwd());
	const name = basename(projectRoot);
	const displayPath = projectRoot.replace(homedir(), "~");
	const iconPath = await findProjectIcon(projectRoot);

	return {
		name,
		path: projectRoot,
		displayPath,
		hasIcon: iconPath !== null,
	};
}

/**
 * Get the icon file for the current project, if one exists.
 */
export async function getProjectIconFile(): Promise<BunFile | null> {
	const projectRoot = findRepoRoot(process.cwd());
	const iconPath = await findProjectIcon(projectRoot);

	if (!iconPath) {
		return null;
	}

	return Bun.file(iconPath);
}

/**
 * Get the tsconfig.json path for the current project, if one exists.
 * Returns the shallowest match (closest to project root).
 *
 * @param projectRoot - The root directory of the project
 * @returns The tsconfig.json path, or null if no tsconfig.json is found
 */
export async function getTsconfigPath(
	projectRoot: string,
): Promise<string | null> {
	// Use glob to find tsconfig.json
	const tsConfigPath = new Bun.Glob("**/tsconfig.json").scan({
		cwd: projectRoot,
		absolute: true,
		onlyFiles: true,
	});

	for await (const match of tsConfigPath) {
		if (
			match.includes("node_modules") ||
			match.includes(".git") ||
			match.includes(".autarch")
		) {
			continue;
		}
		if (await isGitIgnored(projectRoot, match)) {
			continue;
		}
		return match;
	}

	return null;
}
