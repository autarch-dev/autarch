import { useEffect, useMemo } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ALL_MODELS,
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelScenario,
} from "@/shared/schemas";
import { useCustomProviders } from "../hooks/useCustomProviders";
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
	const { providers, modelsByProvider, loadProviders } = useCustomProviders();

	// Load data on mount
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

	// Build custom model options from providers that have API keys configured
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

	// Handle model selection change - auto-save
	const handleChange = async (scenario: ModelScenario, value: string) => {
		const updatedPrefs = {
			...modelPreferences,
			[scenario]: value,
		};
		await saveModelPreferences(updatedPrefs);
	};

	if (availableModels.length === 0 && !isLoading) {
		return (
			<section>
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
					Model Preferences
				</h3>
				<div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
					<p className="text-sm text-amber-400">
						Configure at least one API key to select models.
					</p>
				</div>
			</section>
		);
	}

	const workflowScenarios: ModelScenario[] = [
		"scoping",
		"research",
		"planning",
		"execution",
		"review",
		"roadmap_planning",
	];

	return (
		<section>
			<div className="mb-6">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-1">
					Model Preferences
				</h3>
				<p className="text-xs text-zinc-600">
					Choose which model to use for each agent type
				</p>
			</div>

			<div className="space-y-6">
				{/* Basic Tasks */}
				<ModelRow
					scenario="basic"
					value={modelPreferences?.basic}
					builtInModels={builtInModels}
					customModelOptions={customModelOptions}
					hasCustomModels={hasCustomModels}
					availableModels={availableModels}
					onChange={(value) => handleChange("basic", value)}
					disabled={isLoading}
				/>

				<div className="border-t border-zinc-800/50" />

				{/* Discussion Channels */}
				<ModelRow
					scenario="discussion"
					value={modelPreferences?.discussion}
					builtInModels={builtInModels}
					customModelOptions={customModelOptions}
					hasCustomModels={hasCustomModels}
					availableModels={availableModels}
					onChange={(value) => handleChange("discussion", value)}
					disabled={isLoading}
				/>

				<div className="border-t border-zinc-800/50" />

				{/* Workflow Agents */}
				<div className="space-y-4">
					<p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
						Workflow Agents
					</p>
					{workflowScenarios.map((scenario) => (
						<ModelRow
							key={scenario}
							scenario={scenario}
							value={modelPreferences?.[scenario]}
							builtInModels={builtInModels}
							customModelOptions={customModelOptions}
							hasCustomModels={hasCustomModels}
							availableModels={availableModels}
							onChange={(value) => handleChange(scenario, value)}
							disabled={isLoading}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

interface ModelRowProps {
	scenario: ModelScenario;
	value?: string;
	builtInModels: { value: string; label: string }[];
	customModelOptions: { value: string; label: string; providerLabel: string }[];
	hasCustomModels: boolean;
	availableModels: { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled: boolean;
}

function ModelRow({
	scenario,
	value,
	builtInModels,
	customModelOptions,
	hasCustomModels,
	availableModels,
	onChange,
	disabled,
}: ModelRowProps) {
	return (
		<div className="group">
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium text-zinc-200">
						{MODEL_SCENARIO_LABELS[scenario]}
					</div>
					<div className="text-xs text-zinc-500">
						{MODEL_SCENARIO_DESCRIPTIONS[scenario]}
					</div>
				</div>
				<Select
					value={value ?? ""}
					onValueChange={onChange}
					disabled={disabled || availableModels.length === 0}
				>
					<SelectTrigger className="w-[220px] h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-500 [&>span]:truncate">
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent className="bg-zinc-900 border-zinc-700 max-h-[300px]">
						{hasCustomModels ? (
							<>
								<SelectGroup>
									<SelectLabel className="text-[11px] text-zinc-500">
										Built-in
									</SelectLabel>
									{builtInModels.map((model) => (
										<SelectItem
											key={model.value}
											value={model.value}
											className="text-xs text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
										>
											{model.label}
										</SelectItem>
									))}
								</SelectGroup>
								{/* Group custom models by provider */}
								{(() => {
									const byProvider = new Map<
										string,
										typeof customModelOptions
									>();
									for (const opt of customModelOptions) {
										const existing = byProvider.get(opt.providerLabel) ?? [];
										existing.push(opt);
										byProvider.set(opt.providerLabel, existing);
									}
									return Array.from(byProvider.entries()).map(
										([providerLabel, models]) => (
											<SelectGroup key={providerLabel}>
												<SelectLabel className="text-[11px] text-zinc-500">
													{providerLabel}
												</SelectLabel>
												{models.map((model) => (
													<SelectItem
														key={model.value}
														value={model.value}
														className="text-xs text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
													>
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
								<SelectItem
									key={model.value}
									value={model.value}
									className="text-xs text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
								>
									{model.label}
								</SelectItem>
							))
						)}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
