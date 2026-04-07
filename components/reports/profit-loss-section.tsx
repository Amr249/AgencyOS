"use client";

import * as React from "react";
import { getProfitLossStatement, type ProfitLossExpensesByCategory, type ProfitLossStatement } from "@/actions/reports";
import { PROFIT_LOSS_PERIODS, type ProfitLossPeriodKey } from "@/lib/reports-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportsMoney } from "@/components/reports/reports-money";
import { cn } from "@/lib/utils";

type ProfitLossSectionProps = {
  className?: string;
  /** Scroll long statements when used in a fixed-height dashboard column. */
  contentClassName?: string;
};
import { downloadReportPdf } from "@/lib/reports-pdf-download";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

const PERIOD_LABELS: Record<ProfitLossPeriodKey, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  all_time: "All Time",
};

const EXPENSE_ORDER: (keyof ProfitLossExpensesByCategory)[] = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
];

const EXPENSE_LABELS: Record<keyof ProfitLossExpensesByCategory, string> = {
  software: "Software",
  hosting: "Hosting",
  marketing: "Marketing",
  salaries: "Salaries",
  equipment: "Equipment",
  office: "Office",
  other: "Other",
};

function PlRow({
  label,
  amount,
  muted,
  bold,
  amountClassName,
}: {
  label: string;
  amount: number;
  muted?: boolean;
  bold?: boolean;
  amountClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-6 border-b border-border/50 py-2.5 text-sm",
        bold && "font-semibold"
      )}
    >
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      <span className={cn("min-w-30 shrink-0 text-right tabular-nums", amountClassName)}>
        <ReportsMoney amount={amount} iconClassName="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function formatDeltaPct(pct: number | null): React.ReactNode {
  if (pct === null) return "—";
  const up = pct > 0;
  const flat = Math.abs(pct) < 0.005;
  if (flat) return <span className="text-muted-foreground">0%</span>;
  return (
    <span className={up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function ProfitLossSection({ className, contentClassName }: ProfitLossSectionProps) {
  const [period, setPeriod] = React.useState<ProfitLossPeriodKey>("this_month");
  const [data, setData] = React.useState<ProfitLossStatement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pdfLoading, setPdfLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProfitLossStatement(period).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setData(null);
        setError(
          res.error === "invalid_period" ? "Invalid period selected." : "Could not load the statement."
        );
        return;
      }
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const expenseRows = React.useMemo(() => {
    if (!data) return [];
    return EXPENSE_ORDER.map((key) => ({
      key,
      label: EXPENSE_LABELS[key],
      amount: data.expenses.byCategory[key],
    })).filter((r) => r.amount > 0);
  }, [data]);

  return (
    <Card className={cn("overflow-hidden", className)} dir="ltr">
      <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" aria-hidden />
          <div>
            <CardTitle className="text-left text-base font-semibold">Profit & Loss</CardTitle>
            {data && (
              <p className="text-muted-foreground mt-0.5 text-left text-xs">
                {data.period.startDate} — {data.period.endDate}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading || !data || pdfLoading}
            onClick={() => {
              setPdfLoading(true);
              void downloadReportPdf({ type: "profit-loss", period })
                .then(() => toast.success("PDF downloaded"))
                .catch((e: Error) => toast.error(e.message))
                .finally(() => setPdfLoading(false));
            }}
          >
            {pdfLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Download PDF
          </Button>
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as ProfitLossPeriodKey)}
            disabled={loading}
          >
            <SelectTrigger className="w-[180px]" size="sm" aria-label="Statement period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROFIT_LOSS_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className={cn("pt-4", contentClassName)}>
        {error && (
          <p className="text-destructive text-center text-sm" role="alert">
            {error}
          </p>
        )}
        {!error && !data && loading && (
          <p className="text-muted-foreground text-center text-sm">Loading statement…</p>
        )}
        {data && (
          <div className="space-y-1">
            <p className="text-muted-foreground mb-2 text-left text-xs font-medium uppercase tracking-wide">
              Revenue
            </p>
            <PlRow label="Total invoiced" amount={data.revenue.invoiced} />
            <PlRow label="Total collected" amount={data.revenue.collected} />
            <PlRow label="Outstanding" amount={data.revenue.outstanding} muted />
            <PlRow label="Revenue subtotal (invoiced)" amount={data.revenue.invoiced} bold />

            <div className="my-4 border-t border-border/70" />

            <p className="text-muted-foreground mb-2 text-left text-xs font-medium uppercase tracking-wide">
              Operating expenses
            </p>
            {expenseRows.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">No expenses in this period.</p>
            ) : (
              expenseRows.map((r) => <PlRow key={r.key} label={r.label} amount={r.amount} />)
            )}
            <PlRow label="Total expenses" amount={data.expenses.total} bold />

            <div className="my-4 border-t border-border/70" />

            <p className="text-muted-foreground mb-2 text-left text-xs font-medium uppercase tracking-wide">
              Profit
            </p>
            <PlRow label="Gross profit (collected)" amount={data.profit.gross} />
            <PlRow
              label="Net profit (collected − expenses)"
              amount={data.profit.net}
              bold
              amountClassName={
                data.profit.net >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }
            />
            <div className="flex justify-between gap-6 border-b border-border/50 py-2.5 text-sm font-semibold">
              <span>Profit margin</span>
              <span className="tabular-nums">
                {data.profit.margin === null ? "—" : `${data.profit.margin.toFixed(1)}%`}
              </span>
            </div>

            {data.comparison && (
              <p className="text-muted-foreground mt-4 text-left text-xs leading-relaxed">
                Net profit: {formatDeltaPct(data.comparison.percentChange)} vs{" "}
                {data.comparison.compareLabel} · Collected:{" "}
                {formatDeltaPct(data.comparison.collectedPercentChange)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
