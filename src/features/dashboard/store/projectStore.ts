/**
 * Project Store
 *
 * Manages project metadata (name, path, icon availability).
 */

import { create } from "zustand";
import type { ProjectInfo } from "@/shared/schemas/project";
import { fetchProjectInfo } from "../api/projectApi";

// =============================================================================
// Store State
// =============================================================================

interface ProjectState {
	/** Project info, null if not yet loaded */
	project: ProjectInfo | null;
	/** Loading state */
	isLoading: boolean;
	/** Error message if fetch failed */
	error: string | null;

	// Actions
	fetchProject: () => Promise<void>;
}

// =============================================================================
// Store
// =============================================================================

export const useProjectStore = create<ProjectState>((set, get) => ({
	project: null,
	isLoading: false,
	error: null,

	fetchProject: async () => {
		// Skip if already loaded or loading
		if (get().project || get().isLoading) {
			return;
		}

		set({ isLoading: true, error: null });

		try {
			const project = await fetchProjectInfo();
			set({ project, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to fetch project info",
				isLoading: false,
			});
		}
	},
}));
