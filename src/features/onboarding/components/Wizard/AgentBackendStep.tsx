import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AgentBackend } from "@/shared/schemas/settings";
import { useOnboarding } from "../../hooks/useOnboarding";
import { WizardCard } from "./WizardCard";

export function AgentBackendStep() {
	const {
		nextStep,
		prevStep,
		agentBackend,
		setAgentBackend,
		saveAgentBackend,
		loadAgentBackend,
		isLoading,
	} = useOnboarding();

	useEffect(() => {
		loadAgentBackend();
	}, [loadAgentBackend]);

	const handleContinue = async () => {
		try {
			await saveAgentBackend();
			nextStep();
		} catch {
			// Error is already set in the store
		}
	};

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">
					Choose Your Agent Backend
				</CardTitle>
				<CardDescription>How should Autarch run its AI agents?</CardDescription>
			</CardHeader>
			<CardContent className="flex-1">
				<RadioGroup
					value={agentBackend}
					onValueChange={(v) => setAgentBackend(v as AgentBackend)}
					className="space-y-4"
				>
					<label
						htmlFor="onboard-backend-api"
						className="flex items-start space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
					>
						<RadioGroupItem
							value="api"
							id="onboard-backend-api"
							className="mt-0.5"
						/>
						<div>
							<Label
								htmlFor="onboard-backend-api"
								className="text-base font-medium cursor-pointer"
							>
								API
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								Autarch calls LLM providers directly. Requires API keys from
								Anthropic, OpenAI, or other providers. Pay per token.
							</p>
						</div>
					</label>
					<label
						htmlFor="onboard-backend-claude-code"
						className="flex items-start space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
					>
						<RadioGroupItem
							value="claude-code"
							id="onboard-backend-claude-code"
							className="mt-0.5"
						/>
						<div>
							<Label
								htmlFor="onboard-backend-claude-code"
								className="text-base font-medium cursor-pointer"
							>
								Claude Code
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								Autarch delegates to a locally installed Claude Code CLI.
								Requires an active Claude Code subscription. Flat monthly cost.
							</p>
						</div>
					</label>
				</RadioGroup>
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button onClick={handleContinue} disabled={isLoading}>
					{isLoading ? "Saving..." : "Continue"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
