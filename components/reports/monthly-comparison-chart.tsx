"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import type { MonthlyComparisonPoint } from "@/actions/reports";
import { useMediaQuery } from "@/hooks/use-media-query";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-2)",
  },
  profit: {
    label: "Profit",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

type ChartRow = {
  axisLabel: string;
  fullMonthLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
};

function ComparisonTooltipBody({
  active,
  payload,
  formatNumber,
  currencySuffix,
}: TooltipProps<number, string> & {
  formatNumber: (n: number) => string;
  currencySuffix: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;
  return (
    <div className="border-border/50 bg-background grid gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-foreground">{row.fullMonthLabel}</p>
      <p className="text-foreground">
        Revenue: {formatNumber(row.revenue)} {currencySuffix}
      </p>
      <p className="text-foreground">
        Expenses: {formatNumber(row.expenses)} {currencySuffix}
      </p>
      <p className="text-foreground">
        Profit: {formatNumber(row.profit)} {currencySuffix}
      </p>
    </div>
  );
}

export function MonthlyComparisonChart({
  data,
  className,
  chartContainerClassName,
}: {
  data: MonthlyComparisonPoint[];
  className?: string;
  /** Override chart height in dashboard grids (e.g. h-[300px]). */
  chartContainerClassName?: string;
}) {
  const { formatNumber, convertedRate, currency } = useReportsCurrency();
  const chartWide = useMediaQuery("(min-width: 640px)");
  const currencySuffix = currency === "SAR" ? "SAR" : "EGP";

  const chartRows = React.useMemo((): ChartRow[] => {
    return data.map((d) => ({
      axisLabel: `${d.month} ${d.year}`,
      fullMonthLabel: format(parseISO(`${d.monthKey}-01`), "MMMM yyyy", { locale: enUS }),
      revenue: d.revenue * convertedRate,
      expenses: d.expenses * convertedRate,
      profit: d.profit * convertedRate,
    }));
  }, [data, convertedRate]);

  const tooltipRenderer = React.useCallback(
    (props: TooltipProps<number, string>) => (
      <ComparisonTooltipBody {...props} formatNumber={formatNumber} currencySuffix={currencySuffix} />
    ),
    [formatNumber, currencySuffix]
  );

  return (
    <Card dir="ltr" className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-left text-base font-semibold">Month-over-month comparison</CardTitle>
        <p className="text-muted-foreground text-left text-sm font-normal">
          Last 6 months — collected revenue, expenses, and profit by calendar month.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full min-w-0">
          <ChartContainer
            config={chartConfig}
            className={chartContainerClassName ?? "aspect-auto h-52 w-full min-w-0 sm:h-56 md:h-[280px]"}
            dir="ltr"
          >
            <BarChart
              accessibilityLayer
              data={chartRows}
              margin={{
                top: 8,
                right: 8,
                left: chartWide ? 4 : 0,
                bottom: chartWide ? 4 : 2,
              }}
              barGap={chartWide ? 2 : 1}
              barCategoryGap={chartWide ? "12%" : "8%"}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="axisLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={chartWide ? 8 : 4}
                minTickGap={chartWide ? 16 : 4}
                angle={chartWide ? 0 : -32}
                textAnchor={chartWide ? "middle" : "end"}
                height={chartWide ? 36 : 64}
                tick={{ fontSize: chartWide ? 12 : 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={chartWide ? 48 : 40}
                tick={{ fontSize: chartWide ? 12 : 10 }}
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted) / 0.25)" }} content={tooltipRenderer} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[3, 3, 0, 0]}
                maxBarSize={chartWide ? 28 : 20}
              />
              <Bar
                dataKey="expenses"
                fill="var(--color-expenses)"
                radius={[3, 3, 0, 0]}
                maxBarSize={chartWide ? 28 : 20}
              />
              <Bar
                dataKey="profit"
                fill="var(--color-profit)"
                radius={[3, 3, 0, 0]}
                maxBarSize={chartWide ? 28 : 20}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
