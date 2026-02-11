/**
 * SummaryCard - Headline cost summary card
 *
 * Displays total spend as a large formatted dollar amount with secondary
 * metrics for prompt tokens, completion tokens, and record count.
 */

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useCostStore } from "../store/costStore";

/** Format a number as a dollar amount with 2 decimal places */
function formatDollars(amount: number): string {
	return `$${amount.toFixed(2)}`;
}

/** Format a large number with comma separators */
function formatNumber(n: number): string {
	return n.toLocaleString();
}

export function SummaryCard() {
	const { data, loading, error } = useCostStore((s) => s.summary);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Total Spend</CardTitle>
				<CardDescription>Cumulative cost across all records</CardDescription>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : (
					<>
						<p className="text-4xl font-bold tracking-tight">
							{data ? formatDollars(data.totalCost) : "$0.00"}
						</p>
						<div className="mt-4 grid grid-cols-3 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground">Prompt Tokens</p>
								<p className="font-medium">
									{data ? formatNumber(data.promptTokens) : "0"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Completion Tokens</p>
								<p className="font-medium">
									{data ? formatNumber(data.completionTokens) : "0"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Records</p>
								<p className="font-medium">
									{data ? formatNumber(data.count) : "0"}
								</p>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
