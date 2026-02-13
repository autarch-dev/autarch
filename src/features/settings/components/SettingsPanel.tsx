import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "../hooks/useSettings";
import { ApiProviderKeysSection } from "./ApiProviderKeysSection";
import { GitIdentitySection } from "./GitIdentitySection";
import { HooksSection } from "./HooksSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { ModelPreferencesSection } from "./ModelPreferencesSection";
import { PersistentApprovalsSection } from "./PersistentApprovalsSection";

interface SettingsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
	const {
		loadApiKeysStatus,
		loadModelPreferences,
		loadIntegrationsStatus,
		loadHooksConfig,
		loadPersistentApprovals,
		loadGitIdentity,
	} = useSettings();

	// Load all data when panel opens
	useEffect(() => {
		if (open) {
			loadApiKeysStatus();
			loadModelPreferences();
			loadIntegrationsStatus();
			loadHooksConfig();
			loadPersistentApprovals();
			loadGitIdentity();
		}
	}, [
		open,
		loadApiKeysStatus,
		loadModelPreferences,
		loadIntegrationsStatus,
		loadHooksConfig,
		loadPersistentApprovals,
		loadGitIdentity,
	]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full overflow-y-clip sm:max-w-lg border-l-0 bg-zinc-950"
			>
				<Tabs defaultValue="keys" className="w-full h-screen flex flex-col">
					<SheetHeader className="shrink-0">
						<SheetTitle className="text-xl font-medium tracking-tight text-zinc-100">
							Settings
						</SheetTitle>
						<TabsList className="w-full bg-zinc-900/50">
							<TabsTrigger value="keys" className="flex-1">
								API Keys
							</TabsTrigger>
							<TabsTrigger value="models" className="flex-1">
								Models
							</TabsTrigger>
							<TabsTrigger value="project" className="flex-1">
								Project
							</TabsTrigger>
						</TabsList>
					</SheetHeader>

					<ScrollArea className="flex-1 min-h-0 px-8">
						<TabsContent value="keys" className="mt-6 space-y-6">
							<ApiProviderKeysSection />
							<IntegrationsSection />
						</TabsContent>

						<TabsContent value="models" className="mt-6">
							<ModelPreferencesSection />
						</TabsContent>

						<TabsContent value="project" className="mt-6 space-y-6">
							<GitIdentitySection />
							<HooksSection />
							<PersistentApprovalsSection />
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
