"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import {
  getMonthlyAreaData,
  getMonthlyAreaDefaultBounds,
  type MonthlyAreaPoint,
} from "@/actions/reports";
import { format, endOfDay, parseISO } from "date-fns";

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

export function RevenueAreaChart({
  embedded = false,
  /** Pixel height for the chart when `embedded` (full-width dashboard). */
  chartHeightPx,
}: {
  embedded?: boolean;
  chartHeightPx?: number;
}) {
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [data, setData] = React.useState<MonthlyAreaPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    getMonthlyAreaDefaultBounds().then((b) => {
      if (cancelled) return;
      setStartDate(parseISO(b.start));
      setEndDate(endOfDay(parseISO(b.end)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rangeReady = startDate != null && endDate != null;

  React.useEffect(() => {
    if (!rangeReady || !startDate || !endDate) return;
    let cancelled = false;
    setLoading(true);
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    getMonthlyAreaData(startStr, endStr)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeReady, startDate, endDate]);

  const { formatNumber, convertedRate } = useReportsCurrency();
  const chartData = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        profits: d.profits * convertedRate,
        expenses: d.expenses * convertedRate,
      })),
    [data, convertedRate]
  );
  const hasData = data.some((d) => d.profits > 0 || d.expenses > 0);
  const embeddedChartHeight = embedded ? (chartHeightPx ?? 240) : 0;

  const pickers = (
    <div className="flex flex-wrap items-center gap-2" dir="ltr">
      <span className="text-muted-foreground text-xs sm:text-sm">From:</span>
      <DatePickerAr
        value={startDate ?? undefined}
        onChange={(date) => date && setStartDate(date)}
        placeholder="From"
        className={embedded ? "w-[120px]" : "w-[140px]"}
        disabled={!rangeReady}
      />
      <span className="text-muted-foreground text-xs sm:text-sm">To:</span>
      <DatePickerAr
        value={endDate ?? undefined}
        onChange={(date) => date && setEndDate(date)}
        placeholder="To"
        className={embedded ? "w-[120px]" : "w-[140px]"}
        disabled={!rangeReady}
      />
    </div>
  );

  const chartBlock =
    !rangeReady ? (
      <p
        className="text-muted-foreground flex w-full items-center justify-center text-sm"
        style={{ minHeight: embedded ? embeddedChartHeight : 192 }}
      >
        Loading…
      </p>
    ) : loading ? (
      <p
        className="text-muted-foreground flex w-full items-center justify-center text-sm"
        style={{ minHeight: embedded ? embeddedChartHeight : 192 }}
      >
        Loading…
      </p>
    ) : !hasData ? (
      <p
        className="text-muted-foreground flex w-full items-center justify-center text-sm"
        style={{ minHeight: embedded ? embeddedChartHeight : 192 }}
      >
        No data for this period.
      </p>
    ) : (
      <ChartContainer
        config={chartConfig}
        className={embedded ? "aspect-auto w-full" : "aspect-auto h-48 w-full md:h-[250px]"}
        style={embedded ? { height: embeddedChartHeight } : undefined}
        dir="ltr"
      >
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="fillProfits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-profits)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-profits)" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={20}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => String(value)}
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
                      {formatNumber(Number(value))}
                    </span>
                  </div>
                )}
                indicator="dot"
              />
            }
          />
          <Area
            dataKey="expenses"
            type="natural"
            fill="url(#fillExpenses)"
            stroke="var(--color-expenses)"
            stackId="a"
          />
          <Area
            dataKey="profits"
            type="natural"
            fill="url(#fillProfits)"
            stroke="var(--color-profits)"
            stackId="a"
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    );

  if (embedded) {
    return (
      <div className="flex flex-col gap-2" dir="ltr">
        <div className="flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-left text-sm font-medium text-foreground">Monthly revenue (area)</p>
          {pickers}
        </div>
        {chartBlock}
      </div>
    );
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex flex-wrap items-center gap-2 space-y-0 border-b py-5 sm:flex-row" dir="ltr">
        <div className="grid flex-1 gap-1 text-left">
          <CardTitle>Monthly revenue (area)</CardTitle>
        </div>
        {pickers}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">{chartBlock}</CardContent>
    </Card>
  );
}
