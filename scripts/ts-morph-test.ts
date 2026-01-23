import { Project } from "ts-morph";

console.time("Project creation");
const project = new Project({
	tsConfigFilePath: "tsconfig.json",
});
console.timeEnd("Project creation");

// Get all source files
console.time("Get all source files");
const sourceFiles = project.getSourceFiles();
console.timeEnd("Get all source files");
// console.log(sourceFiles.map(file => file.getFilePath()));

console.time("Resolve");
project.resolveSourceFileDependencies();
console.timeEnd("Resolve");
