"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { SarMoney } from "@/components/ui/sar-money";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  total: string;
  status: string;
  currency: string;
};

type ProjectInvoicesTabProps = {
  projectId: string;
  invoices: InvoiceRow[];
  defaultCurrency: string;
};

function AmountCell({ value, currency, defaultCurrency }: { value: string; currency: string; defaultCurrency: string }) {
  const c = currency || defaultCurrency;
  if (c === "SAR" || c === "ر.س") {
    return <SarMoney value={value} iconClassName="h-3 w-3" />;
  }
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);
}

export function ProjectInvoicesTab({
  projectId,
  invoices,
  defaultCurrency,
}: ProjectInvoicesTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Invoices</CardTitle>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/dashboard/invoices?projectId=${projectId}`}>
            <PlusCircledIcon className="me-2 h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invoices for this project yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pe-4 font-medium">Invoice #</th>
                  <th className="pb-2 pe-4 font-medium">Amount</th>
                  <th className="pb-2 pe-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2 pe-4">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="font-medium hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2 pe-4">
                      <AmountCell value={inv.total} currency={inv.currency} defaultCurrency={defaultCurrency} />
                    </td>
                    <td className="py-2 pe-4">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "bg-muted"}`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
