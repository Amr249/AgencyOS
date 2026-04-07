"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InvoiceDetailActions } from "./invoice-detail-actions";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { MarkAsPaidDialog } from "./mark-as-paid-dialog";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  /** Remaining balance for payment dialog helper */
  amountDue?: number;
};

type InvoiceDetailHeaderProps = {
  invoice: Invoice;
};

export function InvoiceDetailHeader({ invoice }: InvoiceDetailHeaderProps) {
  const router = useRouter();
  const [payDialogOpen, setPayDialogOpen] = React.useState(false);

  return (
    <div dir="ltr" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <InvoiceDetailActions
        invoice={invoice}
        onOpenMarkAsPaidDialog={
          invoice.status === "pending" || invoice.status === "partial"
            ? () => setPayDialogOpen(true)
            : undefined
        }
      />
      <div>
        <InvoiceStatusBadge
          invoiceId={invoice.id}
          status={invoice.status}
          invoiceNumber={invoice.invoiceNumber}
          onRequestMarkAsPaid={
            invoice.status === "pending" || invoice.status === "partial"
              ? () => setPayDialogOpen(true)
              : undefined
          }
        />
      </div>
      <MarkAsPaidDialog
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        remainingAmountSar={
          invoice.status === "pending" || invoice.status === "partial" ? invoice.amountDue : undefined
        }
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
