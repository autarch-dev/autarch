/**
 * QuestionBlock - Renders agent questions requiring user input
 *
 * Supports different question types:
 * - single_select: Radio group
 * - multi_select: Checkboxes
 * - ranked: Ordered selection (checkboxes with order indicators)
 * - free_text: Text area
 *
 * Collapsed when answered, expanded when pending.
 */

import {
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Loader2,
	MessageSquare,
	Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MessageQuestion } from "@/shared/schemas/channel";
import { FreeTextQuestion } from "./FreeTextQuestion";
import { MultiSelectQuestion } from "./MultiSelectQuestion";
import { RankedQuestion } from "./RankedQuestion";
import { SingleSelectQuestion } from "./SingleSelectQuestion";
import type { QuestionBlockProps } from "./types";

const QUESTION_COMPONENTS = {
	single_select: SingleSelectQuestion,
	multi_select: MultiSelectQuestion,
	ranked: RankedQuestion,
	free_text: FreeTextQuestion,
} as const;

export function QuestionBlock({
	questions,
	onAnswer,
	disabled,
	questionsComment,
}: QuestionBlockProps) {
	// Block is submitted if NO questions are pending (all are "answered" or "skipped")
	// This happens after any submission, even if all questions were skipped
	const hasBeenSubmitted = questions.every((q) => q.status !== "pending");

	const [answers, setAnswers] = useState<Map<string, unknown>>(new Map());
	const [comment, setComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	// Auto-collapse if already submitted
	const [isExpanded, setIsExpanded] = useState(!hasBeenSubmitted);

	// Collapse when questions are submitted
	useEffect(() => {
		if (hasBeenSubmitted) {
			setIsExpanded(false);
		}
	}, [hasBeenSubmitted]);

	// Check if user has provided at least one answer
	const hasAnyAnswer = questions.some((q) => {
		if (q.status === "answered") return false; // Don't count already-answered
		const answer = answers.get(q.id);
		if (answer === undefined || answer === null) return false;
		if (typeof answer === "string" && answer.trim() === "") return false;
		if (Array.isArray(answer) && answer.length === 0) return false;
		return true;
	});

	// Check if comment has content
	const hasComment = comment.trim().length > 0;

	// Can submit if either at least one question is answered OR comment has content
	const canSubmit = hasAnyAnswer || hasComment;

	const pendingQuestions = questions.filter((q) => q.status === "pending");
	const answeredQuestions = questions.filter((q) => q.status === "answered");

	const handleAnswerChange = useCallback(
		(questionId: string, value: unknown) => {
			setAnswers((prev) => {
				const next = new Map(prev);
				next.set(questionId, value);
				return next;
			});
		},
		[],
	);

	const handleSubmit = useCallback(async () => {
		if (!onAnswer || !canSubmit) return;

		setIsSubmitting(true);
		try {
			// Only include questions that have answers
			const answersToSubmit = pendingQuestions
				.filter((q) => {
					const answer = answers.get(q.id);
					if (answer === undefined || answer === null) return false;
					if (typeof answer === "string" && answer.trim() === "") return false;
					if (Array.isArray(answer) && answer.length === 0) return false;
					return true;
				})
				.map((q) => ({
					questionId: q.id,
					answer: answers.get(q.id),
				}));
			await onAnswer(answersToSubmit, comment.trim() || undefined);
		} finally {
			setIsSubmitting(false);
		}
	}, [onAnswer, canSubmit, pendingQuestions, answers, comment]);

	const renderQuestion = (question: MessageQuestion) => {
		const value =
			question.status === "answered"
				? question.answer
				: answers.get(question.id);
		const isAnswered = question.status === "answered";

		const QuestionComponent = QUESTION_COMPONENTS[question.type];

		return (
			<div key={question.id} className="space-y-3">
				<Label className="text-sm font-medium">{question.prompt}</Label>
				<QuestionComponent
					question={question}
					value={value}
					onChange={(v) => handleAnswerChange(question.id, v)}
					disabled={disabled || isAnswered || isSubmitting}
				/>
			</div>
		);
	};

	// If submitted (no pending questions), show collapsed read-only view with green "approved" styling
	if (hasBeenSubmitted) {
		const answeredCount = questions.filter(
			(q) => q.status === "answered",
		).length;
		const skippedCount = questions.filter((q) => q.status === "skipped").length;

		let statusText = "";
		if (answeredCount > 0 && skippedCount > 0) {
			statusText = `${answeredCount} answered, ${skippedCount} skipped`;
		} else if (answeredCount > 0) {
			statusText = `${answeredCount} question${answeredCount !== 1 ? "s" : ""} answered`;
		} else {
			statusText = `${skippedCount} question${skippedCount !== 1 ? "s" : ""} skipped`;
		}

		return (
			<Collapsible
				open={isExpanded}
				onOpenChange={setIsExpanded}
				className="my-3"
			>
				<div
					className={cn(
						"rounded-lg border",
						"border-green-500/30 bg-green-500/5",
					)}
				>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							className="w-full justify-start gap-2 p-3 h-auto font-medium text-green-600 hover:text-green-700 hover:bg-green-500/10"
						>
							{isExpanded ? (
								<ChevronDown className="size-4" />
							) : (
								<ChevronRight className="size-4" />
							)}
							<CheckCircle className="size-4" />
							{statusText}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="px-4 pb-4 space-y-4">
							{questions.map(renderQuestion)}
							{/* Show user's comment if provided */}
							{questionsComment && (
								<div className="pt-2 border-t border-green-500/20">
									<div className="flex items-start gap-2 text-sm">
										<MessageSquare className="size-4 text-green-600 mt-0.5 shrink-0" />
										<div>
											<span className="font-medium text-green-600">
												Your comment:
											</span>
											<p className="text-muted-foreground mt-1">
												{questionsComment}
											</p>
										</div>
									</div>
								</div>
							)}
						</div>
					</CollapsibleContent>
				</div>
			</Collapsible>
		);
	}

	// Show pending questions with submit button
	return (
		<Card className="my-3 py-4 gap-4">
			<CardHeader className="pb-0 py-0">
				<CardTitle className="text-sm flex items-center gap-2">
					Questions
					{pendingQuestions.length > 0 && (
						<span className="text-xs font-normal text-muted-foreground">
							({pendingQuestions.length} pending)
						</span>
					)}
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Answered questions note */}
				{answeredQuestions.length > 0 && (
					<p className="text-xs text-muted-foreground rounded-md bg-muted/30 p-2">
						{answeredQuestions.length} already answered
					</p>
				)}

				{/* Pending questions */}
				{pendingQuestions.map(renderQuestion)}

				{/* Additional comments */}
				<div className="space-y-2 pt-2 border-t">
					<Label
						htmlFor="question-comment"
						className="text-sm font-medium text-muted-foreground"
					>
						Additional comments (optional)
					</Label>
					<Textarea
						id="question-comment"
						placeholder="Add any additional context or feedback..."
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						disabled={disabled || isSubmitting}
						className="min-h-[80px] resize-none"
					/>
				</div>
			</CardContent>

			{/* Submit button */}
			{pendingQuestions.length > 0 && onAnswer && (
				<CardFooter className="flex-col gap-2">
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit || isSubmitting || disabled}
						size="sm"
						className="w-full"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="size-4 mr-2 animate-spin" />
								Submitting...
							</>
						) : (
							<>
								<Send className="size-4 mr-2" />
								Submit
							</>
						)}
					</Button>
					<p className="text-xs text-muted-foreground text-center">
						Answer at least one question or add a comment to submit
					</p>
				</CardFooter>
			)}
		</Card>
	);
}
