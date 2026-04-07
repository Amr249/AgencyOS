"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportsMoney } from "@/components/reports/reports-money";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";
import type { CashFlowForecastData } from "@/actions/reports";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function signedClass(value: number): string {
  if (value > 0.005) return "text-green-600";
  if (value < -0.005) return "text-red-600";
  return "text-muted-foreground";
}

export function CashFlowForecastSection({
  data,
  compact = false,
}: {
  data: CashFlowForecastData;
  /** Tighter spacing and shorter copy for side-by-side dashboard columns. */
  compact?: boolean;
}) {
  const forecastPagination = useReportPagination(
    data.forecast,
    compact ? { all: true } : undefined
  );

  const chartRows = data.forecast.map((m) => ({
    name: m.monthLabel,
    Income: m.expectedIncome,
    Expenses: m.expectedExpenses,
  }));

  const negBalanceWarnings = data.forecast
    .filter((m) => m.runningBalance < -0.005)
    .map((m) => `Projected negative running balance after ${m.monthLabel}.`);

  const kpiBox = (label: string, children: ReactNode) => (
    <div className={`rounded-lg border bg-card shadow-sm ${compact ? "p-2.5" : "p-4"}`}>
      <p className={`text-muted-foreground font-medium ${compact ? "text-xs leading-snug" : "text-sm"}`}>{label}</p>
      <p className={`font-semibold tabular-nums ${compact ? "mt-1 text-base" : "mt-2 text-xl"}`}>{children}</p>
    </div>
  );

  return (
    <Card dir="ltr" className={`text-left ${compact ? "flex h-full min-h-0 flex-col overflow-hidden" : ""}`}>
      <CardHeader className={compact ? "space-y-1 pb-2" : undefined}>
        <CardTitle className={compact ? "text-base" : undefined}>Cash flow forecast</CardTitle>
        <CardDescription className={compact ? "line-clamp-2 text-xs" : undefined}>
          {compact
            ? "Projected income from outstanding invoices, expenses from recurring + recent spend, and running balance."
            : "Expected income uses outstanding invoice balances by due date (or issue date plus default payment terms when due date is missing). Expected expenses combine scheduled recurring items in each month with average monthly non-recurring spend from the six completed months before this month. Running balance starts from your current net position."}
        </CardDescription>
      </CardHeader>
      <CardContent className={`${compact ? "min-h-0 flex-1 space-y-4 overflow-y-auto" : "space-y-8"}`}>
        <div
          className={
            compact
              ? "grid grid-cols-2 gap-2 lg:grid-cols-5"
              : "grid gap-4 sm:grid-cols-3"
          }
        >
          {kpiBox(
            compact ? "Collected to date" : "Total collected to date",
            <ReportsMoney amount={data.currentPosition.collected} iconClassName="h-4 w-4" />
          )}
          {kpiBox(
            compact ? "Expenses to date" : "Total expenses to date",
            <ReportsMoney amount={data.currentPosition.expenses} iconClassName="h-4 w-4" />
          )}
          {kpiBox(
            compact ? "Current net" : "Current net position",
            <span className={signedClass(data.currentPosition.net)}>
              <ReportsMoney amount={data.currentPosition.net} iconClassName="h-4 w-4" />
            </span>
          )}
          {compact ? (
            <>
              {kpiBox(
                "Expected income (3 mo)",
                <ReportsMoney amount={data.totals.totalExpectedIncome} iconClassName="h-4 w-4" />
              )}
              {kpiBox(
                "Expected expenses (3 mo)",
                <ReportsMoney amount={data.totals.totalExpectedExpenses} iconClassName="h-4 w-4" />
              )}
            </>
          ) : null}
        </div>

        {!compact ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-muted-foreground text-sm font-medium">Total expected income (3 months)</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                <ReportsMoney amount={data.totals.totalExpectedIncome} iconClassName="h-4 w-4" />
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-muted-foreground text-sm font-medium">Total expected expenses (3 months)</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                <ReportsMoney amount={data.totals.totalExpectedExpenses} iconClassName="h-4 w-4" />
              </p>
            </div>
          </div>
        ) : null}

        {negBalanceWarnings.length > 0 ? (
          <div className="text-muted-foreground space-y-1 text-sm">
            {negBalanceWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        ) : null}

        <div>
          <h3 className="mb-3 text-sm font-semibold">Next three months</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-end">Expected income</TableHead>
                  <TableHead className="text-end">Expected expenses</TableHead>
                  <TableHead className="text-end">Projected net</TableHead>
                  <TableHead className="text-end">Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastPagination.pageItems.map((row) => (
                  <TableRow key={`${row.year}-${row.month}`}>
                    <TableCell className="font-medium">{row.monthLabel}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <ReportsMoney amount={row.expectedIncome} iconClassName="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <ReportsMoney amount={row.expectedExpenses} iconClassName="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className={`text-end tabular-nums ${signedClass(row.projectedNet)}`}>
                      <ReportsMoney amount={row.projectedNet} iconClassName="h-3.5 w-3.5" />
                    </TableCell>
                    <TableCell className={`text-end tabular-nums ${signedClass(row.runningBalance)}`}>
                      <ReportsMoney amount={row.runningBalance} iconClassName="h-3.5 w-3.5" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ReportTablePaginationBar
              page={forecastPagination.page}
              pageSize={forecastPagination.pageSize}
              pageCount={forecastPagination.pageCount}
              total={forecastPagination.total}
              onPageChange={forecastPagination.setPage}
              onPageSizeChange={forecastPagination.setPageSize}
              className="border-border border-t px-3 pb-3"
            />
          </div>
        </div>

        <div>
          <h3 className={`font-semibold ${compact ? "mb-2 text-xs" : "mb-3 text-sm"}`}>
            Income vs expenses (forecast)
          </h3>
          <div className={`w-full min-w-0 ${compact ? "h-[180px]" : "h-[240px]"}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                <Legend />
                <Bar dataKey="Income" fill="#16a34a" name="Expected income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#dc2626" name="Expected expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CashFlowForecastSectionPlaceholder({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <Card dir="ltr" className={className}>
      <CardHeader>
        <CardTitle>Cash flow forecast</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}
