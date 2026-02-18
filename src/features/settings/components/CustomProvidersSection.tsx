import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
	CustomModel,
	CustomProvider,
} from "@/shared/schemas/custom-providers";
import { useCustomProviders } from "../hooks/useCustomProviders";
import { useSettings } from "../hooks/useSettings";

// =============================================================================
// Add Provider Form
// =============================================================================

function AddProviderForm({ onClose }: { onClose: () => void }) {
	const { addProvider } = useCustomProviders();
	const { loadApiKeysStatus } = useSettings();
	const [id, setId] = useState("");
	const [label, setLabel] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);
		if (!id.trim() || !label.trim() || !baseUrl.trim()) return;

		setIsSaving(true);
		try {
			await addProvider({
				id: id.trim(),
				label: label.trim(),
				baseUrl: baseUrl.trim(),
			});
			await loadApiKeysStatus();
			onClose();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create provider",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-zinc-200">
					New Custom Provider
				</span>
				<Button
					size="sm"
					variant="ghost"
					onClick={onClose}
					className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
				>
					<X className="w-4 h-4" />
				</Button>
			</div>
			<div className="space-y-2">
				<div>
					<Label className="text-xs text-zinc-400">Slug (ID)</Label>
					<Input
						placeholder="e.g. together-ai"
						value={id}
						onChange={(e) =>
							setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
						}
						className="mt-1 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">Display Name</Label>
					<Input
						placeholder="e.g. Together AI"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className="mt-1 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">Base URL</Label>
					<Input
						placeholder="e.g. https://api.together.xyz/v1"
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
						className="mt-1 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
			</div>
			{error && <p className="text-xs text-red-400">{error}</p>}
			<div className="flex gap-2 justify-end">
				<Button
					size="sm"
					variant="ghost"
					onClick={onClose}
					className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
				>
					Cancel
				</Button>
				<Button
					size="sm"
					onClick={handleSubmit}
					disabled={isSaving || !id.trim() || !label.trim() || !baseUrl.trim()}
					className="bg-emerald-600 hover:bg-emerald-500 text-white"
				>
					{isSaving ? "Creating..." : "Create Provider"}
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Add Model Form
// =============================================================================

function AddModelForm({
	providerId,
	onClose,
}: {
	providerId: string;
	onClose: () => void;
}) {
	const { addModel } = useCustomProviders();
	const [modelName, setModelName] = useState("");
	const [label, setLabel] = useState("");
	const [promptCost, setPromptCost] = useState("");
	const [completionCost, setCompletionCost] = useState("");
	const [cacheReadCost, setCacheReadCost] = useState("");
	const [cacheWriteCost, setCacheWriteCost] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setError(null);
		if (!modelName.trim() || !label.trim()) return;

		const prompt = Number.parseFloat(promptCost);
		const completion = Number.parseFloat(completionCost);
		if (Number.isNaN(prompt) || Number.isNaN(completion)) {
			setError("Prompt and completion costs must be valid numbers");
			return;
		}

		setIsSaving(true);
		try {
			await addModel(providerId, {
				modelName: modelName.trim(),
				label: label.trim(),
				promptTokenCost: prompt,
				completionTokenCost: completion,
				cacheReadCost: cacheReadCost
					? Number.parseFloat(cacheReadCost)
					: undefined,
				cacheWriteCost: cacheWriteCost
					? Number.parseFloat(cacheWriteCost)
					: undefined,
			});
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create model");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 space-y-3 ml-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-zinc-300">New Model</span>
				<Button
					size="sm"
					variant="ghost"
					onClick={onClose}
					className="h-5 w-5 p-0 text-zinc-400 hover:text-zinc-200"
				>
					<X className="w-3 h-3" />
				</Button>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<div className="col-span-2">
					<Label className="text-xs text-zinc-400">
						Model ID (sent to API)
					</Label>
					<Input
						placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct-Turbo"
						value={modelName}
						onChange={(e) => setModelName(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div className="col-span-2">
					<Label className="text-xs text-zinc-400">Display Name</Label>
					<Input
						placeholder="e.g. Llama 3.3 70B"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">Prompt $/1M tokens</Label>
					<Input
						type="number"
						step="0.01"
						placeholder="0.00"
						value={promptCost}
						onChange={(e) => setPromptCost(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">
						Completion $/1M tokens
					</Label>
					<Input
						type="number"
						step="0.01"
						placeholder="0.00"
						value={completionCost}
						onChange={(e) => setCompletionCost(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">
						Cache Read $/1M (optional)
					</Label>
					<Input
						type="number"
						step="0.01"
						placeholder="—"
						value={cacheReadCost}
						onChange={(e) => setCacheReadCost(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
				<div>
					<Label className="text-xs text-zinc-400">
						Cache Write $/1M (optional)
					</Label>
					<Input
						type="number"
						step="0.01"
						placeholder="—"
						value={cacheWriteCost}
						onChange={(e) => setCacheWriteCost(e.target.value)}
						className="mt-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
					/>
				</div>
			</div>
			{error && <p className="text-xs text-red-400">{error}</p>}
			<div className="flex gap-2 justify-end">
				<Button
					size="sm"
					variant="ghost"
					onClick={onClose}
					className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
				>
					Cancel
				</Button>
				<Button
					size="sm"
					onClick={handleSubmit}
					disabled={
						isSaving ||
						!modelName.trim() ||
						!label.trim() ||
						!promptCost ||
						!completionCost
					}
					className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
				>
					{isSaving ? "Adding..." : "Add Model"}
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Model Row
// =============================================================================

function CustomModelRow({
	model,
	providerId,
}: {
	model: CustomModel;
	providerId: string;
}) {
	const { removeModel } = useCustomProviders();
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await removeModel(model.id, providerId);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="group flex items-center justify-between py-2 px-3 ml-4 rounded hover:bg-zinc-800/30">
			<div className="min-w-0 flex-1">
				<div className="text-xs font-medium text-zinc-300 truncate">
					{model.label}
				</div>
				<div className="text-[11px] text-zinc-500 truncate font-mono">
					{model.modelName}
				</div>
				<div className="text-[11px] text-zinc-600">
					${model.promptTokenCost}/M in &middot; ${model.completionTokenCost}/M
					out
				</div>
			</div>
			<Button
				size="sm"
				variant="ghost"
				onClick={handleDelete}
				disabled={isDeleting}
				className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
			>
				<Trash2 className="w-3 h-3" />
			</Button>
		</div>
	);
}

// =============================================================================
// Provider Row (expandable)
// =============================================================================

function ProviderRow({ provider }: { provider: CustomProvider }) {
	const {
		modelsByProvider,
		removeProvider,
		saveProviderApiKey,
		clearProviderApiKey,
	} = useCustomProviders();
	const { apiKeysStatus, loadApiKeysStatus } = useSettings();
	const [isExpanded, setIsExpanded] = useState(false);
	const [showAddModel, setShowAddModel] = useState(false);
	const [isEditingKey, setIsEditingKey] = useState(false);
	const [apiKeyValue, setApiKeyValue] = useState("");
	const [isSavingKey, setIsSavingKey] = useState(false);

	const models = modelsByProvider[provider.id] ?? [];
	const isKeyConfigured =
		apiKeysStatus?.customProviders?.[provider.id] ?? false;

	const handleSaveKey = async () => {
		if (!apiKeyValue.trim()) return;
		setIsSavingKey(true);
		try {
			await saveProviderApiKey(provider.id, apiKeyValue.trim());
			await loadApiKeysStatus();
			setApiKeyValue("");
			setIsEditingKey(false);
		} finally {
			setIsSavingKey(false);
		}
	};

	const handleClearKey = async () => {
		setIsSavingKey(true);
		try {
			await clearProviderApiKey(provider.id);
			await loadApiKeysStatus();
		} finally {
			setIsSavingKey(false);
		}
	};

	const handleDelete = async () => {
		await removeProvider(provider.id);
		await loadApiKeysStatus();
	};

	return (
		<div className="border border-zinc-800/50 rounded-lg overflow-hidden">
			{/* Provider header */}
			<button
				type="button"
				className="flex items-center gap-2 px-3 py-2.5 w-full text-left cursor-pointer hover:bg-zinc-800/30 transition-colors"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				{isExpanded ? (
					<ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
				) : (
					<ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
				)}
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium text-zinc-200">
						{provider.label}
					</div>
					<div className="text-[11px] text-zinc-500 truncate">
						{provider.baseUrl}
					</div>
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					<span className="text-[11px] text-zinc-600">
						{models.length} model{models.length !== 1 ? "s" : ""}
					</span>
					<div
						className={`w-2 h-2 rounded-full ${isKeyConfigured ? "bg-emerald-500" : "bg-zinc-700"}`}
					/>
				</div>
			</button>

			{/* Expanded content */}
			{isExpanded && (
				<div className="border-t border-zinc-800/50 px-3 py-3 space-y-3">
					{/* API key section */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-400">API Key</span>
							<div className="flex items-center gap-1">
								{isKeyConfigured && (
									<Button
										size="sm"
										variant="ghost"
										onClick={handleClearKey}
										disabled={isSavingKey}
										className="h-6 text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
									>
										Remove
									</Button>
								)}
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setIsEditingKey(!isEditingKey)}
									className="h-6 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
								>
									{isKeyConfigured ? "Update" : "Configure"}
								</Button>
							</div>
						</div>
						{isEditingKey && (
							<div className="flex gap-2">
								<Input
									type="password"
									placeholder="Enter API key"
									value={apiKeyValue}
									onChange={(e) => setApiKeyValue(e.target.value)}
									className="flex-1 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter" && apiKeyValue.trim())
											handleSaveKey();
										if (e.key === "Escape") setIsEditingKey(false);
									}}
								/>
								<Button
									size="sm"
									onClick={handleSaveKey}
									disabled={isSavingKey || !apiKeyValue.trim()}
									className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
								>
									Save
								</Button>
							</div>
						)}
					</div>

					{/* Models list */}
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-400">Models</span>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setShowAddModel(!showAddModel)}
								className="h-6 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
							>
								<Plus className="w-3 h-3 mr-1" />
								Add Model
							</Button>
						</div>

						{models.length === 0 && !showAddModel && (
							<p className="text-xs text-zinc-600 py-2 ml-4">
								No models configured. Add one to use this provider.
							</p>
						)}

						{models.map((model) => (
							<CustomModelRow
								key={model.id}
								model={model}
								providerId={provider.id}
							/>
						))}

						{showAddModel && (
							<AddModelForm
								providerId={provider.id}
								onClose={() => setShowAddModel(false)}
							/>
						)}
					</div>

					{/* Delete provider */}
					<div className="pt-2 border-t border-zinc-800/30">
						<Button
							size="sm"
							variant="ghost"
							onClick={handleDelete}
							className="h-7 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
						>
							<Trash2 className="w-3 h-3 mr-1" />
							Delete Provider
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Main Section
// =============================================================================

export function CustomProvidersSection() {
	const { providers, loadProviders, isLoading } = useCustomProviders();
	const [showAddForm, setShowAddForm] = useState(false);

	useEffect(() => {
		loadProviders();
	}, [loadProviders]);

	return (
		<section>
			<div className="flex items-baseline justify-between mb-4">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
					Custom Providers
				</h3>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setShowAddForm(!showAddForm)}
					className="h-7 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
				>
					<Plus className="w-3 h-3 mr-1" />
					Add Provider
				</Button>
			</div>

			<div className="space-y-2">
				{showAddForm && (
					<AddProviderForm onClose={() => setShowAddForm(false)} />
				)}

				{providers.map((provider) => (
					<ProviderRow key={provider.id} provider={provider} />
				))}

				{providers.length === 0 && !showAddForm && !isLoading && (
					<p className="text-xs text-zinc-600 py-4 text-center">
						No custom providers configured. Add one to use services like
						Together AI, Fireworks, or Groq.
					</p>
				)}
			</div>
		</section>
	);
}
