import { Puzzle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "../hooks/useSettings";

interface IntegrationKeyInputProps {
	isConfigured: boolean;
	onSave: (key: string) => Promise<void>;
	onClear: () => Promise<void>;
	isSaving: boolean;
}

function IntegrationKeyInput({
	isConfigured,
	onSave,
	onClear,
	isSaving,
}: IntegrationKeyInputProps) {
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

	const isDisabled = isSaving || localSaving || localClearing;

	return (
		<div className="space-y-2">
			<Label htmlFor="exa">
				Exa
				{isConfigured && (
					<span className="ml-2 text-xs text-green-600 dark:text-green-400">
						(configured)
					</span>
				)}
			</Label>
			<div className="flex gap-2">
				<Input
					id="exa"
					type="password"
					placeholder={isConfigured ? "••••••••" : "Enter Exa API key"}
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

export function IntegrationsSection() {
	const {
		integrationsStatus,
		saveIntegrationKey,
		clearIntegrationKey,
		isLoading,
	} = useSettings();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-xl">
					<Puzzle className="h-5 w-5" />
					Integrations
				</CardTitle>
				<CardDescription>
					Configure API keys for third-party integrations. Exa enables web code
					search capabilities.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<IntegrationKeyInput
					isConfigured={integrationsStatus?.exa ?? false}
					onSave={saveIntegrationKey}
					onClear={clearIntegrationKey}
					isSaving={isLoading}
				/>
			</CardContent>
		</Card>
	);
}
