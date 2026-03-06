"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { RevenueAreaChart } from "@/components/reports/revenue-area-chart";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import type { MonthlyRevenuePoint } from "@/actions/reports";

type RevenueChartSectionProps = {
  monthlyRevenue: MonthlyRevenuePoint[];
  totalProfitsInRange: number;
  totalExpensesInRange: number;
  netProfitInRange: number;
};

export function RevenueChartSection({
  monthlyRevenue,
  totalProfitsInRange,
  totalExpensesInRange,
  netProfitInRange,
}: RevenueChartSectionProps) {
  const [view, setView] = React.useState<"monthly" | "area">("monthly");
  const { formatAmount, convertedRate } = useReportsCurrency();

  const chartData = React.useMemo(
    () =>
      monthlyRevenue.map((d) => ({
        ...d,
        profits: d.profits * convertedRate,
        expenses: (d.expenses ?? 0) * convertedRate,
      })),
    [monthlyRevenue, convertedRate]
  );

  return (
    <div className="space-y-4">
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
          شهري
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
          مساحي
        </button>
      </div>

      {view === "monthly" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-right">الإيرادات شهر بشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chartData} formatAmount={formatAmount} />
            <div className="mt-4 flex flex-wrap justify-end gap-6 text-sm">
              <span className="text-muted-foreground">
                إجمالي الأرباح هذه السنة:{" "}
                <strong className="text-foreground">{formatAmount(totalProfitsInRange)}</strong>
              </span>
              <span className="text-muted-foreground">
                إجمالي المصروفات هذه السنة:{" "}
                <strong className="text-foreground">{formatAmount(totalExpensesInRange)}</strong>
              </span>
              <span className={netProfitInRange >= 0 ? "text-green-600" : "text-red-600"}>
                صافي الربح: <strong>{formatAmount(netProfitInRange)}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <RevenueAreaChart />
      )}
    </div>
  );
}
