import type { MessageQuestion } from "@/shared/schemas/channel";

export interface QuestionBlockProps {
	questions: MessageQuestion[];
	/** Called when user submits answers. Comment is optional additional feedback. */
	onAnswer?: (
		answers: Array<{ questionId: string; answer: unknown }>,
		comment?: string,
	) => void;
	disabled?: boolean;
}

export interface SingleQuestionProps {
	question: MessageQuestion;
	value: unknown;
	onChange: (value: unknown) => void;
	disabled?: boolean;
}
