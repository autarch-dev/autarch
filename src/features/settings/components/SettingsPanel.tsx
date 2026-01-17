import { useEffect } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useSettings } from "../hooks/useSettings";
import { ApiProviderKeysSection } from "./ApiProviderKeysSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { ModelPreferencesSection } from "./ModelPreferencesSection";

interface SettingsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
	const { loadApiKeysStatus, loadModelPreferences, loadIntegrationsStatus } =
		useSettings();

	// Load all data when panel opens
	useEffect(() => {
		if (open) {
			loadApiKeysStatus();
			loadModelPreferences();
			loadIntegrationsStatus();
		}
	}, [open, loadApiKeysStatus, loadModelPreferences, loadIntegrationsStatus]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>Settings</SheetTitle>
				</SheetHeader>
				<div className="flex flex-col gap-8 py-4">
					<ApiProviderKeysSection />
					<ModelPreferencesSection />
					<IntegrationsSection />
				</div>
			</SheetContent>
		</Sheet>
	);
}
