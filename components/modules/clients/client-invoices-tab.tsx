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
import { formatAmount, formatDate } from "@/lib/utils";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

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
  const label = isPaid ? "Paid" : "Pending";
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
      toast.success("Invoice deleted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <>
      <Card className="mb-[25px]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Invoices</CardTitle>
          <NewInvoiceDialog
            trigger={
              <Button variant="secondary" size="sm">
                <PlusCircledIcon className="me-2 h-4 w-4" />
                New Invoice
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
                Total Invoiced:{" "}
                <span className="inline-flex items-center gap-1">
                  {formatAmount(String(totalInvoiced.toFixed(2)))}
                  <SarCurrencyIcon />
                </span>
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Paid:{" "}
                <span className="inline-flex items-center gap-1">
                  {formatAmount(String(totalPaid.toFixed(2)))}
                  <SarCurrencyIcon />
                </span>
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Outstanding:{" "}
                <span className="inline-flex items-center gap-1">
                  {formatAmount(String(totalOutstanding.toFixed(2)))}
                  <SarCurrencyIcon />
                </span>
              </Badge>
            </div>
          )}
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <p className="text-muted-foreground text-sm">No invoices for this client yet.</p>
              <NewInvoiceDialog
                trigger={
                  <Button variant="secondary" size="sm">
                    <PlusCircledIcon className="me-2 h-4 w-4" />
                    Create Invoice
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
            <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Invoice #
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Project
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Issue Date
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="group border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3 text-start">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="text-sm font-medium text-neutral-900 hover:text-neutral-700 hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-start text-sm text-neutral-500">{inv.projectName ?? "—"}</td>
                      <td className="px-4 py-3 text-start text-sm text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          {formatAmount(inv.total)}
                          <SarCurrencyIcon className="text-neutral-500" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-start text-sm text-neutral-500">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-start">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Download PDF
                          </a>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() => setInvoiceToMarkPaid(inv)}
                              >
                                Mark as Paid
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
                                Delete
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
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `Invoice ${invoiceToDelete.invoiceNumber} will be deleted permanently. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleConfirmDelete();
              }}
            >
              Delete
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
