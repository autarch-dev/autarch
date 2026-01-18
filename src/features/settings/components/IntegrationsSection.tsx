import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSettings } from "../hooks/useSettings";

interface IntegrationRowProps {
	name: string;
	description: string;
	isConfigured: boolean;
	onSave: (key: string) => Promise<void>;
	onClear: () => Promise<void>;
	disabled: boolean;
}

function IntegrationRow({
	name,
	description,
	isConfigured,
	onSave,
	onClear,
	disabled,
}: IntegrationRowProps) {
	const [value, setValue] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

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
					<div>
						<span className="text-sm font-medium text-zinc-200">{name}</span>
						<p className="text-xs text-zinc-500">{description}</p>
					</div>
				</div>
				<div className="flex gap-2">
					<Input
						type="password"
						placeholder={`Enter ${name} API key`}
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
				<div>
					<span className="text-sm font-medium text-zinc-200">{name}</span>
					<p className="text-xs text-zinc-500">{description}</p>
				</div>
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

export function IntegrationsSection() {
	const {
		integrationsStatus,
		saveIntegrationKey,
		clearIntegrationKey,
		isLoading,
	} = useSettings();

	return (
		<section className="pt-6 border-t border-zinc-800/50">
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Integrations
			</h3>
			<div className="divide-y divide-zinc-800/50">
				<IntegrationRow
					name="Exa"
					description="Web code search"
					isConfigured={integrationsStatus?.exa ?? false}
					onSave={saveIntegrationKey}
					onClear={clearIntegrationKey}
					disabled={isLoading}
				/>
			</div>
		</section>
	);
}
