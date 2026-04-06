/**
 * SummaryCard - Headline cost summary card (full-width)
 *
 * Displays total spend as the hero metric with secondary stats
 * arranged horizontally: total tokens, $/mTok, prompt/completion split, and API calls.
 */

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCostStore } from "../store/costStore";

function formatDollars(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount);
}

function formatNumber(n: number): string {
	return n.toLocaleString();
}

function formatCompact(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toLocaleString();
}

export function SummaryCard() {
	const { data, loading, error } = useCostStore((s) => s.summary);

	const totalTokens = data ? data.promptTokens + data.completionTokens : 0;
	const costPerMTok =
		totalTokens > 0 && data
			? ((data.totalCost / totalTokens) * 1_000_000).toFixed(2)
			: null;

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
					<div className="flex flex-col gap-4">
						<div className="flex items-baseline gap-4">
							<p className="text-4xl font-bold tracking-tight">
								{data ? formatDollars(data.totalCost) : "$0.00"}
							</p>
							{costPerMTok && (
								<p className="text-lg text-muted-foreground">
									${costPerMTok}/mTok
								</p>
							)}
						</div>
						<Separator />
						<div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
							<div>
								<p className="text-muted-foreground">Total Tokens</p>
								<p className="text-lg font-semibold">
									{formatCompact(totalTokens)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Prompt Tokens</p>
								<p className="text-lg font-semibold">
									{data ? formatNumber(data.promptTokens) : "0"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Completion Tokens</p>
								<p className="text-lg font-semibold">
									{data ? formatNumber(data.completionTokens) : "0"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">API Calls</p>
								<p className="text-lg font-semibold">
									{data ? formatNumber(data.count) : "0"}
								</p>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
