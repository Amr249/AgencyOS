"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { RevenueAreaChart } from "@/components/reports/revenue-area-chart";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import { ReportsMoney } from "@/components/reports/reports-money";
import type { MonthlyRevenuePoint } from "@/actions/reports";

type RevenueChartSectionProps = {
  monthlyRevenue: MonthlyRevenuePoint[];
  totalProfitsInRange: number;
  totalExpensesInRange: number;
  netProfitInRange: number;
  /** Tighter card + fixed chart height for dashboard grids (monthly + area toggle preserved). */
  dashboardLayout?: boolean;
};

export function RevenueChartSection({
  monthlyRevenue,
  totalProfitsInRange,
  totalExpensesInRange,
  netProfitInRange,
  dashboardLayout = false,
}: RevenueChartSectionProps) {
  const [view, setView] = React.useState<"monthly" | "area">("monthly");
  const { formatAmount, convertedRate, formatNumber } = useReportsCurrency();

  const chartData = React.useMemo(
    () =>
      monthlyRevenue.map((d) => ({
        ...d,
        profits: d.profits * convertedRate,
        expenses: (d.expenses ?? 0) * convertedRate,
      })),
    [monthlyRevenue, convertedRate]
  );

  const toggleRow = (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => setView("monthly")}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
          view === "monthly"
            ? "bg-primary text-primary-foreground border-primary"
            : "border-input bg-background hover:bg-muted"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => setView("area")}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
          view === "area"
            ? "bg-primary text-primary-foreground border-primary"
            : "border-input bg-background hover:bg-muted"
        }`}
      >
        Area
      </button>
    </div>
  );

  const statsRow = (
    <div
      className={`flex flex-wrap justify-start gap-x-4 gap-y-1 ${dashboardLayout ? "mt-1 text-sm" : "mt-4 gap-6 text-sm"}`}
    >
      <span className="text-muted-foreground inline-flex flex-wrap items-center gap-1">
        Total profit:{" "}
        <strong className="text-foreground">
          <ReportsMoney amount={totalProfitsInRange} />
        </strong>
      </span>
      <span className="text-muted-foreground inline-flex flex-wrap items-center gap-1">
        Expenses:{" "}
        <strong className="text-foreground">
          <ReportsMoney amount={totalExpensesInRange} />
        </strong>
      </span>
      <span
        className={`inline-flex flex-wrap items-center gap-1 ${netProfitInRange >= 0 ? "text-green-600" : "text-red-600"}`}
      >
        Net:{" "}
        <strong>
          <ReportsMoney amount={netProfitInRange} />
        </strong>
      </span>
    </div>
  );

  if (dashboardLayout) {
    return (
      <Card className="flex w-full min-h-0 flex-col overflow-hidden" dir="ltr">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-left text-base font-semibold">Revenue by month</CardTitle>
          {toggleRow}
        </CardHeader>
        <CardContent className="flex w-full flex-1 flex-col gap-3 pt-0">
          {view === "monthly" ? (
            <>
              <div className="h-[400px] w-full max-w-full shrink-0">
                <RevenueChart
                  data={chartData}
                  formatAmount={formatNumber}
                  className="h-[400px] w-full max-w-full aspect-auto"
                />
              </div>
              {statsRow}
            </>
          ) : (
            <div className="min-h-[400px] w-full flex-1 overflow-y-auto">
              <RevenueAreaChart embedded chartHeightPx={360} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {toggleRow}
      {view === "monthly" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-left">Revenue by month</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chartData} formatAmount={formatNumber} />
            {statsRow}
          </CardContent>
        </Card>
      ) : (
        <RevenueAreaChart />
      )}
    </div>
  );
}
