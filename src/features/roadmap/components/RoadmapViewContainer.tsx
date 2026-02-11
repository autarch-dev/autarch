/**
 * RoadmapViewContainer - Container component for RoadmapView
 *
 * Owns data fetching and state management for a specific roadmap,
 * driven by URL parameter. Connects to useRoadmapStore and passes
 * extracted data to the presentational RoadmapView component.
 */

import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useShallow } from "zustand/react/shallow";
import type { Initiative } from "@/shared/schemas/roadmap";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadmapView } from "./RoadmapView";

interface RoadmapViewContainerProps {
	roadmapId: string;
}

export function RoadmapViewContainer({ roadmapId }: RoadmapViewContainerProps) {
	const [, setLocation] = useLocation();

	// Select only the data for this specific roadmap (shallow-compared)
	const { roadmap, roadmapsLoading, details, conversation } = useRoadmapStore(
		useShallow((s) => ({
			roadmap: s.roadmaps.find((r) => r.id === roadmapId),
			roadmapsLoading: s.roadmapsLoading,
			details: s.roadmapDetails.get(roadmapId),
			conversation: s.conversations.get(roadmapId),
		})),
	);

	// Actions are stable references — select individually without shallow comparison
	const selectRoadmap = useRoadmapStore((s) => s.selectRoadmap);
	const fetchRoadmapDetails = useRoadmapStore((s) => s.fetchRoadmapDetails);
	const fetchHistory = useRoadmapStore((s) => s.fetchHistory);
	const updateRoadmap = useRoadmapStore((s) => s.updateRoadmap);
	const deleteRoadmap = useRoadmapStore((s) => s.deleteRoadmap);
	const sendMessage = useRoadmapStore((s) => s.sendMessage);
	const createMilestone = useRoadmapStore((s) => s.createMilestone);
	const updateMilestone = useRoadmapStore((s) => s.updateMilestone);
	const deleteMilestone = useRoadmapStore((s) => s.deleteMilestone);
	const createInitiative = useRoadmapStore((s) => s.createInitiative);
	const updateInitiative = useRoadmapStore((s) => s.updateInitiative);
	const deleteInitiative = useRoadmapStore((s) => s.deleteInitiative);
	const updateVision = useRoadmapStore((s) => s.updateVision);

	// Track which roadmapId we've already fetched history for, so we don't
	// include `conversation` in the dependency array (which changes on every
	// WebSocket event and would cause a re-fetch storm during streaming).
	const historyFetchedRef = useRef<string | null>(null);

	// Select roadmap and fetch details when roadmapId changes
	useEffect(() => {
		selectRoadmap(roadmapId);
		fetchRoadmapDetails(roadmapId);
	}, [roadmapId, selectRoadmap, fetchRoadmapDetails]);

	// Fetch history once per roadmapId, only if no conversation exists yet
	useEffect(() => {
		if (historyFetchedRef.current === roadmapId) return;
		if (!conversation) {
			historyFetchedRef.current = roadmapId;
			fetchHistory(roadmapId);
		}
	}, [roadmapId, conversation, fetchHistory]);

	const handleUpdateTitle = useCallback(
		async (title: string) => {
			await updateRoadmap(roadmapId, { title });
		},
		[roadmapId, updateRoadmap],
	);

	const handleDelete = useCallback(async () => {
		await deleteRoadmap(roadmapId);
		setLocation("/dashboard");
	}, [roadmapId, deleteRoadmap, setLocation]);

	const handleSendMessage = useCallback(
		(content: string) => {
			sendMessage(roadmapId, content);
		},
		[roadmapId, sendMessage],
	);

	const handleUpdateMilestone = useCallback(
		async (
			milestoneId: string,
			data: Parameters<typeof updateMilestone>[2],
		) => {
			await updateMilestone(roadmapId, milestoneId, data);
		},
		[roadmapId, updateMilestone],
	);

	const handleUpdateInitiative = useCallback(
		async (
			initiativeId: string,
			data: Parameters<typeof updateInitiative>[2],
		) => {
			await updateInitiative(roadmapId, initiativeId, data);
		},
		[roadmapId, updateInitiative],
	);

	const handleCreateMilestone = useCallback(
		async (data: { title: string; description?: string }) => {
			await createMilestone(roadmapId, data);
		},
		[roadmapId, createMilestone],
	);

	const handleCreateInitiative = useCallback(
		async (
			milestoneId: string,
			data: { title: string },
		): Promise<Initiative> => {
			return await createInitiative(roadmapId, milestoneId, data);
		},
		[roadmapId, createInitiative],
	);

	const handleDeleteMilestone = useCallback(
		async (milestoneId: string) => {
			await deleteMilestone(roadmapId, milestoneId);
		},
		[roadmapId, deleteMilestone],
	);

	const handleDeleteInitiative = useCallback(
		async (initiativeId: string) => {
			await deleteInitiative(roadmapId, initiativeId);
		},
		[roadmapId, deleteInitiative],
	);

	const handleUpdateVision = useCallback(
		async (content: string) => {
			await updateVision(roadmapId, content);
		},
		[roadmapId, updateVision],
	);

	const handleReorderMilestones = useCallback(
		(reorderedIds: { id: string; sortOrder: number }[]) => {
			for (const item of reorderedIds) {
				updateMilestone(roadmapId, item.id, { sortOrder: item.sortOrder });
			}
		},
		[roadmapId, updateMilestone],
	);

	const handleReorderInitiatives = useCallback(
		(
			_milestoneId: string,
			reorderedIds: { id: string; sortOrder: number }[],
		) => {
			for (const item of reorderedIds) {
				updateInitiative(roadmapId, item.id, { sortOrder: item.sortOrder });
			}
		},
		[roadmapId, updateInitiative],
	);

	if (roadmapsLoading && !roadmap) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Loading roadmap...</p>
			</div>
		);
	}

	if (!roadmap) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Roadmap not found</p>
			</div>
		);
	}

	return (
		<RoadmapView
			roadmap={roadmap}
			milestones={details?.milestones ?? []}
			initiatives={details?.initiatives ?? []}
			vision={details?.vision}
			dependencies={details?.dependencies ?? []}
			conversation={conversation}
			onUpdateTitle={handleUpdateTitle}
			onUpdateVision={handleUpdateVision}
			onDelete={handleDelete}
			onSendMessage={handleSendMessage}
			onUpdateMilestone={handleUpdateMilestone}
			onUpdateInitiative={handleUpdateInitiative}
			onCreateMilestone={handleCreateMilestone}
			onCreateInitiative={handleCreateInitiative}
			onDeleteMilestone={handleDeleteMilestone}
			onDeleteInitiative={handleDeleteInitiative}
			onReorderMilestones={handleReorderMilestones}
			onReorderInitiatives={handleReorderInitiatives}
		/>
	);
}
