import tailwindPlugin from "bun-plugin-tailwind";

const targets = [
	{
		name: "linux-arm64",
		target: "bun-linux-arm64",
		binary: "autarch",
	},
	{ name: "linux-x64", target: "bun-linux-x64", binary: "autarch" },
	{ name: "darwin-arm64", target: "bun-darwin-arm64", binary: "autarch" },
	{ name: "darwin-x64", target: "bun-darwin-x64", binary: "autarch" },
	{ name: "windows-x64", target: "bun-windows-x64", binary: "autarch.exe" },
] satisfies { name: string; target: Bun.Build.Target; binary: string }[];

for (const target of targets) {
	await Bun.build({
		entrypoints: ["./src/backend/index.ts"],
		minify: true,
		// bytecode: true,
		compile: {
			outfile: `./dist/${target.name}/${target.binary}`,
			target: target.target,
		},
		plugins: [tailwindPlugin],
	});
}
