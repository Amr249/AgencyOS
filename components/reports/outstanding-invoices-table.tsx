"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { MarkAsPaidDialog } from "@/components/modules/invoices/mark-as-paid-dialog";
import { ReportsMoney } from "@/components/reports/reports-money";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";
import type { OutstandingInvoiceRow } from "@/actions/reports";

function formatDate(value: string): string {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return value;
  }
}

export function OutstandingInvoicesTable({
  rows,
  totalOutstanding,
  pageSize,
}: {
  rows: OutstandingInvoiceRow[];
  totalOutstanding: number;
  /** Fixed rows per page for compact dashboard tables. */
  pageSize?: number;
}) {
  const router = useRouter();
  const [payDialog, setPayDialog] = useState<OutstandingInvoiceRow | null>(null);
  const pagination = useReportPagination(
    rows,
    pageSize != null && pageSize > 0 ? { fixedPageSize: pageSize } : undefined
  );

  return (
    <>
      <div className="overflow-x-auto" dir="ltr">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Invoice #</TableHead>
              <TableHead className="text-left">Client</TableHead>
              <TableHead className="text-left">Project</TableHead>
              <TableHead className="text-left">Amount due</TableHead>
              <TableHead className="text-left">Issue date</TableHead>
              <TableHead className="text-left">Days since issue</TableHead>
              <TableHead className="w-[120px] text-left">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No outstanding invoices.
                </TableCell>
              </TableRow>
            ) : (
              pagination.pageItems.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-left font-medium">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-primary hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-left">
                    <Link
                      href={`/dashboard/clients/${inv.clientId}`}
                      className="flex items-center justify-start gap-2 hover:underline"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={inv.clientLogoUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(inv.clientName ?? "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      {inv.clientName ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-left">{inv.projectName ?? "—"}</TableCell>
                  <TableCell className="text-left">
                    <ReportsMoney amount={Number(inv.amountDue)} iconClassName="h-3.5 w-3.5" />
                  </TableCell>
                  <TableCell className="text-left">{formatDate(inv.issueDate)}</TableCell>
                  <TableCell
                    className={`text-left font-medium ${inv.daysSinceIssue > 30 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {inv.daysSinceIssue}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button variant="outline" size="sm" onClick={() => setPayDialog(inv)}>
                      Mark as Paid
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-left font-bold">
                  Total outstanding
                </TableCell>
                <TableCell colSpan={3} className="text-left font-bold">
                  <ReportsMoney amount={totalOutstanding} iconClassName="h-4 w-4" />
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
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

      <MarkAsPaidDialog
        invoiceId={payDialog?.id ?? ""}
        invoiceNumber={payDialog?.invoiceNumber}
        remainingAmountSar={payDialog ? Number(payDialog.amountDue) : undefined}
        open={!!payDialog}
        onOpenChange={(open) => !open && setPayDialog(null)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
