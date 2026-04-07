"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/utils";
import type { ProjectProfitabilityRow } from "@/actions/reports";
import { downloadReportPdf } from "@/lib/reports-pdf-download";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";

type SortKey =
  | "projectName"
  | "clientName"
  | "totalRevenue"
  | "totalExpenses"
  | "profit"
  | "profitMargin"
  | "budgetVariance"
  | "profitStatus";

function SarAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className ?? ""}`} dir="ltr">
      {formatAmount(String(value))}
      <SarCurrencyIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
    </span>
  );
}

function profitStatus(row: ProjectProfitabilityRow): "profitable" | "loss" | "break_even" {
  const p = row.profit;
  if (p > 0.005) return "profitable";
  if (p < -0.005) return "loss";
  return "break_even";
}

function statusLabel(s: ReturnType<typeof profitStatus>): string {
  switch (s) {
    case "profitable":
      return "Profitable";
    case "loss":
      return "Loss";
    default:
      return "Break-even";
  }
}

const EPS = 1e-6;

export function ProjectProfitabilitySection({
  rows,
  tablePageSize,
}: {
  rows: ProjectProfitabilityRow[];
  /** When set, the project table is paginated. */
  tablePageSize?: number;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>("profit");
  const [sortDesc, setSortDesc] = React.useState(true);
  const [pdfLoading, setPdfLoading] = React.useState(false);

  const summary = React.useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const r of rows) {
      totalRevenue += r.totalRevenue;
      totalExpenses += r.totalExpenses;
    }
    const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
    return {
      projectCount: rows.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit,
    };
  }, [rows]);

  const sortedRows = React.useMemo(() => {
    const copy = [...rows];
    const dir = sortDesc ? -1 : 1;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "projectName":
          cmp = a.projectName.localeCompare(b.projectName);
          break;
        case "clientName":
          cmp = (a.clientName ?? "").localeCompare(b.clientName ?? "");
          break;
        case "totalRevenue":
          cmp = a.totalRevenue - b.totalRevenue;
          break;
        case "totalExpenses":
          cmp = a.totalExpenses - b.totalExpenses;
          break;
        case "profit":
          cmp = a.profit - b.profit;
          break;
        case "profitMargin": {
          const ma = a.profitMargin ?? -Infinity;
          const mb = b.profitMargin ?? -Infinity;
          cmp = ma - mb;
          break;
        }
        case "budgetVariance": {
          const va = a.budgetVariance ?? -Infinity;
          const vb = b.budgetVariance ?? -Infinity;
          cmp = va - vb;
          break;
        }
        case "profitStatus":
          cmp = profitStatus(a).localeCompare(profitStatus(b));
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return copy;
  }, [rows, sortKey, sortDesc]);

  const pagination = useReportPagination(
    sortedRows,
    tablePageSize != null && tablePageSize > 0 ? { fixedPageSize: tablePageSize } : undefined
  );

  React.useEffect(() => {
    pagination.setPage(1);
  }, [sortKey, sortDesc, pagination.setPage]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key === "projectName" || key === "clientName" ? false : true);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDesc ? "↓" : "↑";
  };

  const headerBtn = (key: SortKey, label: string) => (
    <Button
      type="button"
      variant="ghost"
      className="-ms-3 h-auto justify-start px-3 py-1 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(key)}
    >
      {label} {sortIndicator(key)}
    </Button>
  );

  return (
    <section className="space-y-6" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Project profitability</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Collected revenue allocated to each project versus project-tagged expenses.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={pdfLoading}
          onClick={() => {
            setPdfLoading(true);
            void downloadReportPdf({ type: "project-profitability" })
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
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-medium">Projects analyzed</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold tabular-nums">{summary.projectCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-medium">Total revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <SarAmount value={summary.totalRevenue} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-medium">Total expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <SarAmount value={summary.totalExpenses} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-medium">Net profit</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <SarAmount
                value={summary.netProfit}
                className={
                  summary.netProfit > EPS
                    ? "text-green-700 dark:text-green-400"
                    : summary.netProfit < -EPS
                      ? "text-red-700 dark:text-red-400"
                      : ""
                }
              />
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-left">By project</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
              No projects to show yet. Create projects and link invoices or expenses to see profitability.
            </p>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px] text-left">{headerBtn("projectName", "Project")}</TableHead>
                    <TableHead className="text-left">{headerBtn("totalRevenue", "Revenue")}</TableHead>
                    <TableHead className="text-left">{headerBtn("totalExpenses", "Expenses")}</TableHead>
                    <TableHead className="text-left">{headerBtn("profit", "Profit")}</TableHead>
                    <TableHead className="text-left">{headerBtn("profitMargin", "Margin %")}</TableHead>
                    <TableHead className="text-left">Budget</TableHead>
                    <TableHead className="text-left">{headerBtn("budgetVariance", "vs budget")}</TableHead>
                    <TableHead className="text-left">{headerBtn("profitStatus", "Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((row) => {
                    const ps = profitStatus(row);
                    const rowTint =
                      ps === "profitable"
                        ? "bg-green-50/80 dark:bg-green-950/25"
                        : ps === "loss"
                          ? "bg-red-50/80 dark:bg-red-950/25"
                          : "bg-neutral-50/50 dark:bg-neutral-900/30";
                    const budgetNum = row.budget != null ? Number(row.budget) : null;
                    const hasBudget = row.budget != null && !Number.isNaN(budgetNum ?? NaN);

                    return (
                      <TableRow key={row.projectId} className={rowTint}>
                        <TableCell className="text-left align-top">
                          <Link
                            href={`/dashboard/projects/${row.projectId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.projectName}
                          </Link>
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            <Link href={`/dashboard/clients/${row.clientId}`} className="hover:text-foreground hover:underline">
                              {row.clientName ?? "—"}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-left align-top">
                          <SarAmount value={row.totalRevenue} />
                        </TableCell>
                        <TableCell className="text-left align-top">
                          <SarAmount value={row.totalExpenses} />
                        </TableCell>
                        <TableCell className="text-left align-top">
                          <SarAmount
                            value={row.profit}
                            className={
                              row.profit > EPS
                                ? "text-green-700 dark:text-green-400"
                                : row.profit < -EPS
                                  ? "text-red-700 dark:text-red-400"
                                  : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="text-left align-top">
                          {row.profitMargin != null ? (
                            <span
                              className={
                                row.profitMargin >= 0
                                  ? "font-medium text-green-700 dark:text-green-400"
                                  : "font-medium text-red-700 dark:text-red-400"
                              }
                            >
                              {row.profitMargin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-left align-top">
                          {hasBudget && budgetNum != null ? (
                            <SarAmount value={budgetNum} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-left align-top">
                          {row.budgetVariance != null ? (
                            <SarAmount
                              value={row.budgetVariance}
                              className={
                                row.budgetVariance >= 0
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-red-700 dark:text-red-400"
                              }
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-left align-top">
                          <span
                            className={
                              ps === "profitable"
                                ? "font-medium text-green-800 dark:text-green-300"
                                : ps === "loss"
                                  ? "font-medium text-red-800 dark:text-red-300"
                                  : "text-muted-foreground"
                            }
                          >
                            {statusLabel(ps)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ReportTablePaginationBar
                page={pagination.page}
                pageSize={pagination.pageSize}
                pageCount={pagination.pageCount}
                total={pagination.total}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                hidePageSizeSelect={pagination.isPageSizeFixed}
                className="mt-3 border-t-0 pt-3"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
