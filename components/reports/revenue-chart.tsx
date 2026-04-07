"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { MonthlyRevenuePoint } from "@/actions/reports";

const chartConfig = {
  profits: {
    label: "Profit",
    color: "var(--chart-1)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function RevenueChart({
  data,
  formatAmount,
  className,
}: {
  data: MonthlyRevenuePoint[];
  formatAmount?: (amount: number) => string;
  /** Chart container height / layout (e.g. dashboard grid). */
  className?: string;
}) {
  const chartData = [...data]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((d) => ({
      month: d.monthLabel,
      profits: d.profits,
      expenses: d.expenses ?? 0,
    }));

  const hasData = data.some((d) => d.profits > 0 || (d.expenses ?? 0) > 0);
  const formatter = formatAmount ?? ((v: number) => Number(v).toLocaleString("en-US"));

  if (!hasData) {
    const compactEmpty = className?.includes("h-[400px]");
    return (
      <p
        className={
          className
            ? compactEmpty
              ? "text-muted-foreground flex h-[400px] w-full items-center justify-center text-sm"
              : "text-muted-foreground flex h-full min-h-[240px] flex-1 items-center justify-center text-sm"
            : "text-muted-foreground flex min-h-[12rem] items-center justify-center text-sm md:min-h-[282px]"
        }
      >
        No revenue data for this period.
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className={className ?? "aspect-auto h-48 w-full md:h-[282px]"}
      dir="ltr"
    >
      <BarChart accessibilityLayer data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => String(label)}
              formatter={(value, _name, item) => (
                <div className="flex w-full min-w-[9rem] items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {item.dataKey === "profits"
                      ? "Profit"
                      : item.dataKey === "expenses"
                        ? "Expenses"
                        : String(item.dataKey ?? "")}
                  </span>
                  <span className="text-popover-foreground font-mono font-medium tabular-nums">
                    {formatter(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="profits" fill="var(--color-profits)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
