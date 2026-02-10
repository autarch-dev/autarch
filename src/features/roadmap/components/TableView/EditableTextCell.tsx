import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function EditableTextCell({
	value,
	onSave,
	className,
	startInEditMode = false,
	onCancel,
	initialEditValue = "",
}: {
	value: string;
	onSave: (value: string) => void;
	className?: string;
	startInEditMode?: boolean;
	onCancel?: () => void;
	initialEditValue?: string;
}) {
	const [isEditing, setIsEditing] = useState(startInEditMode);
	const [editValue, setEditValue] = useState(
		startInEditMode ? initialEditValue : value,
	);

	const handleStartEdit = (e: React.MouseEvent<unknown>) => {
		e.stopPropagation();
		setEditValue(value);
		setIsEditing(true);
	};

	const handleSave = () => {
		const trimmed = editValue.trim();
		if (!trimmed && onCancel) {
			onCancel();
			setIsEditing(false);
			return;
		}
		if (trimmed && (trimmed !== value || onCancel)) {
			onSave(trimmed);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			if (onCancel) {
				onCancel();
				setIsEditing(false);
			} else {
				setEditValue(value);
				setIsEditing(false);
			}
		}
	};

	if (isEditing) {
		return (
			<Input
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onClick={(e) => e.stopPropagation()}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				className={cn("h-7 text-sm", className)}
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			className={cn(
				"text-left bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 truncate",
				className,
			)}
			onClick={handleStartEdit}
			title="Click to edit"
		>
			{value}
		</button>
	);
}
