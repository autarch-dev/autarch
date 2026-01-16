import type { MessageQuestion } from "@/shared/schemas/channel";

export interface QuestionBlockProps {
	questions: MessageQuestion[];
	onAnswer?: (answers: Array<{ questionId: string; answer: unknown }>) => void;
	disabled?: boolean;
}

export interface SingleQuestionProps {
	question: MessageQuestion;
	value: unknown;
	onChange: (value: unknown) => void;
	disabled?: boolean;
}
