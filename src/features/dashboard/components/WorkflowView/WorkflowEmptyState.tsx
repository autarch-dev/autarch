import { AlertCircle } from "lucide-react";

export function WorkflowEmptyState() {
	return (
		<div className="px-4 py-8 text-center">
			<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
				<AlertCircle className="size-6 text-muted-foreground" />
			</div>
			<h4 className="font-medium mb-1">No messages yet</h4>
			<p className="text-sm text-muted-foreground max-w-sm mx-auto">
				Start by describing what you want to accomplish. Autarch will guide you
				through the workflow.
			</p>
		</div>
	);
}
