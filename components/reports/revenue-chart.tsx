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
    label: "الأرباح",
    color: "var(--chart-1)",
  },
  expenses: {
    label: "المصروفات",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function RevenueChart({
  data,
  formatAmount,
}: {
  data: MonthlyRevenuePoint[];
  formatAmount?: (amount: number) => string;
}) {
  const chartData = [...data]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((d) => ({
      month: d.monthLabel,
      profits: d.profits,
      expenses: d.expenses ?? 0,
    }));

  const hasData = data.some((d) => d.profits > 0 || (d.expenses ?? 0) > 0);
  const formatter = formatAmount ?? ((v: number) => `${Number(v).toLocaleString("ar-SA")} ر.س`);

  if (!hasData) {
    return (
      <p className="text-muted-foreground flex min-h-[282px] items-center justify-center text-sm">
        لا توجد بيانات إيرادات لهذه الفترة.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[282px] w-full aspect-auto" dir="rtl">
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
              formatter={(value) => formatter(Number(value))}
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
