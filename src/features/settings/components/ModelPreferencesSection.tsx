import { useEffect, useMemo } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ALL_MODELS,
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelScenario,
} from "@/shared/schemas";
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
					availableModels={availableModels}
					onChange={(value) => handleChange("basic", value)}
					disabled={isLoading}
				/>

				<div className="border-t border-zinc-800/50" />

				{/* Discussion Channels */}
				<ModelRow
					scenario="discussion"
					value={modelPreferences?.discussion}
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
	availableModels: { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled: boolean;
}

function ModelRow({
	scenario,
	value,
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
					<SelectTrigger className="w-[180px] h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-500 [&>span]:truncate">
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent className="bg-zinc-900 border-zinc-700">
						{availableModels.map((model) => (
							<SelectItem
								key={model.value}
								value={model.value}
								className="text-xs text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
							>
								{model.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
