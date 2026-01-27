import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import temp from "temp";

// Enable automatic cleanup of temp directories when the process exits
temp.track();

export function scaffoldTypescriptProject() {
	const tempDir = temp.mkdirSync();
	mkdirSync(path.join(tempDir, "src"), { recursive: true });

	copyFileSync(
		path.join(__dirname, "tsconfig.json"),
		path.join(tempDir, "tsconfig.json"),
	);
	copyFileSync(
		path.join(__dirname, "symbols.ts"),
		path.join(tempDir, "src", "symbols.ts"),
	);

	return tempDir;
}
