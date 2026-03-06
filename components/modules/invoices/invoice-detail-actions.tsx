"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { duplicateInvoice } from "@/actions/invoices";
import { toast } from "sonner";
import { MarkAsPaidDialog } from "./mark-as-paid-dialog";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
};

type InvoiceDetailActionsProps = {
  invoice: Invoice;
  /** When provided (e.g. on detail page), the "تحديد كمدفوعة" button calls this instead of opening an internal dialog. */
  onOpenMarkAsPaidDialog?: () => void;
};

export function InvoiceDetailActions({ invoice, onOpenMarkAsPaidDialog }: InvoiceDetailActionsProps) {
  const router = useRouter();
  const [paidOpen, setPaidOpen] = React.useState(false);
  const openPayDialog = onOpenMarkAsPaidDialog ?? (() => setPaidOpen(true));
  const showDialog = !onOpenMarkAsPaidDialog;

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
  };

  const handleDuplicate = async () => {
    const res = await duplicateInvoice(invoice.id);
    if (res.ok) {
      toast.success("تم نسخ الفاتورة");
      router.push(`/dashboard/invoices/${res.data?.id}`);
      router.refresh();
    } else {
      const err = (res as { error?: unknown }).error;
      const msg = typeof err === "string" ? err : (err as { _form?: string[] })?._form?.[0] ?? "فشل";
      toast.error(msg);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
          تحميل PDF
        </Button>
        {invoice.status === "pending" && (
          <Button variant="outline" size="sm" onClick={openPayDialog}>
            تحديد كمدفوعة
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleDuplicate}>
          نسخ
        </Button>
      </div>

      {showDialog && (
        <MarkAsPaidDialog
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          open={paidOpen}
          onOpenChange={setPaidOpen}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
