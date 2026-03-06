"use client";

import { useMemo } from "react";
import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TopClientsPieChart({
  data,
}: {
  data: { clientName: string; total: number; invoiceCount: number }[];
}) {
  const { formatAmount, convertedRate } = useReportsCurrency();
  const total = data.reduce((sum, d) => sum + d.total, 0);

  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        client: d.clientName,
        revenue: d.total * convertedRate,
        revenueRaw: d.total,
        invoiceCount: d.invoiceCount,
        percentage: total > 0 ? ((d.total / total) * 100).toFixed(1) : "0",
        fill: COLORS[i % COLORS.length],
      })),
    [data, convertedRate, total]
  );

  const chartConfig = Object.fromEntries(
    data.map((d, i) => [
      d.clientName,
      { label: d.clientName, color: COLORS[i % COLORS.length] },
    ])
  ) as ChartConfig;

  if (data.length === 0) {
    return (
      <Card className="flex flex-col" dir="rtl">
        <CardHeader className="items-end pb-0">
          <CardTitle>أفضل العملاء إيراداً</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center text-sm">لا توجد بيانات بعد.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col" dir="rtl">
      <CardHeader className="items-end pb-0">
        <CardTitle>أفضل العملاء إيراداً</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[280px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, props: { payload?: { revenueRaw?: number } }) => (
                    <div className="flex flex-col gap-1 text-right">
                      <span className="font-medium">{name}</span>
                      <span>{formatAmount(props.payload?.revenueRaw ?? Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="revenue"
              nameKey="client"
              label={({ percentage }) => `${percentage}%`}
              labelLine={true}
            />
          </PieChart>
        </ChartContainer>

        {/* Legend below chart */}
        <div className="mt-4 space-y-2 px-4 pb-4">
          {chartData.map((d) => (
            <div key={d.client} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{d.invoiceCount} فاتورة · {formatAmount(d.revenueRaw)}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.client}</span>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: d.fill }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
