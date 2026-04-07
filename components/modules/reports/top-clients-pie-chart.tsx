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
import { ReportsMoney } from "@/components/reports/reports-money";
import { useMediaQuery } from "@/hooks/use-media-query";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TopClientsPieChart({
  data,
  className,
}: {
  data: { clientName: string; total: number; invoiceCount: number }[];
  className?: string;
}) {
  const { convertedRate } = useReportsCurrency();
  const showPieLabels = useMediaQuery("(min-width: 480px)");
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
      <Card className={`flex min-h-[380px] flex-col ${className ?? ""}`} dir="ltr">
        <CardHeader className="items-start pb-0">
          <CardTitle>Top clients by revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center text-sm">No data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`flex min-h-[380px] flex-col ${className ?? ""}`} dir="ltr">
      <CardHeader className="items-start pb-0">
        <CardTitle>Top clients by revenue</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[min(75vw,240px)] w-full max-w-[min(100%,280px)] shrink-0 pb-0 sm:h-[min(55vw,280px)] sm:max-w-[320px] md:max-w-none [&_.recharts-pie-label-text]:fill-foreground"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, props: { payload?: { revenueRaw?: number } }) => (
                    <div className="flex flex-col gap-1 text-left">
                      <span className="font-medium">{name}</span>
                      <ReportsMoney amount={props.payload?.revenueRaw ?? Number(value)} iconClassName="h-3 w-3" />
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="revenue"
              nameKey="client"
              cx="50%"
              cy="50%"
              innerRadius="46%"
              outerRadius="78%"
              label={showPieLabels ? ({ percentage }) => `${percentage}%` : false}
              labelLine={showPieLabels}
            />
          </PieChart>
        </ChartContainer>

        {/* Legend below chart */}
        <div className="mt-2 max-h-[120px] min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
          {chartData.map((d) => (
            <div key={d.client} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {d.invoiceCount} {d.invoiceCount === 1 ? "invoice" : "invoices"} ·{" "}
                <ReportsMoney amount={d.revenueRaw} iconClassName="h-3 w-3" />
              </span>
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
