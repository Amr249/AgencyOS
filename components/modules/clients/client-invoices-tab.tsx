"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NewInvoiceDialog } from "@/components/modules/invoices/new-invoice-dialog";
import { MarkAsPaidDialog } from "@/components/modules/invoices/mark-as-paid-dialog";
import { deleteInvoice } from "@/actions/invoices";
import { formatBudgetSAR, formatDate } from "@/lib/utils";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  projectId: string | null;
  projectName: string | null;
  total: string;
  status: string;
  issueDate: string;
};

type SettingsData = {
  invoicePrefix: string | null;
  invoiceNextNumber: number | null;
  defaultCurrency: string | null;
  defaultPaymentTerms: number | null;
  invoiceFooter: string | null;
};

type ClientInvoicesTabProps = {
  clientId: string;
  clientName: string;
  invoices: InvoiceRow[];
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  clients: { id: string; companyName: string | null }[];
  settings: SettingsData | null;
  nextInvoiceNumber: string;
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const isPaid = status === "paid";
  const label = isPaid ? "تم الدفع" : "بانتظار الدفع";
  const className = isPaid
    ? "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
    : "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function ClientInvoicesTab({
  clientId,
  clientName,
  invoices,
  totalInvoiced,
  totalPaid,
  totalOutstanding,
  clients,
  settings,
  nextInvoiceNumber,
}: ClientInvoicesTabProps) {
  const router = useRouter();
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<InvoiceRow | null>(null);
  const [invoiceToMarkPaid, setInvoiceToMarkPaid] = React.useState<InvoiceRow | null>(null);

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    const id = invoiceToDelete.id;
    setInvoiceToDelete(null);
    const res = await deleteInvoice(id);
    if (res.ok) {
      toast.success("تم حذف الفاتورة");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>الفواتير</CardTitle>
          <NewInvoiceDialog
            trigger={
              <Button variant="secondary" size="sm">
                <PlusCircledIcon className="me-2 h-4 w-4" />
                فاتورة جديدة
              </Button>
            }
            clients={clients}
            settings={settings}
            nextInvoiceNumber={nextInvoiceNumber}
            defaultClientId={clientId}
            onSuccess={() => router.refresh()}
          />
        </CardHeader>
        <CardContent>
          {invoices.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                إجمالي الفواتير: {formatBudgetSAR(String(totalInvoiced.toFixed(2)))}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                مدفوع: {formatBudgetSAR(String(totalPaid.toFixed(2)))}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                غير مدفوع: {formatBudgetSAR(String(totalOutstanding.toFixed(2)))}
              </Badge>
            </div>
          )}
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <p className="text-muted-foreground text-sm">لا توجد فواتير لهذا العميل بعد.</p>
              <NewInvoiceDialog
                trigger={
                  <Button variant="secondary" size="sm">
                    <PlusCircledIcon className="me-2 h-4 w-4" />
                    إنشاء فاتورة
                  </Button>
                }
                clients={clients}
                settings={settings}
                nextInvoiceNumber={nextInvoiceNumber}
                defaultClientId={clientId}
                onSuccess={() => router.refresh()}
              />
            </div>
          ) : (
            <div className="overflow-x-auto" dir="rtl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="pb-2 ps-4 font-medium">رقم الفاتورة</th>
                    <th className="pb-2 ps-4 font-medium">المشروع</th>
                    <th className="pb-2 ps-4 font-medium">المبلغ</th>
                    <th className="pb-2 ps-4 font-medium">الحالة</th>
                    <th className="pb-2 ps-4 font-medium">تاريخ الإصدار</th>
                    <th className="pb-2 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-3 ps-4 text-right">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 ps-4 text-right">{inv.projectName ?? "—"}</td>
                      <td className="py-3 ps-4 text-right">{formatBudgetSAR(inv.total)}</td>
                      <td className="py-3 ps-4 text-right">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="py-3 ps-4 text-right">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            تحميل PDF
                          </a>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() => setInvoiceToMarkPaid(inv)}
                              >
                                تحديد كمدفوعة
                              </button>
                            </>
                          )}
                          {(inv.status === "draft" || inv.status === "cancelled") && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <button
                                type="button"
                                className="text-xs text-destructive hover:underline"
                                onClick={() => setInvoiceToDelete(inv)}
                              >
                                حذف
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `سيتم حذف الفاتورة ${invoiceToDelete.invoiceNumber} نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleConfirmDelete();
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarkAsPaidDialog
        invoiceId={invoiceToMarkPaid?.id ?? ""}
        invoiceNumber={invoiceToMarkPaid?.invoiceNumber}
        open={!!invoiceToMarkPaid}
        onOpenChange={(open) => !open && setInvoiceToMarkPaid(null)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
