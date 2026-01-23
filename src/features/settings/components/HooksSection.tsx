import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { HookOnFailure, PostWriteHook } from "@/shared/schemas/hooks";
import { useSettings } from "../hooks/useSettings";

// =============================================================================
// Types
// =============================================================================

interface HookFormData {
	name: string;
	command: string;
	glob: string;
	cwd: string;
	onFailure: HookOnFailure;
}

const DEFAULT_FORM_DATA: HookFormData = {
	name: "",
	command: "",
	glob: "*",
	cwd: "",
	onFailure: "warn",
};

// =============================================================================
// Hook Row Component
// =============================================================================

interface HookRowProps {
	hook: PostWriteHook;
	index: number;
	total: number;
	onEdit: () => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	disabled: boolean;
}

function HookRow({
	hook,
	index,
	total,
	onEdit,
	onDelete,
	onMoveUp,
	onMoveDown,
	disabled,
}: HookRowProps) {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const truncatedCommand =
		hook.command.length > 40
			? `${hook.command.substring(0, 40)}...`
			: hook.command;

	const handleDelete = () => {
		onDelete();
		setShowDeleteConfirm(false);
	};

	if (showDeleteConfirm) {
		return (
			<div className="group py-3 space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-sm text-zinc-200">Delete "{hook.name}"?</span>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={handleDelete}
							disabled={disabled}
							className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
						>
							Confirm
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowDeleteConfirm(false)}
							disabled={disabled}
							className="h-7 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="group flex items-center justify-between py-3 gap-4">
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
					<Check className="w-3 h-3 text-emerald-400" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium text-zinc-200 truncate">
						{hook.name}
					</div>
					<div className="text-xs text-zinc-500 truncate" title={hook.command}>
						{truncatedCommand}
					</div>
					<div className="text-xs text-zinc-600">
						{hook.glob === "*" ? "all files" : hook.glob}
						{hook.onFailure === "block" && (
							<span className="ml-2 text-amber-500">• blocking</span>
						)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<Button
					size="sm"
					variant="ghost"
					onClick={onMoveUp}
					disabled={disabled || index === 0}
					className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
					title="Move up"
				>
					<ArrowUp className="w-3.5 h-3.5" />
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={onMoveDown}
					disabled={disabled || index === total - 1}
					className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
					title="Move down"
				>
					<ArrowDown className="w-3.5 h-3.5" />
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={onEdit}
					disabled={disabled}
					className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
					title="Edit"
				>
					<Pencil className="w-3.5 h-3.5" />
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setShowDeleteConfirm(true)}
					disabled={disabled}
					className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
					title="Delete"
				>
					<Trash2 className="w-3.5 h-3.5" />
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Hook Dialog Component
// =============================================================================

interface HookDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	hook: PostWriteHook | null;
	onSave: (data: HookFormData) => void;
	isSaving: boolean;
}

function HookDialog({
	open,
	onOpenChange,
	hook,
	onSave,
	isSaving,
}: HookDialogProps) {
	const [formData, setFormData] = useState<HookFormData>(DEFAULT_FORM_DATA);
	const [errors, setErrors] = useState<{ name?: string; command?: string }>({});

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			if (hook) {
				setFormData({
					name: hook.name,
					command: hook.command,
					glob: hook.glob,
					cwd: hook.cwd ?? "",
					onFailure: hook.onFailure,
				});
			} else {
				setFormData(DEFAULT_FORM_DATA);
			}
			setErrors({});
		}
	}, [open, hook]);

	const handleSave = () => {
		const newErrors: { name?: string; command?: string } = {};
		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		}
		if (!formData.command.trim()) {
			newErrors.command = "Command is required";
		}
		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}
		onSave(formData);
	};

	const isEditing = hook !== null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="text-zinc-100">
						{isEditing ? "Edit Hook" : "Add Hook"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					{/* Name field */}
					<div className="space-y-2">
						<Label className="text-zinc-300">Name *</Label>
						<Input
							value={formData.name}
							onChange={(e) => {
								setFormData({ ...formData, name: e.target.value });
								if (errors.name) setErrors({ ...errors, name: undefined });
							}}
							placeholder="e.g., Format on save"
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500"
							disabled={isSaving}
						/>
						{errors.name && (
							<p className="text-xs text-red-400">{errors.name}</p>
						)}
					</div>

					{/* Command field */}
					<div className="space-y-2">
						<Label className="text-zinc-300">Command *</Label>
						<Textarea
							value={formData.command}
							onChange={(e) => {
								setFormData({ ...formData, command: e.target.value });
								if (errors.command)
									setErrors({ ...errors, command: undefined });
							}}
							placeholder="e.g., prettier --write %PATH%"
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 min-h-20 font-mono text-sm"
							disabled={isSaving}
						/>
						{errors.command && (
							<p className="text-xs text-red-400">{errors.command}</p>
						)}
						<p className="text-xs text-zinc-500">
							Placeholders: %PATH%, %ABSOLUTE_PATH%, %DIRNAME%, %FILENAME%
						</p>
					</div>

					{/* Glob field */}
					<div className="space-y-2">
						<Label className="text-zinc-300">File Pattern</Label>
						<Input
							value={formData.glob}
							onChange={(e) =>
								setFormData({ ...formData, glob: e.target.value })
							}
							placeholder="*"
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 font-mono text-sm"
							disabled={isSaving}
						/>
						<p className="text-xs text-zinc-500">
							Glob pattern to match files (e.g., **/*.ts, *.json)
						</p>
					</div>

					{/* CWD field */}
					<div className="space-y-2">
						<Label className="text-zinc-300">Working Directory</Label>
						<Input
							value={formData.cwd}
							onChange={(e) =>
								setFormData({ ...formData, cwd: e.target.value })
							}
							placeholder="Project root (default)"
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 font-mono text-sm"
							disabled={isSaving}
						/>
						<p className="text-xs text-zinc-500">
							Optional. Relative to project root.
						</p>
					</div>

					{/* On Failure field */}
					<div className="space-y-2">
						<Label className="text-zinc-300">On Failure</Label>
						<RadioGroup
							value={formData.onFailure}
							onValueChange={(value) =>
								setFormData({ ...formData, onFailure: value as HookOnFailure })
							}
							className="flex gap-6"
							disabled={isSaving}
						>
							<div className="flex items-center gap-2">
								<RadioGroupItem
									value="warn"
									id="warn"
									className="border-zinc-600"
								/>
								<Label htmlFor="warn" className="text-zinc-400 font-normal">
									Warn (log and continue)
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem
									value="block"
									id="block"
									className="border-zinc-600"
								/>
								<Label htmlFor="block" className="text-zinc-400 font-normal">
									Block (fail the tool)
								</Label>
							</div>
						</RadioGroup>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
						className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={isSaving}
						className="bg-emerald-600 hover:bg-emerald-500 text-white"
					>
						{isSaving ? "Saving..." : isEditing ? "Save Changes" : "Add Hook"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Hooks Section Component
// =============================================================================

export function HooksSection() {
	const { hooksConfig, loadHooksConfig, saveHooksConfig, isLoading } =
		useSettings();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingHook, setEditingHook] = useState<PostWriteHook | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		loadHooksConfig();
	}, [loadHooksConfig]);

	const hooks: PostWriteHook[] = hooksConfig ?? [];

	const handleAddHook = () => {
		setEditingHook(null);
		setDialogOpen(true);
	};

	const handleEditHook = (hook: PostWriteHook) => {
		setEditingHook(hook);
		setDialogOpen(true);
	};

	const handleSaveHook = async (data: HookFormData) => {
		setIsSaving(true);
		try {
			const newHook: PostWriteHook = {
				id: editingHook?.id ?? crypto.randomUUID(),
				name: data.name.trim(),
				command: data.command.trim(),
				glob: data.glob.trim() || "*",
				cwd: data.cwd.trim() || undefined,
				onFailure: data.onFailure,
			};

			let updatedHooks: PostWriteHook[];
			if (editingHook) {
				// Update existing hook
				updatedHooks = hooks.map((h) =>
					h.id === editingHook.id ? newHook : h,
				);
			} else {
				// Add new hook
				updatedHooks = [...hooks, newHook];
			}

			await saveHooksConfig(updatedHooks);
			setDialogOpen(false);
			setEditingHook(null);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteHook = async (hookId: string) => {
		const updatedHooks = hooks.filter((h) => h.id !== hookId);
		await saveHooksConfig(updatedHooks);
	};

	const handleMoveHook = async (index: number, direction: "up" | "down") => {
		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= hooks.length) return;

		const updatedHooks = [...hooks];
		const movedHook = updatedHooks.splice(index, 1)[0];
		if (!movedHook) return;
		updatedHooks.splice(newIndex, 0, movedHook);

		await saveHooksConfig(updatedHooks);
	};

	return (
		<section>
			<div className="flex items-baseline justify-between mb-4">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
					Post-Write Hooks
				</h3>
				<span className="text-xs text-zinc-600">
					{hooks.length} {hooks.length === 1 ? "hook" : "hooks"} configured
				</span>
			</div>

			{hooks.length === 0 ? (
				<div className="py-6 text-center text-zinc-500 text-sm">
					<p>No hooks configured.</p>
					<p className="text-xs mt-1">
						Hooks run automatically after file writes.
					</p>
				</div>
			) : (
				<div className="divide-y divide-zinc-800/50">
					{hooks.map((hook, index) => (
						<HookRow
							key={hook.id}
							hook={hook}
							index={index}
							total={hooks.length}
							onEdit={() => handleEditHook(hook)}
							onDelete={() => handleDeleteHook(hook.id)}
							onMoveUp={() => handleMoveHook(index, "up")}
							onMoveDown={() => handleMoveHook(index, "down")}
							disabled={isLoading}
						/>
					))}
				</div>
			)}

			<Button
				size="sm"
				variant="ghost"
				onClick={handleAddHook}
				disabled={isLoading}
				className="mt-4 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
			>
				<Plus className="w-4 h-4 mr-2" />
				Add Hook
			</Button>

			<HookDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				hook={editingHook}
				onSave={handleSaveHook}
				isSaving={isSaving}
			/>
		</section>
	);
}
