import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AI_PROVIDER_LABELS, AIProvider } from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

const PROVIDERS = AIProvider.options;

interface ApiKeyInputProps {
	provider: (typeof PROVIDERS)[number];
	isConfigured: boolean;
	onSave: (key: string) => Promise<void>;
	onClear: () => Promise<void>;
	isSaving: boolean;
}

function ApiKeyInput({
	provider,
	isConfigured,
	onSave,
	onClear,
	isSaving,
}: ApiKeyInputProps) {
	const [value, setValue] = useState("");
	const [localSaving, setLocalSaving] = useState(false);
	const [localClearing, setLocalClearing] = useState(false);

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

	const handleClear = async () => {
		setLocalClearing(true);
		try {
			await onClear();
		} finally {
			setLocalClearing(false);
		}
	};

	const label = AI_PROVIDER_LABELS[provider];
	const isDisabled = isSaving || localSaving || localClearing;

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
				<Button
					variant="outline"
					onClick={handleClear}
					disabled={isDisabled || !isConfigured}
				>
					{localClearing ? "Clearing..." : "Clear"}
				</Button>
			</div>
		</div>
	);
}

export function ApiProviderKeysSection() {
	const { apiKeysStatus, saveApiKey, clearApiKey, isLoading } = useSettings();

	const handleSaveKey = async (
		provider: (typeof PROVIDERS)[number],
		key: string,
	) => {
		await saveApiKey(provider, key);
	};

	const handleClearKey = async (provider: (typeof PROVIDERS)[number]) => {
		await clearApiKey(provider);
	};

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">AI Provider API Keys</h3>
				<p className="text-sm text-muted-foreground">
					Configure API keys for AI providers. At least one key is required.
				</p>
			</div>
			<div className="space-y-4">
				{PROVIDERS.map((provider) => (
					<ApiKeyInput
						key={provider}
						provider={provider}
						isConfigured={apiKeysStatus?.[provider] ?? false}
						onSave={(key) => handleSaveKey(provider, key)}
						onClear={() => handleClearKey(provider)}
						isSaving={isLoading}
					/>
				))}
			</div>
		</div>
	);
}
