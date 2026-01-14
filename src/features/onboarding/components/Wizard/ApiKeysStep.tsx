import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AI_PROVIDER_LABELS, AIProvider } from "@/shared/schemas/settings";
import { useOnboarding } from "../../hooks/useOnboarding";
import { WizardCard } from "./WizardCard";

const PROVIDERS = AIProvider.options;

interface ApiKeyInputProps {
	provider: (typeof PROVIDERS)[number];
	isConfigured: boolean;
	onSave: (key: string) => Promise<void>;
	isSaving: boolean;
}

function ApiKeyInput({
	provider,
	isConfigured,
	onSave,
	isSaving,
}: ApiKeyInputProps) {
	const [value, setValue] = useState("");
	const [localSaving, setLocalSaving] = useState(false);

	const handleSave = async () => {
		if (!value.trim()) return;
		setLocalSaving(true);
		try {
			await onSave(value.trim());
			setValue("");
		} finally {
			setLocalSaving(false);
		}
	};

	const label = AI_PROVIDER_LABELS[provider];
	const isDisabled = isSaving || localSaving;

	return (
		<div className="space-y-2">
			<Label htmlFor={provider}>
				{label}
				{isConfigured && (
					<span className="ml-2 text-xs text-green-600 dark:text-green-400">
						(configured)
					</span>
				)}
			</Label>
			<div className="flex gap-2">
				<Input
					id={provider}
					type="password"
					placeholder={isConfigured ? "••••••••" : `Enter ${label} API key`}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					disabled={isDisabled}
				/>
				<Button
					variant="secondary"
					onClick={handleSave}
					disabled={isDisabled || !value.trim()}
				>
					{localSaving ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	);
}

export function ApiKeysStep() {
	const {
		nextStep,
		prevStep,
		apiKeysStatus,
		loadApiKeysStatus,
		saveApiKey,
		isLoading,
	} = useOnboarding();

	useEffect(() => {
		loadApiKeysStatus();
	}, [loadApiKeysStatus]);

	const handleSaveKey = async (
		provider: (typeof PROVIDERS)[number],
		key: string,
	) => {
		await saveApiKey(provider, key);
	};

	const hasAtLeastOneKey =
		apiKeysStatus &&
		Object.values(apiKeysStatus).some((configured) => configured);

	return (
		<WizardCard>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl font-bold">Configure API Keys</CardTitle>
				<CardDescription>
					Add at least one AI provider to get started. You can add more later.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-4">
				{PROVIDERS.map((provider) => (
					<ApiKeyInput
						key={provider}
						provider={provider}
						isConfigured={apiKeysStatus?.[provider] ?? false}
						onSave={(key) => handleSaveKey(provider, key)}
						isSaving={isLoading}
					/>
				))}
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="outline" onClick={prevStep}>
					Back
				</Button>
				<Button onClick={nextStep} disabled={!hasAtLeastOneKey}>
					{hasAtLeastOneKey ? "Continue" : "Add at least one key"}
				</Button>
			</CardFooter>
		</WizardCard>
	);
}
