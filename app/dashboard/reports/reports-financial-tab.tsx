"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChartSection } from "@/components/reports/revenue-chart-section";
import { OutstandingInvoicesTable } from "@/components/reports/outstanding-invoices-table";
import { TopClientsPieChart } from "@/components/modules/reports/top-clients-pie-chart";
import { ReportsCurrencyProvider, useReportsCurrency } from "@/components/reports/reports-currency-context";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { FinancialSummary } from "@/actions/reports";
import type { MonthlyRevenuePoint } from "@/actions/reports";
import type { RecentInvoiceRow } from "@/actions/reports";
import type { OutstandingInvoiceRow } from "@/actions/reports";

type ReportsFinancialTabProps = {
  rate: number;
  summary: FinancialSummary;
  revenueDelta: number;
  monthlyRevenue: MonthlyRevenuePoint[];
  totalProfitsInRange: number;
  totalExpensesInRange: number;
  netProfitInRange: number;
  topClientsPieData: { clientName: string; total: number; invoiceCount: number }[];
  recentInvoices: RecentInvoiceRow[];
  outstandingRows: OutstandingInvoiceRow[];
  totalOutstanding: number;
};

function CurrencyToggleAndIndicator() {
  const { currency, setCurrency, rate } = useReportsCurrency();
  return (
    <div className="space-y-1 w-full">
      <div className="flex gap-2 items-center flex-wrap w-full md:w-auto" dir="rtl">
        <span className="text-sm text-muted-foreground">العملة:</span>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            type="button"
            onClick={() => setCurrency("SAR")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              currency === "SAR" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            ر.س SAR
          </button>
          <button
            type="button"
            onClick={() => setCurrency("EGP")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              currency === "EGP" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            ج.م EGP
          </button>
        </div>
        {currency === "EGP" && (
          <span className="text-xs text-muted-foreground">1 ر.س = {rate.toFixed(2)} ج.م</span>
        )}
      </div>
      {currency === "EGP" && (
        <div className="text-xs text-muted-foreground text-right">
          سعر الصرف المباشر: 1 ر.س = {rate.toFixed(2)} ج.م · يتجدد كل ساعة
        </div>
      )}
    </div>
  );
}

function FinancialContent({
  summary,
  revenueDelta,
  monthlyRevenue,
  totalProfitsInRange,
  totalExpensesInRange,
  netProfitInRange,
  topClientsPieData,
  recentInvoices,
  outstandingRows,
  totalOutstanding,
}: Omit<ReportsFinancialTabProps, "rate">) {
  const { formatAmount } = useReportsCurrency();

  return (
    <>
      {/* Section 1 — KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">إيرادات هذا الشهر</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">{formatAmount(summary.revenueThisMonth)}</p>
            <p className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
              مقارنة بالشهر الماضي
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
            <CardTitle className="text-sm font-medium text-right">إجمالي الأرباح هذه السنة</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">{formatAmount(summary.totalCollectedThisYear)}</p>
            <p className="text-muted-foreground text-xs">حسب تاريخ الاستلام (paid_at)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">المستحق حالياً</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">{formatAmount(summary.outstandingTotal)}</p>
            <p className="text-muted-foreground text-xs">فواتير غير مدفوعة</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — Revenue Chart */}
      <RevenueChartSection
        monthlyRevenue={monthlyRevenue}
        totalProfitsInRange={totalProfitsInRange}
        totalExpensesInRange={totalExpensesInRange}
        netProfitInRange={netProfitInRange}
      />

      {/* Section 3 — Two columns */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <TopClientsPieChart data={topClientsPieData} />
        <Card>
          <CardHeader>
            <CardTitle className="text-right">آخر الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm">لا توجد فواتير بعد.</p>
            ) : (
              <ul className="space-y-2">
                {recentInvoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="flex items-center gap-2 rounded-lg p-2 text-right hover:bg-muted/50"
                    >
                      <Badge
                        variant="outline"
                        className={INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "shrink-0"}
                      >
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                      <span className="shrink-0 text-sm">{formatAmount(Number(inv.total))}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                        {inv.clientName ?? "—"}
                      </span>
                      <span className="font-medium text-primary shrink-0 hover:underline">
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

      {/* Section 4 — Outstanding Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">الفواتير المستحقة</CardTitle>
        </CardHeader>
        <CardContent>
          <OutstandingInvoicesTable
            rows={outstandingRows}
            totalOutstanding={totalOutstanding}
          />
        </CardContent>
      </Card>
    </>
  );
}

export function ReportsFinancialTab(props: ReportsFinancialTabProps) {
  const { rate, ...rest } = props;
  return (
    <ReportsCurrencyProvider rate={rate}>
      <div className="space-y-6">
        <CurrencyToggleAndIndicator />
        <FinancialContent {...rest} />
      </div>
    </ReportsCurrencyProvider>
  );
}
