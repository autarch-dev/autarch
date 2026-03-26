import {
	BedrockClient,
	type InferenceProfileSummary,
	ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export interface BedrockModel {
	/** Inference profile ID, e.g. "us.anthropic.claude-sonnet-4-5-v1" */
	modelId: string;
	/** Human-readable name, e.g. "Anthropic - Claude Sonnet 4.5 (AWS)" */
	label: string;
	/** Description from the inference profile */
	providerName: string;
}

/**
 * List system-defined inference profiles available in the configured Bedrock region.
 * These are the cross-region profile IDs that work with on-demand throughput
 * (raw foundation model IDs do not).
 */
export async function listBedrockModels(): Promise<BedrockModel[]> {
	const client = new BedrockClient({
		region: "us-east-1",
		credentials: fromNodeProviderChain(),
	});

	const profiles: InferenceProfileSummary[] = [];
	let nextToken: string | undefined;

	do {
		const command = new ListInferenceProfilesCommand({
			typeEquals: "SYSTEM_DEFINED",
			maxResults: 1000,
			nextToken,
		});
		const response = await client.send(command);
		profiles.push(...(response.inferenceProfileSummaries ?? []));
		nextToken = response.nextToken;
	} while (nextToken);

	return profiles
		.flatMap((p) => {
			if (!p.inferenceProfileId || !p.inferenceProfileName) return [];
			// Extract provider prefix from the profile ID (e.g. "us.anthropic.claude-..." -> "Anthropic")
			const provider = extractProvider(p.inferenceProfileId);
			return [
				{
					modelId: p.inferenceProfileId,
					label: `${provider} - ${p.inferenceProfileName} (AWS)`,
					providerName: provider,
				},
			];
		})
		.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Extract a human-readable provider name from an inference profile ID.
 * e.g. "us.anthropic.claude-sonnet-4-5-v1" -> "Anthropic"
 */
function extractProvider(profileId: string): string {
	// Profile IDs look like "us.anthropic.claude-..." or "us.amazon.nova-..."
	const parts = profileId.split(".");
	const raw = parts.length >= 2 ? parts[1] : parts[0];
	if (!raw) return "Unknown";
	return raw.charAt(0).toUpperCase() + raw.slice(1);
}
