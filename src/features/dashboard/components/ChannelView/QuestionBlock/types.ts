import type { MessageQuestion } from "@/shared/schemas/channel";

export interface QuestionBlockProps {
	questions: MessageQuestion[];
	/** Called when user submits answers. Comment is optional additional feedback. */
	onAnswer?: (
		answers: Array<{ questionId: string; answer: unknown }>,
		comment?: string,
	) => void;
	disabled?: boolean;
	/** User comment/feedback provided when questions were submitted (for display) */
	questionsComment?: string;
}

export interface SingleQuestionProps {
	question: MessageQuestion;
	value: unknown;
	onChange: (value: unknown) => void;
	disabled?: boolean;
}
