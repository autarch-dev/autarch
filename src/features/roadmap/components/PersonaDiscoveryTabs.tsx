/**
 * PersonaDiscoveryTabs - Tabbed container for persona and synthesis conversations
 *
 * Orchestrates 4 persona agent tabs (Visionary, Iterative, Tech Lead, Pathfinder)
 * plus a Synthesis tab. Each tab shows a PlanningConversation and, once the persona
 * submits, a PersonaRoadmapPreview card. Tab triggers display status indicators
 * (spinner, question badge, or checkmark). The Synthesis tab is disabled until all
 * 4 personas complete.
 */

import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChannelMessage } from "@/shared/schemas/channel";
import {
	type PersonaName,
	type PersonaSessionState,
	type PersonaTab,
	type RoadmapConversationState,
	useRoadmapStore,
} from "../store/roadmapStore";
import {
	type PersonaRoadmapData,
	PersonaRoadmapPreview,
} from "./PersonaRoadmapPreview";
import { PlanningConversation } from "./PlanningConversation";

// =============================================================================
// Constants
// =============================================================================

const PERSONA_TABS: { value: PersonaName; label: string }[] = [
	{ value: "visionary", label: "Visionary" },
	{ value: "iterative", label: "Iterative" },
	{ value: "tech_lead", label: "Tech Lead" },
	{ value: "pathfinder", label: "Pathfinder" },
];

const EMPTY_CONVERSATION: RoadmapConversationState = {
	messages: [],
	isLoading: true,
};

// =============================================================================
// Status Helpers
// =============================================================================

type TabStatus = "running" | "questions" | "completed" | "failed" | "idle";

/** Runtime type guard for persona roadmap data from the backend */
function isValidRoadmapData(data: unknown): data is PersonaRoadmapData {
	return (
		typeof data === "object" &&
		data !== null &&
		"vision" in data &&
		typeof (data as Record<string, unknown>).vision === "string" &&
		"milestones" in data &&
		Array.isArray((data as Record<string, unknown>).milestones)
	);
}

/** Derive the tab status from a persona session and its conversation state */
function getPersonaTabStatus(
	session: PersonaSessionState | undefined,
	conversation: RoadmapConversationState | undefined,
): TabStatus {
	if (!session) return "idle";
	if (session.status === "completed") return "completed";
	if (session.status === "failed") return "failed";

	// Check for unanswered questions in the conversation
	if (conversation && hasUnansweredQuestions(conversation)) {
		return "questions";
	}

	// Running or streaming
	if (
		session.status === "running" ||
		conversation?.streamingMessage != null ||
		conversation?.sessionStatus === "active"
	) {
		return "running";
	}

	return "idle";
}

/** Check whether a conversation has any pending (unanswered) questions */
function hasUnansweredQuestions(
	conversation: RoadmapConversationState,
): boolean {
	// Check streaming message questions
	if (conversation.streamingMessage?.questions?.length) {
		const hasPending = conversation.streamingMessage.questions.some(
			(q) => q.status === "pending",
		);
		if (hasPending) return true;
	}

	// Check completed messages — only the latest assistant message matters
	for (let i = conversation.messages.length - 1; i >= 0; i--) {
		const msg = conversation.messages[i];
		if (msg && msg.role === "assistant" && msg.questions?.length) {
			return msg.questions.some((q) => q.status === "pending");
		}
	}

	return false;
}

function TabStatusIcon({ status }: { status: TabStatus }) {
	switch (status) {
		case "running":
			return <Loader2 className="size-3.5 animate-spin" />;
		case "questions":
			return <AlertCircle className="size-3.5 text-amber-500" />;
		case "completed":
			return <CheckCircle2 className="size-3.5 text-green-500" />;
		case "failed":
			return <XCircle className="size-3.5 text-red-500" />;
		default:
			return null;
	}
}

// =============================================================================
// Props
// =============================================================================

interface PersonaDiscoveryTabsProps {
	roadmapId: string;
}

// =============================================================================
// Component
// =============================================================================

export function PersonaDiscoveryTabs({ roadmapId }: PersonaDiscoveryTabsProps) {
	const activePersonaTab = useRoadmapStore((s) => s.activePersonaTab);
	const personaSessions = useRoadmapStore((s) => s.personaSessions);
	const synthesisSessionId = useRoadmapStore((s) => s.synthesisSessionId);
	const conversations = useRoadmapStore((s) => s.conversations);
	const fetchPersonaSessions = useRoadmapStore((s) => s.fetchPersonaSessions);

	// Fetch persona sessions on mount
	useEffect(() => {
		fetchPersonaSessions(roadmapId);
	}, [roadmapId, fetchPersonaSessions]);

	// Build a persona→sessionId lookup
	const personaSessionMap = useMemo(() => {
		const map = new Map<string, PersonaSessionState>();
		for (const [, session] of personaSessions) {
			map.set(session.persona, session);
		}
		return map;
	}, [personaSessions]);

	// Determine if all 4 personas are completed
	const allPersonasComplete = useMemo(() => {
		return PERSONA_TABS.every((p) => {
			const status = personaSessionMap.get(p.value)?.status;
			return status === "completed" || status === "failed";
		});
	}, [personaSessionMap]);

	// Synthesis conversation state
	const synthesisConversation = synthesisSessionId
		? conversations.get(synthesisSessionId)
		: undefined;

	const synthesisStatus = useMemo((): TabStatus => {
		if (!synthesisSessionId || !synthesisConversation) return "idle";
		if (synthesisConversation.sessionStatus === "completed") return "completed";
		if (hasUnansweredQuestions(synthesisConversation)) return "questions";
		if (
			synthesisConversation.streamingMessage != null ||
			synthesisConversation.sessionStatus === "active"
		) {
			return "running";
		}
		return "idle";
	}, [synthesisSessionId, synthesisConversation]);

	// Tab change handler
	const handleTabChange = useCallback((value: string) => {
		useRoadmapStore.setState({ activePersonaTab: value as PersonaTab });
	}, []);

	// Per-session send handler
	const handleSendMessage = useCallback(
		async (sessionId: string, content: string) => {
			// Optimistically add the user message
			const userMessage: ChannelMessage = {
				id: `temp_${Date.now()}`,
				turnId: `temp_${Date.now()}`,
				role: "user",
				segments: [{ index: 0, content }],
				timestamp: Date.now(),
			};

			useRoadmapStore.setState((state) => {
				const convs = new Map(state.conversations);
				const existing = convs.get(sessionId);
				if (existing) {
					convs.set(sessionId, {
						...existing,
						messages: [...existing.messages, userMessage],
					});
				}
				return { conversations: convs };
			});

			const response = await fetch(`/api/sessions/${sessionId}/message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? "Failed to send message");
			}
		},
		[],
	);

	return (
		<Tabs
			value={activePersonaTab}
			onValueChange={handleTabChange}
			className="flex flex-col h-full"
		>
			<div className="px-4 pt-3 shrink-0">
				<TabsList>
					{PERSONA_TABS.map((persona) => {
						const session = personaSessionMap.get(persona.value);
						const conversation = session?.sessionId
							? conversations.get(session.sessionId)
							: undefined;
						const status = getPersonaTabStatus(session, conversation);

						return (
							<TabsTrigger key={persona.value} value={persona.value}>
								{persona.label}
								<TabStatusIcon status={status} />
							</TabsTrigger>
						);
					})}
					<TabsTrigger value="synthesis" disabled={!allPersonasComplete}>
						Synthesis
						<TabStatusIcon status={synthesisStatus} />
					</TabsTrigger>
				</TabsList>
			</div>

			{PERSONA_TABS.map((persona) => {
				const session = personaSessionMap.get(persona.value);
				const conversation = session?.sessionId
					? conversations.get(session.sessionId)
					: undefined;
				const isCompleted = session?.status === "completed";

				// Input mode: questions-only while running, disabled after completion
				const inputMode = isCompleted ? "disabled" : "questions-only";

				return (
					<TabsContent
						key={persona.value}
						value={persona.value}
						className="flex-1 min-h-0 flex flex-col"
					>
						<PlanningConversation
							roadmapId={roadmapId}
							conversation={conversation ?? EMPTY_CONVERSATION}
							onSendMessage={(content) => {
								if (session?.sessionId) {
									handleSendMessage(session.sessionId, content);
								}
							}}
							inputMode={inputMode}
						/>
						{isCompleted && isValidRoadmapData(session?.roadmapData) && (
							<div className="shrink-0 border-t">
								<PersonaRoadmapPreview
									persona={persona.label}
									roadmapData={session.roadmapData}
								/>
							</div>
						)}
					</TabsContent>
				);
			})}

			<TabsContent value="synthesis" className="flex-1 min-h-0 flex flex-col">
				{synthesisSessionId && synthesisConversation ? (
					<PlanningConversation
						roadmapId={roadmapId}
						conversation={synthesisConversation}
						onSendMessage={(content) => {
							if (synthesisSessionId) {
								handleSendMessage(synthesisSessionId, content);
							}
						}}
						inputMode={
							synthesisConversation.sessionStatus === "completed"
								? "disabled"
								: "full"
						}
					/>
				) : (
					<div className="flex flex-col items-center justify-center py-16 text-center px-4">
						<p className="text-muted-foreground text-sm">
							The synthesis agent will start once all personas have submitted
							their roadmaps.
						</p>
					</div>
				)}
			</TabsContent>
		</Tabs>
	);
}
