/**
 * RoadmapViewContainer - Container component for RoadmapView
 *
 * Owns data fetching and state management for a specific roadmap,
 * driven by URL parameter. Connects to useRoadmapStore and passes
 * extracted data to the presentational RoadmapView component.
 */

import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadmapView } from "./RoadmapView";

interface RoadmapViewContainerProps {
	roadmapId: string;
}

export function RoadmapViewContainer({ roadmapId }: RoadmapViewContainerProps) {
	const [, setLocation] = useLocation();

	const {
		roadmaps,
		roadmapsLoading,
		roadmapDetails,
		conversations,
		selectRoadmap,
		fetchRoadmapDetails,
		fetchHistory,
		updateRoadmap,
		deleteRoadmap,
		sendMessage,
	} = useRoadmapStore();

	const roadmap = roadmaps.find((r) => r.id === roadmapId);
	const details = roadmapDetails.get(roadmapId);
	const conversation = conversations.get(roadmapId);

	// Select roadmap and fetch details + history when roadmapId changes
	useEffect(() => {
		selectRoadmap(roadmapId);
		fetchRoadmapDetails(roadmapId);
		if (!conversation) {
			fetchHistory(roadmapId);
		}
	}, [
		roadmapId,
		conversation,
		selectRoadmap,
		fetchRoadmapDetails,
		fetchHistory,
	]);

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
			onDelete={handleDelete}
			onSendMessage={handleSendMessage}
		/>
	);
}
