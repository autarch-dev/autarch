import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
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
	ALL_MODELS,
	SCENARIOS,
} from "@/features/onboarding/components/Wizard/models";
import {
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelScenario,
} from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

export function ModelPreferencesSection() {
	const {
		apiKeysStatus,
		loadApiKeysStatus,
		modelPreferences,
		loadModelPreferences,
		saveModelPreferences,
		isLoading,
	} = useSettings();

	// Load data on mount
	useEffect(() => {
		loadModelPreferences();
		if (!apiKeysStatus) {
			loadApiKeysStatus();
		}
	}, [loadModelPreferences, loadApiKeysStatus, apiKeysStatus]);

	// Filter models to only show those from providers with configured API keys
	const availableModels = useMemo(() => {
		if (!apiKeysStatus) return [];
		return ALL_MODELS.filter((model) => apiKeysStatus[model.provider]);
	}, [apiKeysStatus]);

	// Handle model selection change - auto-save
	const handleChange = async (scenario: ModelScenario, value: string) => {
		const updatedPrefs = {
			...modelPreferences,
			[scenario]: value,
		};
		await saveModelPreferences(updatedPrefs);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-xl">
					<SlidersHorizontal className="h-5 w-5" />
					Model Preferences
				</CardTitle>
				<CardDescription>
					Choose which AI model to use for each agent. Changes are saved
					automatically.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{SCENARIOS.map((scenario) => (
					<div key={scenario} className="space-y-2">
						<Label htmlFor={`model-${scenario}`}>
							{MODEL_SCENARIO_LABELS[scenario]}
						</Label>
						<p className="text-xs text-muted-foreground">
							{MODEL_SCENARIO_DESCRIPTIONS[scenario]}
						</p>
						<Select
							value={modelPreferences?.[scenario] ?? ""}
							onValueChange={(value) => handleChange(scenario, value)}
							disabled={isLoading || availableModels.length === 0}
						>
							<SelectTrigger id={`model-${scenario}`} className="w-full">
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
				{availableModels.length === 0 && !isLoading && (
					<p className="text-sm text-amber-600 dark:text-amber-400">
						No models available. Configure at least one API key above.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
