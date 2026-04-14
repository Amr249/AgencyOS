"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type MonthPoint = { monthKey: string; monthLabel: string; won: number; total: number; ratio: number };

const chartConfig = {
  ratio: {
    label: "Win rate %",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ProposalsWinRateChart({ data }: { data: MonthPoint[] }) {
  const chartData = data.map((d) => ({
    month: d.monthLabel,
    ratio: d.ratio,
    won: d.won,
    total: d.total,
  }));
  const hasData = chartData.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <p className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
        No data to display.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" dir="ltr">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, props: { payload?: { won?: number; total?: number } }) => {
                const p = props.payload;
                if (p?.total != null && p?.won != null)
                  return `${p.won} / ${p.total} (${value}%)`;
                return `${value}%`;
              }}
            />
          }
        />
        <Bar dataKey="ratio" fill="var(--color-ratio)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
