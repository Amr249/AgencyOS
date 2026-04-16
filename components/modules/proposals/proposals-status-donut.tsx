"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { BarChart3, Layers, PieChart as PieChartIcon, Tags } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PROPOSAL_STATUS_LABELS } from "@/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export type ProposalStatusPoint = { status: string; count: number };
export type ProposalServicePoint = { service: string; count: number };

export type ProposalDistributionRow = { label: string; count: number };

function toDistributionRows(
  groupBy: "status" | "service",
  statusDistribution: ProposalStatusPoint[],
  serviceDistribution: ProposalServicePoint[]
): ProposalDistributionRow[] {
  if (groupBy === "status") {
    return statusDistribution.map((d) => ({
      label: PROPOSAL_STATUS_LABELS[d.status] ?? d.status,
      count: d.count,
    }));
  }
  return serviceDistribution.map((d) => ({
    label: d.service,
    count: d.count,
  }));
}

function useDistributionChartModel(data: ProposalDistributionRow[]) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        name: d.label,
        value: d.count,
        fill: COLORS[i % COLORS.length],
      })),
    [data]
  );
  const chartConfig = useMemo(() => {
    const c: ChartConfig = {};
    data.forEach((d, i) => {
      c[`k${i}`] = {
        label: d.label,
        color: COLORS[i % COLORS.length],
      };
    });
    return c;
  }, [data]);
  return { total, chartData, chartConfig };
}

function ProposalsDistributionEmpty() {
  return (
    <p className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
      No proposals yet.
    </p>
  );
}

function shortLabel(text: string, max = 18) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function ProposalsDistributionDonut({ data }: { data: ProposalDistributionRow[] }) {
  const { total, chartData, chartConfig } = useDistributionChartModel(data);

  if (total === 0) {
    return <ProposalsDistributionEmpty />;
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[min(72vw,240px)] w-full max-w-[280px] sm:h-[min(50vw,260px)] sm:max-w-none"
      dir="ltr"
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}`, "Count"]}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="48%"
          outerRadius="82%"
          paddingAngle={2}
          label={({ name, percent }) =>
            `${shortLabel(String(name))} ${(percent * 100).toFixed(0)}%`
          }
        />
      </PieChart>
    </ChartContainer>
  );
}

function ProposalsDistributionColumns({ data }: { data: ProposalDistributionRow[] }) {
  const { total, chartData, chartConfig } = useDistributionChartModel(data);

  if (total === 0) {
    return <ProposalsDistributionEmpty />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full" dir="ltr">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          interval={0}
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => shortLabel(String(v), 14)}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}`, "Count"]}
              labelFormatter={(label) => String(label)}
            />
          }
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Count">
          {chartData.map((entry, i) => (
            <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

type ShapeView = "donut" | "columns";

export function ProposalsStatusChart({
  statusDistribution,
  serviceDistribution,
}: {
  statusDistribution: ProposalStatusPoint[];
  serviceDistribution: ProposalServicePoint[];
}) {
  const [groupBy, setGroupBy] = useState<"status" | "service">("status");
  const [shape, setShape] = useState<ShapeView>("donut");

  const rows = useMemo(
    () => toDistributionRows(groupBy, statusDistribution, serviceDistribution),
    [groupBy, statusDistribution, serviceDistribution]
  );

  const hasData = rows.some((d) => d.count > 0);

  return (
    <div className="space-y-3">
      {hasData ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">Group by</span>
            <ToggleGroup
              type="single"
              value={groupBy}
              onValueChange={(v) => {
                if (v === "status" || v === "service") setGroupBy(v);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="shrink-0"
            >
              <ToggleGroupItem value="status" aria-label="By status" className="gap-1.5 px-2.5">
                <Tags className="size-3.5" />
                <span className="hidden sm:inline">Status</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="service" aria-label="By service" className="gap-1.5 px-2.5">
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Service</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">View</span>
            <ToggleGroup
              type="single"
              value={shape}
              onValueChange={(v) => {
                if (v === "donut" || v === "columns") setShape(v);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="shrink-0"
            >
              <ToggleGroupItem value="donut" aria-label="Donut chart" className="gap-1.5 px-2.5">
                <PieChartIcon className="size-3.5" />
                <span className="hidden sm:inline">Donut</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="columns" aria-label="Column chart" className="gap-1.5 px-2.5">
                <BarChart3 className="size-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      ) : null}
      {shape === "donut" ? (
        <ProposalsDistributionDonut data={rows} />
      ) : (
        <ProposalsDistributionColumns data={rows} />
      )}
    </div>
  );
}
