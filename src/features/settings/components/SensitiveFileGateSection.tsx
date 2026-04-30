import { useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSettings } from "../hooks/useSettings";

export function SensitiveFileGateSection() {
	const {
		sensitiveFileGateDisabled,
		loadSensitiveFileGateDisabled,
		saveSensitiveFileGateDisabled,
		isLoading,
	} = useSettings();

	useEffect(() => {
		loadSensitiveFileGateDisabled();
	}, [loadSensitiveFileGateDisabled]);

	const handleToggle = async (checked: boolean) => {
		try {
			await saveSensitiveFileGateDisabled(checked);
		} catch {
			// Error is already set in the store
		}
	};

	return (
		<section>
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Sensitive File Gate
			</h3>
			<p className="text-xs text-zinc-500 mb-4">
				By default, the read_file tool refuses to read paths matching
				sensitive-content patterns (env files, credentials, SSH keys, etc.).
				Disable this gate to allow the agent to read those files.
			</p>
			<div className="flex items-start gap-3">
				<Checkbox
					id="sensitive-file-gate-disabled"
					checked={sensitiveFileGateDisabled}
					onCheckedChange={(checked) => handleToggle(checked === true)}
					disabled={isLoading}
					className="mt-0.5"
				/>
				<Label
					htmlFor="sensitive-file-gate-disabled"
					className="text-sm text-zinc-300 leading-snug cursor-pointer"
				>
					Disable the sensitive file gate for this project
				</Label>
			</div>
		</section>
	);
}
