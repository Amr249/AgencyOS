"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChartSection } from "@/components/reports/revenue-chart-section";
import { MonthlyComparisonChart } from "@/components/reports/monthly-comparison-chart";
import { ProfitabilityVisualization } from "@/components/reports/profitability-visualization";
import { ReportsCurrencyProvider, useReportsCurrency } from "@/components/reports/reports-currency-context";
import { ReportsMoney } from "@/components/reports/reports-money";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import type {
  FinancialSummary,
  MonthlyRevenuePoint,
  RecentInvoiceRow,
  MonthlyComparisonPoint,
} from "@/actions/reports";
import { cn } from "@/lib/utils";

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
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("reports.financial");

  return (
    <div className="w-full space-y-1">
      <div
        className="flex w-full flex-wrap items-center gap-2 md:w-auto"
        style={{ direction: isAr ? "rtl" : "ltr" }}
      >
        <span className="text-sm text-muted-foreground">{t("currencyLabel")}</span>
        <div className="flex overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setCurrency("SAR")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors",
              currency === "SAR"
                ? "bg-[#a4fe19] text-neutral-950"
                : "bg-white text-foreground hover:bg-muted"
            )}
            aria-label={t("ariaSar")}
          >
            <SarCurrencyIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors",
              currency === "USD"
                ? "bg-[#a4fe19] text-neutral-950"
                : "bg-white text-foreground hover:bg-muted"
            )}
            aria-label={t("ariaUsd")}
          >
            USD
          </button>
        </div>
        {currency === "USD" ? (
          <span className="text-xs text-muted-foreground">{t("rateShort", { rate: rate.toFixed(4) })}</span>
        ) : null}
      </div>
      {currency === "USD" ? (
        <div className="text-xs text-muted-foreground text-start">{t("rateNote", { rate: rate.toFixed(4) })}</div>
      ) : null}
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
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("reports.financial");
  const tStatus = useTranslations("invoices.status");
  const recentPreview = recentInvoices.slice(0, RECENT_INVOICES_PREVIEW);
  const pctLocale = isAr ? "ar-SA" : "en-US";
  const deltaText = revenueDelta.toLocaleString(pctLocale, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-start text-sm font-medium">{t("kpiRevenueMonth")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.revenueThisMonth} iconClassName="h-5 w-5" />
            </div>
            <p className="flex items-center justify-start gap-1 text-xs text-muted-foreground">
              {t("vsLastMonth")}
              {revenueDelta >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={revenueDelta >= 0 ? "text-green-600" : "text-red-600"}>
                {revenueDelta >= 0 ? "+" : ""}
                {deltaText}%
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-start text-sm font-medium">{t("kpiCollectedYear")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.totalCollectedThisYear} iconClassName="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">{t("byPaymentDate")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-start text-sm font-medium">{t("kpiOutstanding")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.outstandingTotal} iconClassName="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">{t("unpaidBalance")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-start text-sm font-medium">{t("kpiNetProfitRange")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className={`text-2xl font-bold ${netProfitInRange < 0 ? "text-red-600" : ""}`}>
              <ReportsMoney amount={netProfitInRange} iconClassName="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">{t("netProfitHint")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-full">
        <RevenueChartSection
          dashboardLayout
          monthlyRevenue={monthlyRevenue}
          totalProfitsInRange={totalProfitsInRange}
          totalExpensesInRange={totalExpensesInRange}
          netProfitInRange={netProfitInRange}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <MonthlyComparisonChart
          data={monthlyComparison}
          className="flex h-full min-h-[320px] flex-col"
          chartContainerClassName="aspect-auto h-[280px] w-full md:h-[300px]"
        />
        <Card className="flex h-full min-h-[320px] flex-col overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base text-start">{t("recentInvoices")}</CardTitle>
            <Link href="/dashboard/invoices" className="text-sm font-medium text-primary hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
            {recentInvoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noInvoices")}</p>
            ) : (
              <ul className="space-y-1">
                {recentPreview.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="flex items-center gap-2 rounded-lg p-2 text-start hover:bg-muted/50"
                    >
                      <Badge
                        variant="outline"
                        className={INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "shrink-0"}
                      >
                        {inv.status === "pending" || inv.status === "partial" || inv.status === "paid"
                          ? tStatus(inv.status)
                          : inv.status}
                      </Badge>
                      <span className="shrink-0 text-sm">
                        <ReportsMoney amount={Number(inv.total)} iconClassName="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
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
