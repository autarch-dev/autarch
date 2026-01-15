export const statusColors = {
	backlog: "text-muted-foreground",
	scoping: "text-purple-500",
	researching: "text-blue-500",
	planning: "text-cyan-500",
	in_progress: "text-yellow-500",
	review: "text-orange-500",
	done: "text-green-500",
} as const;

export const priorityBorders = {
	low: "",
	medium: "border-l-2 border-l-blue-500 rounded-l-none",
	high: "border-l-2 border-l-orange-500 rounded-l-none",
	urgent: "border-l-2 border-l-red-500 rounded-l-none",
} as const;
