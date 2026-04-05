import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	CLAUDE_CODE_MODEL_DESCRIPTIONS,
	CLAUDE_CODE_MODEL_LABELS,
	type ClaudeCodeModel,
	ClaudeCodeModel as ClaudeCodeModelEnum,
	type ClaudeCodeModelPreferences,
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelScenario,
	ModelScenario as ModelScenarioEnum,
} from "@/shared/schemas/settings";
import { useOnboarding } from "../../hooks/useOnboarding";
import { WizardCard } from "./WizardCard";

const SCENARIOS = ModelScenarioEnum.options;
const MODELS = ClaudeCodeModelEnum.options;

export function CcModelPrefsStep() {
	const {
		nextStep,
		prevStep,
		ccModelPreferences,
		loadCcModelPreferences,
		saveCcModelPreferences,
		isLoading,
	} = useOnboarding();

	const [localPrefs, setLocalPrefs] = useState<ClaudeCodeModelPreferences>({});

	useEffect(() => {
		loadCcModelPreferences();
	}, [loadCcModelPreferences]);

	useEffect(() => {
		if (ccModelPreferences) {
			setLocalPrefs(ccModelPreferences);
		}
	}, [ccModelPreferences]);

	const handleChange = (scenario: ModelScenario, model: ClaudeCodeModel) => {
		setLocalPrefs((prev) => ({ ...prev, [scenario]: model }));
	};

	const handleContinue = async () => {
		try {
			await saveCcModelPreferences(localPrefs);
			nextStep();
		} catch {
			// Error is already set in the store
		}
	};

	// All scenarios must have a selection
	const allConfigured = SCENARIOS.every(
		(s) => localPrefs[s] && localPrefs[s].length > 0,
	);

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">Model Preferences</CardTitle>
				<CardDescription>
					Choose which Claude model to use for each agent role.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-3 overflow-y-auto">
				{SCENARIOS.map((scenario) => (
					<div key={scenario} className="space-y-1">
						<div className="flex items-baseline justify-between">
							<Label className="text-sm font-medium">
								{MODEL_SCENARIO_LABELS[scenario]}
							</Label>
							<span className="text-xs text-muted-foreground">
								{MODEL_SCENARIO_DESCRIPTIONS[scenario]}
							</span>
						</div>
						<Select
							value={localPrefs[scenario] ?? ""}
							onValueChange={(v) =>
								handleChange(scenario, v as ClaudeCodeModel)
							}
							disabled={isLoading}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a model" />
							</SelectTrigger>
							<SelectContent>
								{MODELS.map((model) => (
									<SelectItem key={model} value={model}>
										<span className="font-medium">
											{CLAUDE_CODE_MODEL_LABELS[model]}
										</span>
										<span className="ml-2 text-xs text-muted-foreground">
											{CLAUDE_CODE_MODEL_DESCRIPTIONS[model]}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				))}
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button onClick={handleContinue} disabled={isLoading || !allConfigured}>
					{isLoading ? "Saving..." : "Continue"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
