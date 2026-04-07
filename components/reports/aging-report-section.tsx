"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkAsPaidDialog } from "@/components/modules/invoices/mark-as-paid-dialog";
import { ReportsMoney } from "@/components/reports/reports-money";
import { cn, formatDate } from "@/lib/utils";
import type { AgingReportData, AgingReportInvoiceRow } from "@/actions/reports";
import { Wallet } from "lucide-react";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";

const BUCKET_CONFIG: {
  key: keyof Omit<AgingReportData, "invoices">;
  label: string;
  cardClass: string;
}[] = [
  {
    key: "current",
    label: "Current",
    cardClass: "border-green-200 bg-green-50/90 text-green-950 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100",
  },
  {
    key: "days1to30",
    label: "1–30 Days",
    cardClass: "border-yellow-200 bg-yellow-50/90 text-yellow-950 dark:border-yellow-800 dark:bg-yellow-950/25 dark:text-yellow-100",
  },
  {
    key: "days31to60",
    label: "31–60 Days",
    cardClass: "border-orange-200 bg-orange-50/90 text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100",
  },
  {
    key: "days61to90",
    label: "61–90 Days",
    cardClass: "border-orange-300 bg-orange-100/90 text-orange-950 dark:border-orange-700 dark:bg-orange-950/40",
  },
  {
    key: "days90plus",
    label: "90+ Days",
    cardClass: "border-red-300 bg-red-50/90 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100",
  },
];

function daysOverdueClass(days: number): string {
  if (days <= 0) return "text-green-700 dark:text-green-400 font-semibold";
  if (days <= 30) return "text-yellow-700 dark:text-yellow-400 font-semibold";
  if (days <= 60) return "text-orange-600 dark:text-orange-400 font-semibold";
  if (days <= 90) return "text-orange-800 dark:text-orange-300 font-semibold";
  return "text-red-600 dark:text-red-400 font-semibold";
}

type AgingReportSectionProps = {
  data: AgingReportData;
  /** Paginate the detail table (e.g. 6 for dashboard side column). */
  detailPageSize?: number;
  variant?: "default" | "panel";
};

export function AgingReportSection({ data, detailPageSize, variant = "default" }: AgingReportSectionProps) {
  const router = useRouter();
  const [payTarget, setPayTarget] = React.useState<AgingReportInvoiceRow | null>(null);

  const rows = data.invoices;
  const pagination = useReportPagination(
    rows,
    detailPageSize != null && detailPageSize > 0
      ? { fixedPageSize: detailPageSize }
      : { all: true }
  );

  const buckets = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {BUCKET_CONFIG.map(({ key, label, cardClass }) => {
        const b = data[key];
        return (
          <Card key={key} className={cardClass}>
            <CardHeader className="pb-1 pt-2">
              <CardTitle className="text-left text-xs font-medium leading-tight">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pb-2 text-left">
              <p className="text-lg font-bold tabular-nums sm:text-2xl">{b.count}</p>
              <p className="text-xs opacity-90">invoices</p>
              <p className="text-xs font-semibold tabular-nums sm:text-sm">
                <ReportsMoney amount={b.total} iconClassName="h-3.5 w-3.5 opacity-80" />
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const detailTable = (
    <Card className={cn(variant === "panel" && "border-0 bg-muted/25 shadow-none")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-left text-base">Outstanding invoice detail</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table dir="ltr">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Invoice #</TableHead>
              <TableHead className="text-left">Client</TableHead>
              <TableHead className="text-left">Due Date</TableHead>
              <TableHead className="text-left">Days Overdue</TableHead>
              <TableHead className="text-left">Amount Due</TableHead>
              <TableHead className="w-[200px] text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No outstanding invoices with a balance due.
                </TableCell>
              </TableRow>
            ) : (
              pagination.pageItems.map((row) => (
                <TableRow key={row.invoice.id}>
                  <TableCell className="text-left font-medium">
                    <Link
                      href={`/dashboard/invoices/${row.invoice.id}`}
                      className="text-primary hover:underline"
                    >
                      {row.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-left">
                    <Link
                      href={`/dashboard/clients/${row.client.id}`}
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={row.client.logoUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(row.client.companyName ?? "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate">{row.client.companyName ?? "—"}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-left tabular-nums">{formatDate(row.dueDate)}</TableCell>
                  <TableCell className={`text-left tabular-nums ${daysOverdueClass(row.daysOverdue)}`}>
                    {row.daysOverdue}
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    <ReportsMoney amount={row.amountDue} iconClassName="h-3.5 w-3.5" />
                  </TableCell>
                  <TableCell className="text-left">
                    <Link href={`/dashboard/invoices/${row.invoice.id}`}>
                      <Button variant="link" size="sm" className="h-auto px-1">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-1"
                      onClick={() => setPayTarget(row)}
                    >
                      Record payment
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
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
          className="mt-3 border-t-0 px-3 pt-3"
        />
      </CardContent>
    </Card>
  );

  const inner = (
    <div className="space-y-4" dir="ltr">
      {variant === "default" ? (
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Accounts Receivable Aging</h2>
        </div>
      ) : null}
      {buckets}
      {detailTable}
    </div>
  );

  return (
    <>
      {variant === "panel" ? (
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-left text-base font-semibold">Accounts receivable aging</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-0">{inner}</CardContent>
        </Card>
      ) : (
        inner
      )}

      <MarkAsPaidDialog
        invoiceId={payTarget?.invoice.id ?? ""}
        invoiceNumber={payTarget?.invoice.invoiceNumber}
        remainingAmountSar={payTarget?.amountDue}
        open={!!payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
