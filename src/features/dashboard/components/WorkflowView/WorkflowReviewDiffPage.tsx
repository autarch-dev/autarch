import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useWorkflowsStore } from "../../store/workflowsStore";
import { DiffViewer, type AddCommentPayload } from "./DiffViewer";

interface WorkflowReviewDiffPageProps {
	workflowId: string;
	reviewId: string;
}

export function WorkflowReviewDiffPage({
	workflowId,
	reviewId,
}: WorkflowReviewDiffPageProps) {
	const fetchHistory = useWorkflowsStore((state) => state.fetchHistory);
	const createReviewComment = useWorkflowsStore(
		(state) => state.createReviewComment,
	);
	const workflow = useWorkflowsStore((state) =>
		state.workflows.find((w) => w.id === workflowId),
	);
	const reviewCards = useWorkflowsStore(
		(state) => state.reviewCards.get(workflowId) ?? [],
	);

	const [diff, setDiff] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reviewCard = useMemo(
		() =>
			reviewCards.find((card) => card.id === reviewId) ??
			reviewCards[reviewCards.length - 1] ??
			null,
		[reviewCards, reviewId],
	);

	useEffect(() => {
		fetchHistory(workflowId).catch((err: unknown) => {
			console.error("Failed to load workflow history:", err);
		});
	}, [workflowId, fetchHistory]);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		async function loadDiff() {
			try {
				const response = await fetch(
					`/api/workflows/${workflowId}/diff?reviewId=${encodeURIComponent(reviewId)}`,
				);
				if (!response.ok) {
					throw new Error("Failed to fetch diff");
				}
				const data = (await response.json()) as { diff?: string };
				if (!cancelled) {
					setDiff(data.diff ?? "");
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load diff");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		loadDiff();

		return () => {
			cancelled = true;
		};
	}, [workflowId, reviewId]);

	const handleAddComment = async (payload: AddCommentPayload) => {
		await createReviewComment(workflowId, {
			type: payload.type,
			filePath: payload.filePath,
			startLine: payload.startLine,
			description: payload.description,
		});
	};

	return (
		<div className="flex h-full flex-col">
			<header className="border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex w-full items-center justify-between gap-4">
					<div className="min-w-0">
						<div className="mb-1 flex items-center gap-2 text-muted-foreground">
							<Link href={`/workflow/${workflowId}`}>
								<Button variant="ghost" size="sm" className="h-7 px-2">
									<ArrowLeft className="mr-1 size-4" />
									Back to Workflow
								</Button>
							</Link>
						</div>
						<div className="flex items-center gap-2">
							<GitCompareArrows className="size-4 text-primary" />
							<h2 className="truncate text-base font-semibold">
								{workflow?.title ?? "Workflow"} · Review Diff
							</h2>
						</div>
					</div>
					{reviewCard && (
						<div className="text-xs text-muted-foreground">
							Review card: {reviewCard.id}
						</div>
					)}
				</div>
			</header>

			<div className="flex h-full w-full flex-1 min-h-0 pb-6">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						Loading diff...
					</div>
				) : error ? (
					<div className="flex flex-1 items-center justify-center text-sm text-destructive">
						{error}
					</div>
				) : (
					<ErrorBoundary featureName="Workflow Review Diff">
						<DiffViewer
							diff={diff}
							comments={reviewCard?.comments}
							onAddComment={handleAddComment}
							className="h-full w-full"
							singleFileMode
						/>
					</ErrorBoundary>
				)}
			</div>
		</div>
	);
}

