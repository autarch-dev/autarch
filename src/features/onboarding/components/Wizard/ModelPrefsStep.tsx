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
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCustomProviders } from "@/features/settings/hooks/useCustomProviders";
import {
	type AIProvider,
	ALL_MODELS,
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelPreferences,
	RECOMMENDED_MODELS,
	SCENARIOS,
} from "@/shared/schemas";
import { useOnboarding } from "../../hooks/useOnboarding";
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
	const { providers, modelsByProvider, loadProviders } = useCustomProviders();

	const [localPrefs, setLocalPrefs] = useState<ModelPreferences>({});
	const [hasInitializedDefaults, setHasInitializedDefaults] = useState(false);

	useEffect(() => {
		loadModelPreferences();
		loadProviders();
		if (!apiKeysStatus) {
			loadApiKeysStatus();
		}
	}, [loadModelPreferences, loadApiKeysStatus, loadProviders, apiKeysStatus]);

	// Filter built-in models to only show those from providers with configured API keys
	const builtInModels = useMemo(() => {
		if (!apiKeysStatus) return [];
		return ALL_MODELS.filter((model) => apiKeysStatus[model.provider]);
	}, [apiKeysStatus]);

	// Custom model options from configured providers
	const customModelOptions = useMemo(() => {
		if (!apiKeysStatus?.customProviders) return [];
		const options: { value: string; label: string; providerLabel: string }[] =
			[];
		for (const provider of providers) {
			if (!apiKeysStatus.customProviders[provider.id]) continue;
			const models = modelsByProvider[provider.id] ?? [];
			for (const model of models) {
				options.push({
					value: model.id,
					label: model.label,
					providerLabel: provider.label,
				});
			}
		}
		return options;
	}, [apiKeysStatus, providers, modelsByProvider]);

	const availableModels = useMemo(
		() => [
			...builtInModels.map((m) => ({ value: m.value, label: m.label })),
			...customModelOptions.map((m) => ({
				value: m.value,
				label: `${m.label} (${m.providerLabel})`,
			})),
		],
		[builtInModels, customModelOptions],
	);

	const hasCustomModels = customModelOptions.length > 0;

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
							<SelectContent className="max-h-[300px]">
								{hasCustomModels ? (
									<>
										<SelectGroup>
											<SelectLabel className="text-xs text-muted-foreground">
												Built-in
											</SelectLabel>
											{builtInModels.map((model) => (
												<SelectItem key={model.value} value={model.value}>
													{model.label}
												</SelectItem>
											))}
										</SelectGroup>
										{(() => {
											const byProvider = new Map<
												string,
												typeof customModelOptions
											>();
											for (const opt of customModelOptions) {
												const existing =
													byProvider.get(opt.providerLabel) ?? [];
												existing.push(opt);
												byProvider.set(opt.providerLabel, existing);
											}
											return Array.from(byProvider.entries()).map(
												([providerLabel, models]) => (
													<SelectGroup key={providerLabel}>
														<SelectLabel className="text-xs text-muted-foreground">
															{providerLabel}
														</SelectLabel>
														{models.map((model) => (
															<SelectItem key={model.value} value={model.value}>
																{model.label}
															</SelectItem>
														))}
													</SelectGroup>
												),
											);
										})()}
									</>
								) : (
									availableModels.map((model) => (
										<SelectItem key={model.value} value={model.value}>
											{model.label}
										</SelectItem>
									))
								)}
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
