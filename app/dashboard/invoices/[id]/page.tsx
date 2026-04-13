import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getInvoiceById, getInvoiceWithPayments } from "@/actions/invoices";
import { getFiles } from "@/actions/files";
import { getSettings } from "@/actions/settings";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatDate } from "@/lib/utils";
import { SarMoney } from "@/components/ui/sar-money";
import { InvoiceDetailHeader } from "@/components/modules/invoices/invoice-detail-header";
import { PaymentHistory } from "@/components/modules/invoices/payment-history";
import { InvoiceAttachments } from "@/components/modules/invoices/invoice-attachments";
import type { AddressJson } from "@/lib/db/schema";
import { PAYMENT_METHOD_LABELS } from "@/types";

const INVOICE_CARD_BORDER_DEFAULT = "#6366f1"; // indigo-500

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getInvoiceById(id);
  if (!result.ok) return { title: "Invoice | AgencyOS" };
  return {
    title: `${result.data.invoiceNumber} | AgencyOS`,
    description: `Invoice ${result.data.invoiceNumber}`,
  };
}

function formatAddress(addr: AddressJson | null): string {
  if (!addr) return "";
  const parts = [addr.street, addr.city, addr.postal, addr.country].filter(Boolean);
  return parts.join(", ");
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const [invoiceResult, settingsResult, filesResult] = await Promise.all([
    getInvoiceWithPayments(id),
    getSettings(),
    getFiles({ invoiceId: id }),
  ]);

  if (!invoiceResult.ok) {
    if (invoiceResult.error === "Invoice not found" || invoiceResult.error === "Invalid invoice id") {
      notFound();
    }
    return (
      <div>
        <p className="text-destructive">{invoiceResult.error}</p>
      </div>
    );
  }

  const invoice = invoiceResult.data;
  const settings = settingsResult.ok ? settingsResult.data : null;
  const attachmentFiles = filesResult.ok ? filesResult.data : [];
  const agencyAddress = settings?.agencyAddress ?? null;
  const clientName = invoice.client?.companyName ?? "—";
  const clientAddress = invoice.client?.address ?? null;
  return (
    <div className="space-y-6">
      <Breadcrumb dir="ltr">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/invoices">Invoices</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{invoice.invoiceNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <InvoiceDetailHeader invoice={invoice} />

      <div
        dir="ltr"
        className="rounded-lg border border-t-4 bg-card p-6 shadow-sm print:border-0 print:shadow-none"
        style={{ borderTopColor: settings?.invoiceColor ?? INVOICE_CARD_BORDER_DEFAULT }}
      >
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="text-left">
            {settings?.agencyLogoUrl ? (
              <Image
                src={settings.agencyLogoUrl}
                alt={settings.agencyName ?? "Agency"}
                width={120}
                height={60}
                className="mb-2 max-h-[60px] w-auto object-contain object-left"
              />
            ) : (
              <p className="mb-2 font-bold">{settings?.agencyName ?? "Agency"}</p>
            )}
            {settings?.agencyLogoUrl ? (
              <p className="font-semibold">{settings?.agencyName ?? "Agency"}</p>
            ) : null}
            <p className="text-muted-foreground whitespace-pre-line text-sm">
              {formatAddress(agencyAddress)}
              {settings?.agencyEmail ? `\n${settings.agencyEmail}` : ""}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
            <p className="text-muted-foreground text-sm">
              Issue date: {formatDate(invoice.issueDate)}
            </p>
            {invoice.dueDate && (
              <p className="text-muted-foreground text-sm">Due date: {formatDate(invoice.dueDate)}</p>
            )}
            {invoice.status === "paid" && invoice.paidAt && (
              <>
                <p className="text-muted-foreground text-sm">
                  Payment date: {formatDate(invoice.paidAt instanceof Date ? invoice.paidAt.toISOString().slice(0, 10) : String(invoice.paidAt))}
                </p>
                {invoice.paymentMethod && (
                  <p className="text-muted-foreground text-sm">
                    Payment method: {PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-left">
          <p className="text-muted-foreground text-xs font-medium uppercase">Bill To</p>
          <p className="font-medium">{clientName}</p>
          <p className="text-muted-foreground whitespace-pre-line text-sm">
            {formatAddress(clientAddress as AddressJson | null)}
          </p>
        </div>

        {invoice.linkedProjects && invoice.linkedProjects.length > 0 ? (
          <div className="mt-6 text-left">
            <p className="text-muted-foreground text-xs font-medium uppercase">Related projects</p>
            <p className="text-sm">{invoice.linkedProjects.map((p) => p.name).join(", ")}</p>
          </div>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 pr-4 text-left font-medium">Description</th>
                <th className="pb-2 pr-4 text-left font-medium">Qty</th>
                <th className="pb-2 pr-4 text-left font-medium">Unit Price</th>
                <th className="pb-2 pr-4 text-left font-medium">Tax %</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items ?? []).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-left">{item.description}</td>
                  <td className="py-2 pr-4 text-left">{Number(item.quantity)}</td>
                  <td className="py-2 pr-4 text-left">
                    <SarMoney value={item.unitPrice} iconClassName="h-3 w-3" />
                  </td>
                  <td className="py-2 pr-4 text-left">{Number(item.taxRate)}%</td>
                  <td className="py-2 text-right">
                    <SarMoney value={item.amount} iconClassName="h-3 w-3" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                <SarMoney value={invoice.subtotal} iconClassName="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Tax</span>
              <span>
                <SarMoney value={invoice.taxAmount} iconClassName="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
              <span>Grand Total</span>
              <span>
                <SarMoney value={invoice.total} iconClassName="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div className="mt-6 border-t pt-6">
            <p className="text-muted-foreground text-xs font-medium uppercase">Notes</p>
            <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>
          </div>
        ) : null}
      </div>

      <PaymentHistory
        invoiceId={invoice.id}
        payments={invoice.payments ?? []}
        totalPaid={invoice.totalPaid ?? 0}
        amountDue={invoice.amountDue ?? parseFloat(invoice.total)}
        invoiceTotal={parseFloat(invoice.total)}
        paymentProgress={invoice.paymentProgress ?? 0}
        currency={invoice.currency}
        invoiceStatus={invoice.status}
      />

      <InvoiceAttachments invoiceId={invoice.id} initialFiles={attachmentFiles} />
    </div>
  );
}
