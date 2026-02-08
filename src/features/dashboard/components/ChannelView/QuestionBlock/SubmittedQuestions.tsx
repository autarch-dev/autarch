import { MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { MessageQuestion } from "@/shared/schemas/channel";

interface SubmittedQuestionsProps {
	questions: MessageQuestion[];
	comment?: string;
}

function renderAnswer(question: MessageQuestion) {
	if (question.status === "skipped" || question.answer == null) {
		return <p className="text-sm text-muted-foreground italic">Skipped</p>;
	}

	switch (question.type) {
		case "single_select":
			return <p className="text-sm">{question.answer as string}</p>;

		case "multi_select": {
			const items = question.answer as string[];
			return (
				<p className="text-sm">
					{items.map((item, i) => (
						<span key={item}>
							{i > 0 && ", "}
							{item}
						</span>
					))}
				</p>
			);
		}

		case "ranked": {
			const ranked = question.answer as string[];
			return (
				<ol className="list-decimal list-inside text-sm space-y-1">
					{ranked.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ol>
			);
		}

		case "free_text":
			return <p className="text-sm">{question.answer as string}</p>;
	}
}

export function SubmittedQuestions({
	questions,
	comment,
}: SubmittedQuestionsProps) {
	const sorted = [...questions].sort(
		(a, b) => a.questionIndex - b.questionIndex,
	);

	return (
		<div className="space-y-4">
			{sorted.map((question) => (
				<div key={question.id} className="space-y-3">
					<Label className="text-sm font-medium">{question.prompt}</Label>
					{renderAnswer(question)}
				</div>
			))}
			{comment && (
				<div className="pt-2 border-t border-green-500/20">
					<div className="flex items-start gap-2 text-sm">
						<MessageSquare className="size-4 text-green-600 mt-0.5 shrink-0" />
						<div>
							<span className="font-medium text-green-600">Your comment:</span>
							<p className="text-muted-foreground mt-1">{comment}</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
