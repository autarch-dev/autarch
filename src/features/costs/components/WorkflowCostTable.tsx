/**
 * WorkflowCostTable - Per-workflow cost breakdown table
 *
 * Displays a shadcn Table inside a Card with per-workflow cost data.
 * Rows are sorted by totalCost descending. Each workflow title links
 * to the workflow detail page for cross-linking.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCostStore } from "../store/costStore";

export function WorkflowCostTable() {
	const { data, loading, error } = useCostStore((s) => s.byWorkflow);

	const sortedData = useMemo(() => {
		if (!data) return [];
		return [...data].sort((a, b) => b.totalCost - a.totalCost);
	}, [data]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost by Workflow</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : sortedData.length === 0 ? (
					<p className="text-muted-foreground">No cost data found</p>
				) : (
					<div className="overflow-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Workflow Title</TableHead>
									<TableHead className="text-right">Total Cost</TableHead>
									<TableHead className="text-right">Prompt Tokens</TableHead>
									<TableHead className="text-right">
										Completion Tokens
									</TableHead>
									<TableHead className="text-right">Records</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedData.map((row) => (
									<TableRow key={row.workflowId}>
										<TableCell>
											<Link
												href={`/workflow/${row.workflowId}`}
												className="text-primary hover:underline"
											>
												{row.workflowTitle ?? "(Untitled)"}
											</Link>
										</TableCell>
										<TableCell className="text-right">
											${row.totalCost.toFixed(2)}
										</TableCell>
										<TableCell className="text-right">
											{row.promptTokens.toLocaleString()}
										</TableCell>
										<TableCell className="text-right">
											{row.completionTokens.toLocaleString()}
										</TableCell>
										<TableCell className="text-right">
											{row.count.toLocaleString()}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
