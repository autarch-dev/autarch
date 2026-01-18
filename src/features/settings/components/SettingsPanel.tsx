import { useEffect } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
			<SheetContent
				side="right"
				className="w-full overflow-y-auto sm:max-w-lg border-l-0 bg-zinc-950 p-6"
			>
				<SheetHeader className="pb-2">
					<SheetTitle className="text-xl font-medium tracking-tight text-zinc-100">
						Settings
					</SheetTitle>
				</SheetHeader>

				<Tabs defaultValue="keys" className="w-full">
					<TabsList className="w-full bg-zinc-900/50">
						<TabsTrigger value="keys" className="flex-1">
							API Keys
						</TabsTrigger>
						<TabsTrigger value="models" className="flex-1">
							Models
						</TabsTrigger>
					</TabsList>

					<TabsContent value="keys" className="mt-6 space-y-6">
						<ApiProviderKeysSection />
						<IntegrationsSection />
					</TabsContent>

					<TabsContent value="models" className="mt-6">
						<ModelPreferencesSection />
					</TabsContent>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
