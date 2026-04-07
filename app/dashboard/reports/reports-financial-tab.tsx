"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChartSection } from "@/components/reports/revenue-chart-section";
import { MonthlyComparisonChart } from "@/components/reports/monthly-comparison-chart";
import { ProfitabilityVisualization } from "@/components/reports/profitability-visualization";
import { ReportsCurrencyProvider, useReportsCurrency } from "@/components/reports/reports-currency-context";
import { ReportsMoney } from "@/components/reports/reports-money";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import type {
  FinancialSummary,
  MonthlyRevenuePoint,
  RecentInvoiceRow,
  MonthlyComparisonPoint,
} from "@/actions/reports";

type ReportsFinancialTabProps = {
  rate: number;
  summary: FinancialSummary;
  revenueDelta: number;
  monthlyRevenue: MonthlyRevenuePoint[];
  totalProfitsInRange: number;
  totalExpensesInRange: number;
  netProfitInRange: number;
  recentInvoices: RecentInvoiceRow[];
  monthlyComparison: MonthlyComparisonPoint[];
};

function CurrencyToggleAndIndicator() {
  const { currency, setCurrency, rate } = useReportsCurrency();
  return (
    <div className="space-y-1 w-full">
      <div className="flex gap-2 items-center flex-wrap w-full md:w-auto" dir="ltr">
        <span className="text-sm text-muted-foreground">Currency:</span>
        <div className="flex overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setCurrency("SAR")}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors ${
              currency === "SAR"
                ? "bg-[#a4fe19] text-neutral-950"
                : "bg-white text-foreground hover:bg-muted"
            }`}
            aria-label="SAR"
          >
            <SarCurrencyIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrency("EGP")}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors ${
              currency === "EGP"
                ? "bg-[#a4fe19] text-neutral-950"
                : "bg-white text-foreground hover:bg-muted"
            }`}
          >
            EGP
          </button>
        </div>
        {currency === "EGP" && (
          <span className="text-xs text-muted-foreground">1 SAR = {rate.toFixed(2)} EGP</span>
        )}
      </div>
      {currency === "EGP" && (
        <div className="text-xs text-muted-foreground text-left">
          Live rate: 1 SAR = {rate.toFixed(2)} EGP · refreshes hourly
        </div>
      )}
    </div>
  );
}

const RECENT_INVOICES_PREVIEW = 6;

function FinancialContent({
  summary,
  revenueDelta,
  monthlyRevenue,
  totalProfitsInRange,
  totalExpensesInRange,
  netProfitInRange,
  recentInvoices,
  monthlyComparison,
}: Omit<ReportsFinancialTabProps, "rate">) {
  const recentPreview = recentInvoices.slice(0, RECENT_INVOICES_PREVIEW);

  return (
    <div className="space-y-5">
      {/* KPI row — 2×2 mobile, 4 columns desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Revenue this month</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.revenueThisMonth} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground flex items-center justify-start gap-1 text-xs">
              vs. last month
              {revenueDelta >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={revenueDelta >= 0 ? "text-green-600" : "text-red-600"}>
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(0)}%
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Collected this year</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.totalCollectedThisYear} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-xs">By payment date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.outstandingTotal} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-xs">Unpaid balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Net profit (range)</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div
              className={`text-2xl font-bold ${netProfitInRange < 0 ? "text-red-600" : ""}`}
            >
              <ReportsMoney amount={netProfitInRange} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-xs">Profit minus expenses in selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by month — full width */}
      <div className="w-full max-w-full">
        <RevenueChartSection
          dashboardLayout
          monthlyRevenue={monthlyRevenue}
          totalProfitsInRange={totalProfitsInRange}
          totalExpensesInRange={totalExpensesInRange}
          netProfitInRange={netProfitInRange}
        />
      </div>

      {/* Month-over-month + recent invoices */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <MonthlyComparisonChart
          data={monthlyComparison}
          className="flex h-full min-h-[320px] flex-col"
          chartContainerClassName="aspect-auto h-[280px] w-full md:h-[300px]"
        />
        <Card className="flex h-full min-h-[320px] flex-col overflow-hidden" dir="ltr">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-left text-base">Recent invoices</CardTitle>
            <Link
              href="/dashboard/invoices"
              className="text-primary text-sm font-medium hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
            {recentInvoices.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No invoices yet.</p>
            ) : (
              <ul className="space-y-1">
                {recentPreview.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-muted/50"
                    >
                      <Badge
                        variant="outline"
                        className={INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "shrink-0"}
                      >
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                      <span className="shrink-0 text-sm">
                        <ReportsMoney amount={Number(inv.total)} iconClassName="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                        {inv.clientName ?? "—"}
                      </span>
                      <span className="shrink-0 font-medium text-primary hover:underline">
                        {inv.invoiceNumber}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ProfitabilityVisualization />
    </div>
  );
}

export function ReportsFinancialTab(props: ReportsFinancialTabProps) {
  const { rate, ...rest } = props;
  return (
    <ReportsCurrencyProvider rate={rate}>
      <div className="space-y-4">
        <CurrencyToggleAndIndicator />
        <FinancialContent {...rest} />
      </div>
    </ReportsCurrencyProvider>
  );
}
