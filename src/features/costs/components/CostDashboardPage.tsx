/**
 * CostDashboardPage - Main cost analytics dashboard
 *
 * Reads a 'range' URL query param on mount to initialize the preset, then
 * fetches all cost data. Renders a preset dropdown alongside the page title.
 */

import { useEffect } from "react";
import { useSearch } from "wouter";
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
	const search = useSearch();

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
		</div>
	);
}
