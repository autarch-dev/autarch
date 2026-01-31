import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettings } from "../hooks/useSettings";

// =============================================================================
// Approval Row Component
// =============================================================================

interface ApprovalRowProps {
	command: string;
	onDelete: () => void;
	disabled: boolean;
}

function ApprovalRow({ command, onDelete, disabled }: ApprovalRowProps) {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const handleDelete = () => {
		onDelete();
		setShowDeleteConfirm(false);
	};

	if (showDeleteConfirm) {
		return (
			<div className="group py-3 space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-sm text-zinc-200">Remove this approval?</span>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={handleDelete}
							disabled={disabled}
							className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
						>
							Confirm
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowDeleteConfirm(false)}
							disabled={disabled}
							className="h-7 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="group flex items-center justify-between py-3 gap-4">
			<div className="min-w-0 flex-1">
				<code className="text-sm text-zinc-200 font-mono break-all">
					{command}
				</code>
			</div>
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setShowDeleteConfirm(true)}
					disabled={disabled}
					className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
					title="Delete"
				>
					<Trash2 className="w-3.5 h-3.5" />
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Persistent Approvals Section Component
// =============================================================================

export function PersistentApprovalsSection() {
	const {
		persistentApprovals,
		loadPersistentApprovals,
		removePersistentApproval,
		isLoading,
	} = useSettings();

	useEffect(() => {
		loadPersistentApprovals();
	}, [loadPersistentApprovals]);

	const handleDelete = async (command: string) => {
		await removePersistentApproval(command);
	};

	return (
		<section>
			<div className="flex items-baseline justify-between mb-4">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
					Persistent Shell Approvals
				</h3>
				<span className="text-xs text-zinc-600">
					{persistentApprovals.length}{" "}
					{persistentApprovals.length === 1 ? "approval" : "approvals"}
				</span>
			</div>

			{persistentApprovals.length === 0 ? (
				<div className="py-6 text-center text-zinc-500 text-sm">
					<p>No persistent approvals.</p>
					<p className="text-xs mt-1">
						Approve a command with "Always allow during Preflight" to add one.
					</p>
				</div>
			) : (
				<div className="divide-y divide-zinc-800/50">
					{persistentApprovals.map((command) => (
						<ApprovalRow
							key={command}
							command={command}
							onDelete={() => handleDelete(command)}
							disabled={isLoading}
						/>
					))}
				</div>
			)}
		</section>
	);
}
