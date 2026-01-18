import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AI_PROVIDER_LABELS, AIProvider } from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

const PROVIDERS = AIProvider.options;

interface ApiKeyRowProps {
	provider: (typeof PROVIDERS)[number];
	isConfigured: boolean;
	onSave: (key: string) => Promise<void>;
	onClear: () => Promise<void>;
	disabled: boolean;
}

function ApiKeyRow({
	provider,
	isConfigured,
	onSave,
	onClear,
	disabled,
}: ApiKeyRowProps) {
	const [value, setValue] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const label = AI_PROVIDER_LABELS[provider];

	const handleSave = async () => {
		if (!value.trim()) return;
		setIsSaving(true);
		try {
			await onSave(value.trim());
			setValue("");
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	const handleClear = async () => {
		setIsSaving(true);
		try {
			await onClear();
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setValue("");
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<div className="group py-3 space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-zinc-200">{label}</span>
				</div>
				<div className="flex gap-2">
					<Input
						type="password"
						placeholder={`Enter ${label} API key`}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						disabled={disabled || isSaving}
						className="flex-1 bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter" && value.trim()) handleSave();
							if (e.key === "Escape") handleCancel();
						}}
					/>
					<Button
						size="sm"
						onClick={handleSave}
						disabled={disabled || isSaving || !value.trim()}
						className="bg-emerald-600 hover:bg-emerald-500 text-white"
					>
						{isSaving ? "..." : "Save"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={handleCancel}
						disabled={isSaving}
						className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="group flex items-center justify-between py-3">
			<div className="flex items-center gap-3">
				<div
					className={cn(
						"flex items-center justify-center w-5 h-5 rounded-full",
						isConfigured ? "bg-emerald-500/20" : "bg-zinc-800",
					)}
				>
					{isConfigured ? (
						<Check className="w-3 h-3 text-emerald-400" />
					) : (
						<X className="w-3 h-3 text-zinc-600" />
					)}
				</div>
				<span className="text-sm font-medium text-zinc-200">{label}</span>
			</div>
			<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
				{isConfigured ? (
					<Button
						size="sm"
						variant="ghost"
						onClick={handleClear}
						disabled={disabled || isSaving}
						className="h-7 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
					>
						Remove
					</Button>
				) : null}
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setIsEditing(true)}
					disabled={disabled}
					className="h-7 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
				>
					{isConfigured ? "Update" : "Configure"}
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

	const configuredCount =
		apiKeysStatus ?
			Object.values(apiKeysStatus).filter(Boolean).length
		:	0;

	return (
		<section>
			<div className="flex items-baseline justify-between mb-4">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
					AI Providers
				</h3>
				<span className="text-xs text-zinc-600">
					{configuredCount} of {PROVIDERS.length} configured
				</span>
			</div>
			<div className="divide-y divide-zinc-800/50">
				{PROVIDERS.map((provider) => (
					<ApiKeyRow
						key={provider}
						provider={provider}
						isConfigured={apiKeysStatus?.[provider] ?? false}
						onSave={(key) => handleSaveKey(provider, key)}
						onClear={() => handleClearKey(provider)}
						disabled={isLoading}
					/>
				))}
			</div>
		</section>
	);
}
