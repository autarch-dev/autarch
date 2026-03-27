import {
	Check,
	ChevronDown,
	ChevronUp,
	Loader2,
	RotateCw,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
	JiraConfig,
	JiraProjectMetadata,
	JiraStatus,
} from "@/shared/schemas/jira";
import { WORKFLOW_STATUS_LABELS } from "@/shared/schemas/workflow";
import { WORKFLOW_STATUSES } from "@/shared/schemas/workflow-status";
import {
	bootstrapJiraMappings,
	clearJiraConfig,
	clearJiraCredentials,
	fetchJiraConfig,
	fetchJiraCredentialsStatus,
	fetchJiraMetadata,
	saveJiraConfig,
	saveJiraCredentials,
	testJiraConnection,
} from "../api/jiraApi";

// Null sentinel for "skip" selects (Radix Select doesn't allow empty string values)
const SKIP_VALUE = "__skip__";

const INITIATIVE_PRIORITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const WORKFLOW_PRIORITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	urgent: "Urgent",
};

export function JiraSection() {
	const [credentialsConfigured, setCredentialsConfigured] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// Form state
	const [baseUrl, setBaseUrl] = useState("");
	const [projectKey, setProjectKey] = useState("");
	const [email, setEmail] = useState("");
	const [apiToken, setApiToken] = useState("");

	// Config & mapping state
	const [config, setConfig] = useState<JiraConfig | null>(null);
	const [metadata, setMetadata] = useState<JiraProjectMetadata | null>(null);
	const [isMappingsOpen, setIsMappingsOpen] = useState(false);
	const [isSavingMappings, setIsSavingMappings] = useState(false);

	// UI state
	const [isEditing, setIsEditing] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		error?: string;
	} | null>(null);

	const loadStatus = useCallback(async () => {
		setIsLoading(true);
		try {
			const [configured, cfg] = await Promise.all([
				fetchJiraCredentialsStatus(),
				fetchJiraConfig(),
			]);
			setCredentialsConfigured(configured);
			if (cfg) {
				setBaseUrl(cfg.jiraBaseUrl);
				setProjectKey(cfg.jiraProjectKey);
				setConfig(cfg);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	// Load metadata when mappings panel is opened
	useEffect(() => {
		if (isMappingsOpen && credentialsConfigured && !metadata) {
			fetchJiraMetadata().then((m) => {
				if (m) setMetadata(m);
			});
		}
	}, [isMappingsOpen, credentialsConfigured, metadata]);

	const handleTest = async () => {
		if (
			!baseUrl.trim() ||
			!projectKey.trim() ||
			!email.trim() ||
			!apiToken.trim()
		)
			return;
		setIsTesting(true);
		setTestResult(null);
		try {
			const result = await testJiraConnection({
				jiraBaseUrl: baseUrl.trim().replace(/\/+$/, ""),
				jiraProjectKey: projectKey.trim().toUpperCase(),
				email: email.trim(),
				apiToken: apiToken.trim(),
			});
			setTestResult(result);
		} catch (err) {
			setTestResult({
				success: false,
				error: err instanceof Error ? err.message : "Connection test failed",
			});
		} finally {
			setIsTesting(false);
		}
	};

	const handleSave = async () => {
		if (
			!email.trim() ||
			!apiToken.trim() ||
			!baseUrl.trim() ||
			!projectKey.trim()
		)
			return;
		setIsSaving(true);
		try {
			await Promise.all([
				saveJiraCredentials({
					email: email.trim(),
					apiToken: apiToken.trim(),
				}),
				saveJiraConfig({
					enabled: true,
					jiraBaseUrl: baseUrl.trim().replace(/\/+$/, ""),
					jiraProjectKey: projectKey.trim().toUpperCase(),
				}),
			]);

			// Bootstrap default mappings from Jira project metadata
			const bootstrapped = await bootstrapJiraMappings();
			if (bootstrapped) {
				setConfig(bootstrapped);
			}

			setCredentialsConfigured(true);
			setEmail("");
			setApiToken("");
			setIsEditing(false);
			setTestResult(null);
		} finally {
			setIsSaving(false);
		}
	};

	const handleClear = async () => {
		setIsSaving(true);
		try {
			await Promise.all([clearJiraCredentials(), clearJiraConfig()]);
			setCredentialsConfigured(false);
			setConfig(null);
			setMetadata(null);
			setBaseUrl("");
			setProjectKey("");
			setTestResult(null);
			setIsMappingsOpen(false);
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setEmail("");
		setApiToken("");
		setIsEditing(false);
		setTestResult(null);
	};

	const handleRebootstrapMappings = async () => {
		setIsSavingMappings(true);
		try {
			const bootstrapped = await bootstrapJiraMappings();
			if (bootstrapped) {
				setConfig(bootstrapped);
			}
		} finally {
			setIsSavingMappings(false);
		}
	};

	const updateStatusMapping = async (
		issueTypeId: string,
		workflowStatus: string,
		jiraStatusId: string | null,
	) => {
		if (!config) return;
		const base = Object.fromEntries(
			WORKFLOW_STATUSES.map((s) => [s, null]),
		) as JiraConfig["statusMapping"][string];
		const current = config.statusMapping[issueTypeId];
		const updated: JiraConfig = {
			...config,
			statusMapping: {
				...config.statusMapping,
				[issueTypeId]: {
					...base,
					...current,
					[workflowStatus]: jiraStatusId,
				},
			},
		};
		setConfig(updated);
		await saveJiraConfig(updated);
	};

	const updateInitiativePriorityMapping = async (
		autarchPriority: string,
		jiraPriorityId: string,
	) => {
		if (!config) return;
		const updated: JiraConfig = {
			...config,
			initiativePriorityMapping: {
				...config.initiativePriorityMapping,
				[autarchPriority]: jiraPriorityId,
			},
		};
		setConfig(updated);
		await saveJiraConfig(updated);
	};

	const updateWorkflowPriorityMapping = async (
		autarchPriority: string,
		jiraPriorityId: string,
	) => {
		if (!config) return;
		const updated: JiraConfig = {
			...config,
			workflowPriorityMapping: {
				...config.workflowPriorityMapping,
				[autarchPriority]: jiraPriorityId,
			},
		};
		setConfig(updated);
		await saveJiraConfig(updated);
	};

	if (isLoading) {
		return (
			<section className="pt-6 border-t border-zinc-800/50">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
					Jira
				</h3>
				<div className="flex items-center gap-2 text-zinc-500 text-sm">
					<Loader2 className="w-3 h-3 animate-spin" />
					Loading...
				</div>
			</section>
		);
	}

	// Helper: resolve Jira issue type name from its ID
	const issueTypeName = (typeId: string): string => {
		const match = metadata?.issueTypes.find((t) => t.id === typeId);
		return match?.name ?? typeId;
	};

	// Helper: get statuses available for a given issue type
	const statusesForType = (typeId: string): JiraStatus[] => {
		return metadata?.statuses[typeId] ?? [];
	};

	return (
		<section className="pt-6 border-t border-zinc-800/50">
			<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
				Jira
			</h3>

			{/* Status indicator */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-3">
					<div
						className={cn(
							"flex items-center justify-center w-5 h-5 rounded-full",
							credentialsConfigured ? "bg-emerald-500/20" : "bg-zinc-800",
						)}
					>
						{credentialsConfigured ? (
							<Check className="w-3 h-3 text-emerald-400" />
						) : (
							<X className="w-3 h-3 text-zinc-600" />
						)}
					</div>
					<div>
						<span className="text-sm font-medium text-zinc-200">
							Jira Cloud
						</span>
						<p className="text-xs text-zinc-500">
							{credentialsConfigured
								? "Connected — syncs workflows and roadmaps"
								: "One-way sync to Jira Cloud"}
						</p>
					</div>
				</div>
				{!isEditing && (
					<div className="flex items-center gap-2">
						{credentialsConfigured && (
							<Button
								size="sm"
								variant="ghost"
								onClick={handleClear}
								disabled={isSaving}
								className="h-7 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
							>
								Remove
							</Button>
						)}
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setIsEditing(true)}
							className="h-7 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
						>
							{credentialsConfigured ? "Update" : "Configure"}
						</Button>
					</div>
				)}
			</div>

			{/* Configuration form */}
			{isEditing && (
				<div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<div className="space-y-2">
						<label
							htmlFor="jira-base-url"
							className="text-xs font-medium text-zinc-400"
						>
							Jira Base URL
						</label>
						<Input
							id="jira-base-url"
							type="url"
							placeholder="https://your-org.atlassian.net"
							value={baseUrl}
							onChange={(e) => setBaseUrl(e.target.value)}
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-600 text-sm"
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="jira-project-key"
							className="text-xs font-medium text-zinc-400"
						>
							Project Key
						</label>
						<Input
							id="jira-project-key"
							type="text"
							placeholder="PROJ"
							value={projectKey}
							onChange={(e) => setProjectKey(e.target.value)}
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-600 text-sm"
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="jira-email"
							className="text-xs font-medium text-zinc-400"
						>
							Email
						</label>
						<Input
							id="jira-email"
							type="email"
							placeholder="you@company.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-600 text-sm"
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="jira-api-token"
							className="text-xs font-medium text-zinc-400"
						>
							API Token
						</label>
						<Input
							id="jira-api-token"
							type="password"
							placeholder="Jira API token"
							value={apiToken}
							onChange={(e) => setApiToken(e.target.value)}
							className="bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-600 text-sm"
						/>
						<p className="text-[11px] text-zinc-600">
							Generate at{" "}
							<a
								href="https://id.atlassian.com/manage-profile/security/api-tokens"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500 hover:text-blue-400 underline"
							>
								Atlassian API tokens
							</a>
						</p>
					</div>

					{/* Test result */}
					{testResult && (
						<div
							className={cn(
								"text-xs rounded-md px-3 py-2",
								testResult.success
									? "bg-emerald-500/10 text-emerald-400"
									: "bg-red-500/10 text-red-400",
							)}
						>
							{testResult.success
								? "Connection successful!"
								: (testResult.error ?? "Connection failed")}
						</div>
					)}

					<div className="flex items-center gap-2 pt-2">
						<Button
							size="sm"
							variant="outline"
							onClick={handleTest}
							disabled={
								isTesting ||
								!baseUrl.trim() ||
								!projectKey.trim() ||
								!email.trim() ||
								!apiToken.trim()
							}
							className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
						>
							{isTesting ? (
								<>
									<Loader2 className="w-3 h-3 mr-1 animate-spin" />
									Testing...
								</>
							) : (
								"Test Connection"
							)}
						</Button>
						<Button
							size="sm"
							onClick={handleSave}
							disabled={
								isSaving ||
								!email.trim() ||
								!apiToken.trim() ||
								!baseUrl.trim() ||
								!projectKey.trim()
							}
							className="bg-emerald-600 hover:bg-emerald-500 text-white"
						>
							{isSaving ? "Saving..." : "Save Credentials"}
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
			)}

			{/* Status & Priority Mapping Panel */}
			{credentialsConfigured && config && !isEditing && (
				<div className="mt-3">
					<button
						type="button"
						onClick={() => setIsMappingsOpen((o) => !o)}
						className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
					>
						{isMappingsOpen ? (
							<ChevronUp className="w-3 h-3" />
						) : (
							<ChevronDown className="w-3 h-3" />
						)}
						Status &amp; Priority Mappings
					</button>

					{isMappingsOpen && (
						<div className="mt-3 space-y-5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
							{!metadata ? (
								<div className="flex items-center gap-2 text-zinc-500 text-xs">
									<Loader2 className="w-3 h-3 animate-spin" />
									Loading Jira metadata...
								</div>
							) : (
								<>
									{/* Re-bootstrap button */}
									<div className="flex items-center justify-between">
										<p className="text-[11px] text-zinc-600">
											Mappings are auto-populated on first save. Adjust as
											needed or reset to defaults.
										</p>
										<Button
											size="sm"
											variant="ghost"
											onClick={handleRebootstrapMappings}
											disabled={isSavingMappings}
											className="h-6 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 gap-1"
										>
											{isSavingMappings ? (
												<Loader2 className="w-3 h-3 animate-spin" />
											) : (
												<RotateCw className="w-3 h-3" />
											)}
											Reset Defaults
										</Button>
									</div>

									{/* Status Mappings — per issue type */}
									<div className="space-y-4">
										<h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
											Status Mapping
										</h4>
										{Object.keys(config.statusMapping).length === 0 ? (
											<p className="text-xs text-zinc-600">
												No status mappings configured. Click "Reset Defaults" to
												auto-populate.
											</p>
										) : (
											Object.keys(config.statusMapping).map((typeId) => {
												const mapping = config.statusMapping[typeId];
												if (!mapping) return null;
												const statuses = statusesForType(typeId);
												return (
													<div key={typeId} className="space-y-2">
														<p className="text-xs font-medium text-zinc-400">
															{issueTypeName(typeId)}
														</p>
														<div className="grid grid-cols-2 gap-x-4 gap-y-2">
															{WORKFLOW_STATUSES.map((ws) => (
																<div
																	key={ws}
																	className="flex items-center justify-between gap-2"
																>
																	<span className="text-xs text-zinc-400 min-w-[80px]">
																		{WORKFLOW_STATUS_LABELS[ws]}
																	</span>
																	<Select
																		value={mapping[ws] ?? SKIP_VALUE}
																		onValueChange={(v) =>
																			updateStatusMapping(
																				typeId,
																				ws,
																				v === SKIP_VALUE ? null : v,
																			)
																		}
																	>
																		<SelectTrigger
																			size="sm"
																			className="h-7 text-xs border-zinc-700 bg-zinc-900 w-[160px]"
																		>
																			<SelectValue placeholder="Skip" />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value={SKIP_VALUE}>
																				<span className="text-zinc-500">
																					Skip
																				</span>
																			</SelectItem>
																			{statuses.map((s) => (
																				<SelectItem key={s.id} value={s.id}>
																					{s.name}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</Select>
																</div>
															))}
														</div>
													</div>
												);
											})
										)}
									</div>

									{/* Initiative Priority Mapping */}
									<div className="space-y-2">
										<h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
											Initiative Priority Mapping
										</h4>
										<div className="grid grid-cols-2 gap-x-4 gap-y-2">
											{Object.entries(INITIATIVE_PRIORITY_LABELS).map(
												([key, label]) => (
													<div
														key={key}
														className="flex items-center justify-between gap-2"
													>
														<span className="text-xs text-zinc-400 min-w-[80px]">
															{label}
														</span>
														<Select
															value={
																config.initiativePriorityMapping[
																	key as keyof typeof config.initiativePriorityMapping
																] || SKIP_VALUE
															}
															onValueChange={(v) =>
																updateInitiativePriorityMapping(
																	key,
																	v === SKIP_VALUE ? "" : v,
																)
															}
														>
															<SelectTrigger
																size="sm"
																className="h-7 text-xs border-zinc-700 bg-zinc-900 w-[160px]"
															>
																<SelectValue placeholder="Not mapped" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value={SKIP_VALUE}>
																	<span className="text-zinc-500">
																		Not mapped
																	</span>
																</SelectItem>
																{metadata.priorities.map((p) => (
																	<SelectItem key={p.id} value={p.id}>
																		{p.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												),
											)}
										</div>
									</div>

									{/* Workflow Priority Mapping */}
									<div className="space-y-2">
										<h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
											Workflow Priority Mapping
										</h4>
										<div className="grid grid-cols-2 gap-x-4 gap-y-2">
											{Object.entries(WORKFLOW_PRIORITY_LABELS).map(
												([key, label]) => (
													<div
														key={key}
														className="flex items-center justify-between gap-2"
													>
														<span className="text-xs text-zinc-400 min-w-[80px]">
															{label}
														</span>
														<Select
															value={
																config.workflowPriorityMapping[
																	key as keyof typeof config.workflowPriorityMapping
																] || SKIP_VALUE
															}
															onValueChange={(v) =>
																updateWorkflowPriorityMapping(
																	key,
																	v === SKIP_VALUE ? "" : v,
																)
															}
														>
															<SelectTrigger
																size="sm"
																className="h-7 text-xs border-zinc-700 bg-zinc-900 w-[160px]"
															>
																<SelectValue placeholder="Not mapped" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value={SKIP_VALUE}>
																	<span className="text-zinc-500">
																		Not mapped
																	</span>
																</SelectItem>
																{metadata.priorities.map((p) => (
																	<SelectItem key={p.id} value={p.id}>
																		{p.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												),
											)}
										</div>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			)}
		</section>
	);
}
