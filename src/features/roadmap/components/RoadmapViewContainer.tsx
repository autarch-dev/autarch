/**
 * RoadmapViewContainer - Container component for RoadmapView
 *
 * Owns data fetching and state management for a specific roadmap,
 * driven by URL parameter. Placeholder until full view is implemented.
 */

import { useEffect } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

interface RoadmapViewContainerProps {
	roadmapId: string;
}

export function RoadmapViewContainer({ roadmapId }: RoadmapViewContainerProps) {
	const { roadmaps, roadmapsLoading, selectRoadmap, fetchRoadmapDetails } =
		useRoadmapStore();

	const roadmap = roadmaps.find((r) => r.id === roadmapId);

	// Select roadmap and fetch details when roadmapId changes
	useEffect(() => {
		selectRoadmap(roadmapId);
		fetchRoadmapDetails(roadmapId);
	}, [roadmapId, selectRoadmap, fetchRoadmapDetails]);

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
		<div className="flex items-center justify-center h-full">
			<div className="text-center space-y-2">
				<h2 className="text-lg font-semibold">{roadmap.title}</h2>
				<p className="text-sm text-muted-foreground">
					Status: {roadmap.status}
				</p>
			</div>
		</div>
	);
}
