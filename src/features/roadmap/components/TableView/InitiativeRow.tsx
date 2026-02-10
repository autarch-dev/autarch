/**
 * TableView - Spreadsheet-style view of milestones and initiatives
 *
 * Groups initiatives under collapsible milestone headers.
 * Supports filtering by status/priority/text
 * and inline editing of cells (click to edit, blur/enter to save).
 */

import { GitBranch, MoreHorizontal, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Initiative, InitiativeSizes } from "@/shared/schemas/roadmap";
import { EditableTextCell } from "./EditableTextCell";
import { PrioritySelect } from "./PrioritySelect";
import { StatusSelect } from "./StatusSelect";

export function InitiativeRow({
	initiative,
	dependencyNames,
	hasDependencies: hasDeps,
	onUpdate,
	onSelect,
	onRequestDelete,
}: {
	initiative: Initiative;
	dependencyNames: string[];
	hasDependencies: boolean;
	onUpdate: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress" | "size">
		> & { workflowId?: string | null },
	) => Promise<void>;
	onSelect?: (initiative: Initiative) => void;
	onRequestDelete: (id: string, title: string) => void;
}) {
	const menuOpenRef = useRef(false);

	const handleMenuOpenChange = (open: boolean) => {
		if (!open) {
			menuOpenRef.current = true;
			setTimeout(() => {
				menuOpenRef.current = false;
			}, 0);
		}
	};

	return (
		<TableRow
			className="cursor-pointer"
			onClick={() => {
				if (!menuOpenRef.current) {
					onSelect?.(initiative);
				}
			}}
		>
			<TableCell>
				<div className="flex items-center gap-1.5 pl-3">
					{hasDeps && (
						<GitBranch className="size-3.5 text-amber-500 shrink-0" />
					)}
					<EditableTextCell
						value={initiative.title}
						onSave={(title) => onUpdate(initiative.id, { title })}
					/>
				</div>
			</TableCell>
			<TableCell>
				<StatusSelect
					initiative={initiative}
					onUpdateInitiative={onUpdate}
					onMenuOpenChange={handleMenuOpenChange}
				/>
			</TableCell>
			<TableCell>
				<PrioritySelect
					value={initiative.priority}
					onSave={(priority) => onUpdate(initiative.id, { priority })}
				/>
			</TableCell>
			<TableCell>
				<Select
					value={String(initiative.size ?? "none")}
					onValueChange={(v) =>
						onUpdate(initiative.id, {
							size: v === "none" ? null : (Number(v) as Initiative["size"]),
						})
					}
				>
					<SelectTrigger
						size="sm"
						className="h-7 text-xs border-none shadow-none bg-transparent dark:bg-transparent dark:hover:bg-transparent px-1 gap-1 w-auto"
					>
						<SelectValue placeholder="Unset" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Unset</SelectItem>
						{InitiativeSizes.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<div className="flex items-center justify-between gap-1">
					{dependencyNames.length > 0 && (
						<span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">
							{dependencyNames.join(", ")}
						</span>
					)}
					<DropdownMenu onOpenChange={handleMenuOpenChange}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 ml-auto"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreHorizontal className="size-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => onRequestDelete(initiative.id, initiative.title)}
							>
								<Trash2 className="size-3.5 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TableCell>
		</TableRow>
	);
}
