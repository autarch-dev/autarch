export function escapeReplacement(str: string): string {
	return str.replace(/\$/g, "$$$$");
}
