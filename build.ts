import tailwindPlugin from "bun-plugin-tailwind";

await Bun.build({
	entrypoints: ["./src/index.ts"],
	minify: true,
	bytecode: true,
	compile: {
		outfile: "./dist/autarch",
	},
	plugins: [tailwindPlugin],
});
