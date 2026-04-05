import { useEffect, useState } from "react";
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
	MODEL_SCENARIO_DESCRIPTIONS,
	MODEL_SCENARIO_LABELS,
	type ModelScenario,
	ModelScenario as ModelScenarioEnum,
} from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

const SCENARIOS = ModelScenarioEnum.options;
const MODELS = ClaudeCodeModelEnum.options;

export function CcModelPreferencesSection() {
	const {
		ccModelPreferences,
		loadCcModelPreferences,
		saveCcModelPreferences,
		isLoading,
	} = useSettings();

	const [localPrefs, setLocalPrefs] = useState<
		Record<string, string | undefined>
	>({});

	useEffect(() => {
		loadCcModelPreferences();
	}, [loadCcModelPreferences]);

	useEffect(() => {
		if (ccModelPreferences) {
			setLocalPrefs(ccModelPreferences);
		}
	}, [ccModelPreferences]);

	const handleChange = async (
		scenario: ModelScenario,
		model: ClaudeCodeModel,
	) => {
		const updated = { ...localPrefs, [scenario]: model };
		setLocalPrefs(updated);
		try {
			await saveCcModelPreferences(updated);
		} catch {
			// Error set in store
		}
	};

	return (
		<section>
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Claude Code Model Preferences
			</h3>
			<p className="text-xs text-zinc-500 mb-4">
				Choose which Claude model to use for each agent role.
			</p>
			<div className="space-y-3">
				{SCENARIOS.map((scenario) => (
					<div key={scenario} className="space-y-1">
						<div className="flex items-baseline justify-between">
							<Label className="text-sm font-medium text-zinc-300">
								{MODEL_SCENARIO_LABELS[scenario]}
							</Label>
							<span className="text-xs text-zinc-500">
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
							<SelectTrigger className="bg-zinc-900 border-zinc-700">
								<SelectValue placeholder="Select a model" />
							</SelectTrigger>
							<SelectContent>
								{MODELS.map((model) => (
									<SelectItem key={model} value={model}>
										{CLAUDE_CODE_MODEL_LABELS[model]} &mdash;{" "}
										<span className="text-muted-foreground">
											{CLAUDE_CODE_MODEL_DESCRIPTIONS[model]}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				))}
			</div>
		</section>
	);
}
