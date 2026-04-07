"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportsMoney } from "@/components/reports/reports-money";
import { cn, generateAvatarFallback } from "@/lib/utils";
import type { ClientProfitabilityRow, ClientProfitabilitySummary } from "@/actions/reports";
import { downloadReportPdf } from "@/lib/reports-pdf-download";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";

type ClientProfitabilitySectionProps = {
  rows: ClientProfitabilityRow[];
  summary: ClientProfitabilitySummary;
  /** When set, locks rows per page (hides page-size selector). */
  tablePageSize?: number;
};

function profitClass(profit: number) {
  if (profit > 0.0001) return "text-green-600 font-semibold tabular-nums";
  if (profit < -0.0001) return "text-red-600 font-semibold tabular-nums";
  return "text-muted-foreground tabular-nums";
}

function marginClass(profit: number, revenue: number) {
  if (revenue <= 0.0001) return "text-muted-foreground tabular-nums";
  if (profit > 0.0001) return "text-green-600 font-medium tabular-nums";
  if (profit < -0.0001) return "text-red-600 font-medium tabular-nums";
  return "text-muted-foreground tabular-nums";
}

export function ClientProfitabilitySection({ rows, summary, tablePageSize }: ClientProfitabilitySectionProps) {
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const pagination = useReportPagination(
    rows,
    tablePageSize != null && tablePageSize > 0 ? { fixedPageSize: tablePageSize } : undefined
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-left text-sm font-medium">
              Clients analyzed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold tabular-nums">{summary.clientCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-left text-sm font-medium">
              Total revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.totalRevenue} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Payments on client invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-left text-sm font-medium">
              Total expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-2xl font-bold">
              <ReportsMoney amount={summary.totalExpenses} iconClassName="h-5 w-5" />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Direct client + project-linked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-left text-sm font-medium">
              Net profit
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className={cn("text-2xl font-bold", profitClass(summary.netProfit))}>
              <ReportsMoney amount={summary.netProfit} iconClassName="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-left">Client profitability</CardTitle>
            <p className="text-muted-foreground mt-1 text-left text-sm">
              Revenue from payments on client invoices vs. expenses with that client or linked project.
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
              void downloadReportPdf({ type: "client-profitability" })
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
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">No clients to display.</p>
          ) : (
            <div className="space-y-3" dir="ltr">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Client</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Expense lines</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((row) => (
                    <TableRow key={row.clientId}>
                    <TableCell>
                      <Link
                        href={`/dashboard/clients/${row.clientId}`}
                        className="hover:bg-muted/50 -m-2 flex items-center gap-3 rounded-md p-2 text-left transition-colors"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          {row.logoUrl ? (
                            <AvatarImage src={row.logoUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {generateAvatarFallback(row.companyName ?? "")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-primary font-medium hover:underline">
                          {row.companyName ?? "—"}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.projectCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.invoiceCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.expenseCount}</TableCell>
                    <TableCell className="text-right">
                      <ReportsMoney amount={row.totalRevenue} iconClassName="h-4 w-4" />
                    </TableCell>
                    <TableCell className="text-right">
                      <ReportsMoney amount={row.totalExpenses} iconClassName="h-4 w-4" />
                    </TableCell>
                    <TableCell className={`text-right ${profitClass(row.profit)}`}>
                      <ReportsMoney amount={row.profit} iconClassName="h-4 w-4" />
                    </TableCell>
                    <TableCell className={`text-right ${marginClass(row.profit, row.totalRevenue)}`}>
                      {row.totalRevenue > 0.0001 ? `${row.profitMargin.toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                  ))}
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
                className="border-t-0 pt-1"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
