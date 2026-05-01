import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ShellApprovalMode } from "@/shared/schemas/settings";
import { useSettings } from "../hooks/useSettings";

interface ModeOption {
	value: ShellApprovalMode;
	title: string;
	description: string;
}

const MODE_OPTIONS: ModeOption[] = [
	{
		value: "strict",
		title: "Strict",
		description:
			"Every shell command requires manual approval, except commands you've explicitly remembered.",
	},
	{
		value: "auto",
		title: "Auto",
		description:
			"A model judges new commands against your remembered approvals. Safe variants run automatically; anything questionable still prompts you.",
	},
	{
		value: "yolo",
		title: "Yolo",
		description:
			"All shell commands run without approval. A small list of catastrophic patterns (e.g. rm -rf /) still requires confirmation.",
	},
];

export function ShellApprovalModeSection() {
	const { shellApprovalMode, loadShellApprovalMode, saveShellApprovalMode } =
		useSettings();

	useEffect(() => {
		loadShellApprovalMode();
	}, [loadShellApprovalMode]);

	const handleChange = async (value: string) => {
		try {
			await saveShellApprovalMode(value as ShellApprovalMode);
		} catch {
			// Error is already set in the store
		}
	};

	return (
		<section>
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Shell Approval Mode
			</h3>
			<RadioGroup value={shellApprovalMode} onValueChange={handleChange}>
				{MODE_OPTIONS.map((option) => (
					<div key={option.value} className="flex items-start gap-3">
						<RadioGroupItem
							id={`shell-approval-mode-${option.value}`}
							value={option.value}
							className="mt-0.5"
						/>
						<Label
							htmlFor={`shell-approval-mode-${option.value}`}
							className="flex-1 cursor-pointer"
						>
							<div className="text-sm font-medium text-zinc-200">
								{option.title}
							</div>
							<div className="text-xs text-zinc-500 leading-snug mt-0.5 font-normal">
								{option.description}
							</div>
						</Label>
					</div>
				))}
			</RadioGroup>
		</section>
	);
}
