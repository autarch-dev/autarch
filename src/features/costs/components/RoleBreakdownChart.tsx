/**
 * RoleBreakdownChart - Cost distribution by agent role
 *
 * Recharts PieChart showing how costs are distributed across agent roles.
 * Uses ROLE_DISPLAY_LABELS for human-readable slice labels and distinct
 * colors per entry via Recharts Cell elements.
 */

import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_DISPLAY_LABELS } from "@/shared/schemas/costs";
import type { ModelScenario } from "@/shared/schemas/settings";
import { useCostStore } from "../store/costStore";

const COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

export function RoleBreakdownChart() {
	const { data, loading, error } = useCostStore((s) => s.byRole);

	const chartData = (data ?? []).map((entry) => ({
		name:
			ROLE_DISPLAY_LABELS[entry.agentRole as ModelScenario] ?? entry.agentRole,
		value: entry.totalCost,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost by Role</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : chartData.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
							<Legend />
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="50%"
								outerRadius={100}
								label
							>
								{chartData.map((entry, index) => (
									<Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
