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
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
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
}: {
  rows: OutstandingInvoiceRow[];
  totalOutstanding: number;
}) {
  const router = useRouter();
  const [payDialog, setPayDialog] = useState<OutstandingInvoiceRow | null>(null);
  const { formatAmount } = useReportsCurrency();

  const totalFormatted = formatAmount(totalOutstanding);

  return (
    <>
      <div className="overflow-x-auto" dir="rtl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم الفاتورة</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">المشروع</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">تاريخ الإصدار</TableHead>
              <TableHead className="text-right">الأيام المنقضية</TableHead>
              <TableHead className="w-[120px] text-right">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  لا توجد فواتير مستحقة.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-right font-medium">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-primary hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/clients/${inv.clientId}`}
                      className="flex items-center justify-end gap-2 hover:underline"
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
                  <TableCell className="text-right">{inv.projectName ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatAmount(Number(inv.total))}</TableCell>
                  <TableCell className="text-right">{formatDate(inv.issueDate)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${inv.daysSinceIssue > 30 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {inv.daysSinceIssue}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPayDialog(inv)}
                    >
                      تحديد كمدفوعة
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-bold">
                  الإجمالي المستحق
                </TableCell>
                <TableCell colSpan={2} className="text-right font-bold">
                  {totalFormatted}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <MarkAsPaidDialog
        invoiceId={payDialog?.id ?? ""}
        invoiceNumber={payDialog?.invoiceNumber}
        open={!!payDialog}
        onOpenChange={(open) => !open && setPayDialog(null)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
