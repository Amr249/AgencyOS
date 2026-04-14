"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
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

function useStatusChartModel(data: ProposalStatusPoint[]) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        name: PROPOSAL_STATUS_LABELS[d.status] ?? d.status,
        value: d.count,
        fill: COLORS[i % COLORS.length],
      })),
    [data]
  );
  const chartConfig = useMemo(() => {
    const c: ChartConfig = {};
    data.forEach((d, i) => {
      c[PROPOSAL_STATUS_LABELS[d.status] ?? d.status] = {
        label: PROPOSAL_STATUS_LABELS[d.status] ?? d.status,
        color: COLORS[i % COLORS.length],
      };
    });
    return c;
  }, [data]);
  return { total, chartData, chartConfig };
}

function ProposalsStatusEmpty() {
  return (
    <p className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
      No proposals yet.
    </p>
  );
}

export function ProposalsStatusDonut({ data }: { data: ProposalStatusPoint[] }) {
  const { total, chartData, chartConfig } = useStatusChartModel(data);

  if (total === 0) {
    return <ProposalsStatusEmpty />;
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
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        />
      </PieChart>
    </ChartContainer>
  );
}

function ProposalsStatusColumns({ data }: { data: ProposalStatusPoint[] }) {
  const { total, chartData, chartConfig } = useStatusChartModel(data);

  if (total === 0) {
    return <ProposalsStatusEmpty />;
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
          tick={{ fontSize: 11 }}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => [`${value}`, "Count"]} />
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

type StatusChartView = "donut" | "columns";

export function ProposalsStatusChart({ data }: { data: ProposalStatusPoint[] }) {
  const [view, setView] = useState<StatusChartView>("donut");
  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="space-y-3">
      {hasData ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-xs">View</span>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v === "donut" || v === "columns") setView(v);
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
      ) : null}
      {view === "donut" ? (
        <ProposalsStatusDonut data={data} />
      ) : (
        <ProposalsStatusColumns data={data} />
      )}
    </div>
  );
}
