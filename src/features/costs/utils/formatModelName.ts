/**
 * Extract a short display name from a full model ID string.
 * e.g. "claude-sonnet-4-5-20250514" → "Sonnet 4.5"
 *      "claude-opus-4-6" → "Opus 4.6"
 *      "claude-haiku-4-5" → "Haiku 4.5"
 */
export function shortModelName(modelId: string): string {
	// Try to match claude-{variant}-{major}-{minor} pattern
	const match = modelId.match(/claude-(\w+)-(\d+)-(\d+)/);
	if (match?.[1] && match[2] && match[3]) {
		const variant = match[1].charAt(0).toUpperCase() + match[1].slice(1);
		return `${variant} ${match[2]}.${match[3]}`;
	}
	return modelId;
}
