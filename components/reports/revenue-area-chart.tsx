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
import { getMonthlyAreaData, type MonthlyAreaPoint } from "@/actions/reports";
import { format, startOfYear, endOfDay } from "date-fns";

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

const defaultStart = () => startOfYear(new Date());
const defaultEnd = () => endOfDay(new Date());

export function RevenueAreaChart() {
  const [startDate, setStartDate] = React.useState<Date>(defaultStart);
  const [endDate, setEndDate] = React.useState<Date>(defaultEnd);
  const [data, setData] = React.useState<MonthlyAreaPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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
  }, [startDate, endDate]);

  const { formatAmount, convertedRate } = useReportsCurrency();
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

  return (
    <Card className="pt-0">
      <CardHeader className="flex flex-wrap items-center gap-2 space-y-0 border-b py-5 sm:flex-row" dir="rtl">
        <div className="grid flex-1 gap-1 text-right">
          <CardTitle>الإيرادات الشهرية (مساحي)</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2" dir="rtl">
          <span className="text-muted-foreground text-sm">من:</span>
          <DatePickerAr
            value={startDate}
            onChange={(date) => date && setStartDate(date)}
            placeholder="من"
            className="w-[140px]"
          />
          <span className="text-muted-foreground text-sm">إلى:</span>
          <DatePickerAr
            value={endDate}
            onChange={(date) => date && setEndDate(date)}
            placeholder="إلى"
            className="w-[140px]"
          />
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <p className="text-muted-foreground flex h-[250px] items-center justify-center text-sm">جاري التحميل...</p>
        ) : !hasData ? (
          <p className="text-muted-foreground flex h-[250px] items-center justify-center text-sm">لا توجد بيانات لهذه الفترة.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full" dir="rtl">
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
                    labelFormatter={(value) => value}
                    formatter={(value) => formatAmount(Number(value))}
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
        )}
      </CardContent>
    </Card>
  );
}
