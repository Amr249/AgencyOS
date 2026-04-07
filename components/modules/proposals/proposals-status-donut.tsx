"use client";

import { useMemo } from "react";
import { Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PROPOSAL_STATUS_LABELS } from "@/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

type StatusPoint = { status: string; count: number };

export function ProposalsStatusDonut({ data }: { data: StatusPoint[] }) {
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

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
        لا توجد عروض بعد.
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[min(72vw,240px)] w-full max-w-[280px] sm:h-[min(50vw,260px)] sm:max-w-none"
      dir="rtl"
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}`, "العدد"]}
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
