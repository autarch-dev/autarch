import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AgentBackend } from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

export function AgentBackendSection() {
	const { agentBackend, loadAgentBackend, saveAgentBackend } = useSettings();

	useEffect(() => {
		loadAgentBackend();
	}, [loadAgentBackend]);

	const handleChange = async (value: string) => {
		try {
			await saveAgentBackend(value as AgentBackend);
		} catch {
			// Error is already set in the store
		}
	};

	return (
		<section>
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Agent Backend
			</h3>
			<p className="text-xs text-zinc-500 mb-4">
				Choose how Autarch runs its AI agents. This setting takes effect for new
				workflows.
			</p>
			<RadioGroup
				value={agentBackend ?? "api"}
				onValueChange={handleChange}
				className="space-y-3"
			>
				<div className="flex items-start space-x-3 rounded-md border border-zinc-800 p-3">
					<RadioGroupItem value="api" id="backend-api" className="mt-0.5" />
					<div>
						<Label htmlFor="backend-api" className="text-zinc-200 font-medium">
							API
						</Label>
						<p className="text-xs text-zinc-500 mt-0.5">
							Autarch calls LLM providers directly via API. Requires API keys.
							Pay per token.
						</p>
					</div>
				</div>
				<div className="flex items-start space-x-3 rounded-md border border-zinc-800 p-3">
					<RadioGroupItem
						value="claude-code"
						id="backend-claude-code"
						className="mt-0.5"
					/>
					<div>
						<Label
							htmlFor="backend-claude-code"
							className="text-zinc-200 font-medium"
						>
							Claude Code
						</Label>
						<p className="text-xs text-zinc-500 mt-0.5">
							Autarch delegates to a locally installed Claude Code CLI. Requires
							an active Claude Code subscription.
						</p>
					</div>
				</div>
			</RadioGroup>
		</section>
	);
}
