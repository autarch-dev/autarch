import {
	Check,
	Circle,
	Eye,
	ListTodo,
	Play,
	Search,
	Target,
} from "lucide-react";
import type { WorkflowStatus } from "@/shared/schemas/workflow";

export const statusConfig = {
	backlog: {
		label: "Backlog",
		icon: Circle,
		color: "text-muted-foreground",
		bg: "bg-muted",
	},
	scoping: {
		label: "Scoping",
		icon: Target,
		color: "text-purple-500",
		bg: "bg-purple-500/10",
	},
	researching: {
		label: "Researching",
		icon: Search,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
	planning: {
		label: "Planning",
		icon: ListTodo,
		color: "text-cyan-500",
		bg: "bg-cyan-500/10",
	},
	in_progress: {
		label: "In Progress",
		icon: Play,
		color: "text-yellow-500",
		bg: "bg-yellow-500/10",
	},
	review: {
		label: "Review",
		icon: Eye,
		color: "text-orange-500",
		bg: "bg-orange-500/10",
	},
	done: {
		label: "Done",
		icon: Check,
		color: "text-green-500",
		bg: "bg-green-500/10",
	},
} as const;

export const workflowPhases: WorkflowStatus[] = [
	"scoping",
	"researching",
	"planning",
	"in_progress",
	"review",
	"done",
];
