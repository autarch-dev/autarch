import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomProviders } from "../hooks/useCustomProviders";
import { useSettings } from "../hooks/useSettings";
import { AgentBackendSection } from "./AgentBackendSection";
import { ApiProviderKeysSection } from "./ApiProviderKeysSection";
import { CcModelPreferencesSection } from "./CcModelPreferencesSection";
import { CustomProvidersSection } from "./CustomProvidersSection";
import { GitIdentitySection } from "./GitIdentitySection";
import { HooksSection } from "./HooksSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { JiraSection } from "./JiraSection";
import { ModelPreferencesSection } from "./ModelPreferencesSection";
import { PersistentApprovalsSection } from "./PersistentApprovalsSection";

interface SettingsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
	const {
		agentBackend,
		loadAgentBackend,
		loadApiKeysStatus,
		loadModelPreferences,
		loadCcModelPreferences,
		loadIntegrationsStatus,
		loadHooksConfig,
		loadPersistentApprovals,
		loadGitIdentity,
	} = useSettings();
	const { loadProviders } = useCustomProviders();

	const isApi = agentBackend !== "claude-code";
	const isClaudeCode = agentBackend === "claude-code";

	// Load all data when panel opens
	useEffect(() => {
		if (open) {
			loadAgentBackend();
			loadApiKeysStatus();
			loadModelPreferences();
			loadCcModelPreferences();
			loadIntegrationsStatus();
			loadHooksConfig();
			loadPersistentApprovals();
			loadGitIdentity();
			loadProviders();
		}
	}, [
		open,
		loadAgentBackend,
		loadApiKeysStatus,
		loadModelPreferences,
		loadCcModelPreferences,
		loadIntegrationsStatus,
		loadHooksConfig,
		loadPersistentApprovals,
		loadGitIdentity,
		loadProviders,
	]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full overflow-y-clip sm:max-w-lg border-l-0 bg-zinc-950"
			>
				<Tabs defaultValue="provider" className="w-full h-screen flex flex-col">
					<SheetHeader className="shrink-0">
						<SheetTitle className="text-xl font-medium tracking-tight text-zinc-100">
							Settings
						</SheetTitle>
						<TabsList className="w-full bg-zinc-900/50">
							<TabsTrigger value="provider" className="flex-1">
								Provider
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
						<TabsContent value="provider" className="mt-6 space-y-6">
							<AgentBackendSection />
							{isApi && (
								<>
									<ApiProviderKeysSection />
									<CustomProvidersSection />
								</>
							)}
							<IntegrationsSection />
							<JiraSection />
						</TabsContent>

						<TabsContent value="models" className="mt-6 space-y-6">
							{isApi && <ModelPreferencesSection />}
							{isClaudeCode && <CcModelPreferencesSection />}
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
