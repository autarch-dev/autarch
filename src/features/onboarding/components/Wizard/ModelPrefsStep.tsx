import { useEffect, useMemo, useState } from "react";
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
	type AIProvider,
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelPreferences,
} from "@/shared/schemas/settings";
import { useOnboarding } from "../../hooks/useOnboarding";
import { ALL_MODELS, RECOMMENDED_MODELS, SCENARIOS } from "./models";
import { WizardCard } from "./WizardCard";

export function ModelPrefsStep() {
	const {
		nextStep,
		prevStep,
		modelPreferences,
		loadModelPreferences,
		saveModelPreferences,
		apiKeysStatus,
		loadApiKeysStatus,
		isLoading,
	} = useOnboarding();

	const [localPrefs, setLocalPrefs] = useState<ModelPreferences>({});
	const [hasInitializedDefaults, setHasInitializedDefaults] = useState(false);

	useEffect(() => {
		loadModelPreferences();
		// Ensure API keys status is loaded (may already be cached from previous step)
		if (!apiKeysStatus) {
			loadApiKeysStatus();
		}
	}, [loadModelPreferences, loadApiKeysStatus, apiKeysStatus]);

	// Filter models to only show those from providers with configured API keys
	const availableModels = useMemo(() => {
		if (!apiKeysStatus) return [];
		return ALL_MODELS.filter((model) => apiKeysStatus[model.provider]);
	}, [apiKeysStatus]);

	// Get the first available provider (in priority order)
	const firstAvailableProvider = useMemo((): AIProvider | null => {
		if (!apiKeysStatus) return null;
		const priorityOrder: AIProvider[] = [
			"anthropic",
			"openai",
			"google",
			"xai",
		];
		return priorityOrder.find((p) => apiKeysStatus[p]) ?? null;
	}, [apiKeysStatus]);

	// Initialize with recommended defaults, then merge any saved preferences on top
	useEffect(() => {
		if (hasInitializedDefaults || !firstAvailableProvider || !apiKeysStatus)
			return;

		// Start with recommended defaults for all scenarios
		const defaults: ModelPreferences = {};
		for (const scenario of SCENARIOS) {
			defaults[scenario] = RECOMMENDED_MODELS[scenario][firstAvailableProvider];
		}

		// Merge any existing saved preferences on top (non-empty values only)
		if (modelPreferences) {
			for (const scenario of SCENARIOS) {
				const saved = modelPreferences[scenario];
				if (saved) {
					defaults[scenario] = saved;
				}
			}
		}

		setLocalPrefs(defaults);
		setHasInitializedDefaults(true);
	}, [
		firstAvailableProvider,
		apiKeysStatus,
		hasInitializedDefaults,
		modelPreferences,
	]);

	const handleChange = (
		scenario: (typeof SCENARIOS)[number],
		value: string,
	) => {
		setLocalPrefs((prev) => ({ ...prev, [scenario]: value }));
	};

	// Check if all scenarios have a model selected
	const allScenariosConfigured = useMemo(() => {
		return SCENARIOS.every((scenario) => {
			const value = localPrefs[scenario];
			return value !== undefined && value !== "";
		});
	}, [localPrefs]);

	const handleContinue = async () => {
		await saveModelPreferences(localPrefs);
		nextStep();
	};

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">Model Preferences</CardTitle>
				<CardDescription>
					Choose which AI model to use for each agent. You can change these
					later.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-4 overflow-y-auto">
				{SCENARIOS.map((scenario) => (
					<div key={scenario} className="space-y-2">
						<Label htmlFor={scenario}>{MODEL_SCENARIO_LABELS[scenario]}</Label>
						<p className="text-xs text-muted-foreground">
							{MODEL_SCENARIO_DESCRIPTIONS[scenario]}
						</p>
						<Select
							value={localPrefs[scenario] ?? ""}
							onValueChange={(value) => handleChange(scenario, value)}
						>
							<SelectTrigger id={scenario}>
								<SelectValue placeholder="Select a model" />
							</SelectTrigger>
							<SelectContent>
								{availableModels.map((model) => (
									<SelectItem key={model.value} value={model.value}>
										{model.label}
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
				<Button
					onClick={handleContinue}
					disabled={isLoading || !allScenariosConfigured}
				>
					{isLoading ? "Saving..." : "Continue"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
