/**
 * ReviewDialogs - All dialogs for ReviewCardApproval
 * - Approve and Merge dialog
 * - Request Fixes dialog
 * - Deny (Request Changes) dialog
 * - Rerun Review dialog
 */

import { GitMerge, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MergeStrategy } from "@/shared/schemas/workflow";

interface DenyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	feedback: string;
	onFeedbackChange: (value: string) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
}

export function DenyDialog({
	open,
	onOpenChange,
	feedback,
	onFeedbackChange,
	onSubmit,
	isSubmitting,
}: DenyDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Request Changes</DialogTitle>
					<DialogDescription>
						Provide feedback for the review to be revised.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<Textarea
						value={feedback}
						onChange={(e) => onFeedbackChange(e.target.value)}
						placeholder="e.g., Please review the error handling more thoroughly..."
						rows={4}
						autoFocus
					/>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={onSubmit}
						disabled={isSubmitting || !feedback.trim()}
					>
						Submit Feedback
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface RewindDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
}

export function RewindDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting,
}: RewindDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Rerun Review</DialogTitle>
					<DialogDescription>
						This will clear all existing review comments and restart the review
						agent. The execution results and changes will be preserved.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onSubmit}
						disabled={isSubmitting}
					>
						<RotateCcw className="size-4 mr-1" />
						Rerun Review
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface RequestFixesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedCount: number;
	fixesSummary: string;
	onFixesSummaryChange: (value: string) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	selectedCommentIds: Set<string>;
}

export function RequestFixesDialog({
	open,
	onOpenChange,
	selectedCount,
	fixesSummary,
	onFixesSummaryChange,
	onSubmit,
	isSubmitting,
	selectedCommentIds,
}: RequestFixesDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Request Fixes</DialogTitle>
					<DialogDescription>
						{selectedCount} comment{selectedCount !== 1 ? "s" : ""} selected to
						be addressed.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<Textarea
						value={fixesSummary}
						onChange={(e) => onFixesSummaryChange(e.target.value)}
						placeholder="Optional: Add any additional context or instructions..."
						rows={4}
						autoFocus
					/>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={onSubmit}
						disabled={
							isSubmitting ||
							(selectedCommentIds.size === 0 && !fixesSummary.trim())
						}
					>
						Submit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface ApproveDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedStrategy: MergeStrategy;
	onStrategyChange: (value: MergeStrategy) => void;
	commitMessage: string;
	onCommitMessageChange: (value: string) => void;
	mergeErrorMessage: string | null;
	onSubmit: () => void;
	isSubmitting: boolean;
	isFetchingDefault: boolean;
}

export function ApproveDialog({
	open,
	onOpenChange,
	selectedStrategy,
	onStrategyChange,
	commitMessage,
	onCommitMessageChange,
	mergeErrorMessage,
	onSubmit,
	isSubmitting,
	isFetchingDefault,
}: ApproveDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(openState) => {
				onOpenChange(openState);
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Approve and Merge</DialogTitle>
					<DialogDescription>
						Choose a merge strategy and confirm the commit message.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="merge-strategy">Merge Strategy</Label>
						<Select
							value={selectedStrategy}
							onValueChange={(value) =>
								onStrategyChange(value as MergeStrategy)
							}
							disabled={isFetchingDefault}
						>
							<SelectTrigger id="merge-strategy">
								{isFetchingDefault ? (
									<span className="flex items-center gap-2">
										<Loader2 className="size-4 animate-spin" />
										Loading...
									</span>
								) : (
									<SelectValue placeholder="Select merge strategy" />
								)}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="fast-forward">Fast-forward</SelectItem>
								<SelectItem value="squash">Squash</SelectItem>
								<SelectItem value="merge-commit">Merge commit</SelectItem>
								<SelectItem value="rebase">Rebase and merge</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="commit-message">Commit Message</Label>
						<Textarea
							id="commit-message"
							value={commitMessage}
							onChange={(e) => onCommitMessageChange(e.target.value)}
							placeholder={
								selectedStrategy === "fast-forward"
									? "Not required for fast-forward merge"
									: "Enter commit message..."
							}
							rows={4}
							disabled={selectedStrategy === "fast-forward"}
						/>
						{selectedStrategy === "fast-forward" && (
							<p className="text-xs text-muted-foreground">
								Fast-forward merges don't create a new commit, so no message is
								needed.
							</p>
						)}
					</div>
					{mergeErrorMessage && (
						<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{mergeErrorMessage}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={onSubmit}
						disabled={
							isSubmitting ||
							isFetchingDefault ||
							(selectedStrategy !== "fast-forward" && !commitMessage.trim())
						}
					>
						{isSubmitting && <Loader2 className="size-4 mr-1 animate-spin" />}
						<GitMerge className="size-4 mr-1" />
						Approve and Merge
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
