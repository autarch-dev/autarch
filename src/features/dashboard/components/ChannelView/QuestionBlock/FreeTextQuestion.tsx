import { Textarea } from "@/components/ui/textarea";
import type { SingleQuestionProps } from "./types";

export function FreeTextQuestion({
	question: _question,
	value,
	onChange,
	disabled,
}: SingleQuestionProps) {
	const textValue = typeof value === "string" ? value : "";

	return (
		<Textarea
			value={textValue}
			onChange={(e) => onChange(e.target.value)}
			placeholder="Type your answer..."
			disabled={disabled}
			rows={3}
			className="resize-none"
		/>
	);
}
