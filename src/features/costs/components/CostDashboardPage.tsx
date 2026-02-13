/**
 * CostDashboardPage - Main cost analytics dashboard
 *
 * Reads a 'range' URL query param on mount to initialize the preset, then
 * fetches all cost data. Renders a preset dropdown alongside the page title.
 */

import { DollarSign } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { PRESET_LABELS, type TimeRangePreset } from "@/shared/schemas/costs";
import { useCostStore } from "../store/costStore";
import { ModelBreakdownChart } from "./ModelBreakdownChart";
import { RoleBreakdownChart } from "./RoleBreakdownChart";
import { SummaryCard } from "./SummaryCard";
import { TokenUsageChart } from "./TokenUsageChart";
import { TrendChart } from "./TrendChart";
import { WorkflowCostTable } from "./WorkflowCostTable";

/** All valid preset keys for URL param validation */
const VALID_PRESETS = new Set<string>(Object.keys(PRESET_LABELS));

function isTimeRangePreset(value: string): value is TimeRangePreset {
	return VALID_PRESETS.has(value);
}

export function CostDashboardPage() {
	const preset = useCostStore((s) => s.preset);
	const setPreset = useCostStore((s) => s.setPreset);
	const fetchAll = useCostStore((s) => s.fetchAll);
	const summary = useCostStore((s) => s.summary);
	const search = useSearch();

	const isEmpty =
		!summary.loading && summary.data !== null && summary.data.count === 0;

	useEffect(() => {
		const params = new URLSearchParams(search);
		const range = params.get("range");
		if (range && isTimeRangePreset(range)) {
			setPreset(range);
		} else {
			fetchAll();
		}
	}, [search, setPreset, fetchAll]);

	return (
		<div className="flex flex-col gap-6 p-6 overflow-auto h-full">
			<div className="flex items-center gap-3">
				<h1 className="text-2xl font-bold tracking-tight flex items-center">
					Cost Dashboard for
					<Select
						value={preset}
						onValueChange={(v) => setPreset(v as TimeRangePreset)}
					>
						<SelectTrigger className="w-[180px] ml-2">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(
								Object.entries(PRESET_LABELS) as [TimeRangePreset, string][]
							).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</h1>
			</div>
			{summary.loading && summary.data === null ? (
				<p className="text-muted-foreground text-center py-12">
					Loading cost data...
				</p>
			) : isEmpty ? (
				<div className="px-4 py-8 text-center">
					<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
						<DollarSign className="size-6 text-muted-foreground" />
					</div>
					<h4 className="font-medium mb-1">No cost data yet</h4>
					<p className="text-sm text-muted-foreground max-w-sm mx-auto">
						Cost tracking begins automatically when workflows run. You'll see
						spending breakdowns by model, role, and workflow here.
					</p>
					<div className="mt-4 flex items-center justify-center gap-2">
						<Button asChild>
							<Link to="/">Go to Dashboard</Link>
						</Button>
					</div>
				</div>
			) : (
				<>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						<SummaryCard />
					</div>
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<ModelBreakdownChart />
						<TrendChart />
						<TokenUsageChart />
						<RoleBreakdownChart />
					</div>
					<WorkflowCostTable />
				</>
			)}
		</div>
	);
}
