import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getInvoiceById } from "@/actions/invoices";
import { getSettings } from "@/actions/settings";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatBudgetSAR, formatDate } from "@/lib/utils";
import { InvoiceDetailHeader } from "@/components/modules/invoices/invoice-detail-header";
import type { AddressJson } from "@/lib/db/schema";

const INVOICE_CARD_BORDER_DEFAULT = "#6366f1"; // indigo-500

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقداً",
  credit_card: "بطاقة ائتمان",
  other: "أخرى",
};

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
  const [invoiceResult, settingsResult] = await Promise.all([
    getInvoiceById(id),
    getSettings(),
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
  const agencyAddress = settings?.agencyAddress ?? null;

  return (
    <div className="space-y-6">
      <Breadcrumb dir="rtl">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/invoices">الفواتير</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>‹</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{invoice.invoiceNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <InvoiceDetailHeader invoice={invoice} />

      <div
        dir="rtl"
        className="rounded-lg border border-t-4 bg-card p-6 shadow-sm print:border-0 print:shadow-none"
        style={{ borderTopColor: settings?.invoiceColor ?? INVOICE_CARD_BORDER_DEFAULT }}
      >
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="text-end">
            {settings?.agencyLogoUrl ? (
              <Image
                src={settings.agencyLogoUrl}
                alt={settings.agencyName ?? "اسم الوكالة"}
                width={120}
                height={60}
                className="mb-2 max-h-[60px] w-auto object-contain object-right"
              />
            ) : (
              <p className="mb-2 font-bold">{settings?.agencyName ?? "اسم الوكالة"}</p>
            )}
            {settings?.agencyLogoUrl ? (
              <p className="font-semibold">{settings?.agencyName ?? "اسم الوكالة"}</p>
            ) : null}
            <p className="text-muted-foreground whitespace-pre-line text-sm">
              {formatAddress(agencyAddress)}
              {settings?.agencyEmail ? `\n${settings.agencyEmail}` : ""}
            </p>
          </div>
          <div className="text-end">
            <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
            <p className="text-muted-foreground text-sm">
              تاريخ الإصدار: {formatDate(invoice.issueDate)}
            </p>
            {invoice.status === "paid" && invoice.paidAt && (
              <>
                <p className="text-muted-foreground text-sm">
                  تاريخ الدفع: {formatDate(invoice.paidAt instanceof Date ? invoice.paidAt.toISOString().slice(0, 10) : String(invoice.paidAt))}
                </p>
                {invoice.paymentMethod && (
                  <p className="text-muted-foreground text-sm">
                    طريقة الدفع: {PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-end">
          <p className="text-muted-foreground text-xs font-medium uppercase">فاتورة إلى</p>
          <p className="font-medium">{invoice.clientName ?? "—"}</p>
          <p className="text-muted-foreground whitespace-pre-line text-sm">
            {formatAddress(invoice.clientAddress as AddressJson | null)}
          </p>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 pl-4 text-end font-medium">الوصف</th>
                <th className="pb-2 pl-4 text-end font-medium">الكمية</th>
                <th className="pb-2 pl-4 text-end font-medium">سعر الوحدة</th>
                <th className="pb-2 pl-4 text-end font-medium">الضريبة %</th>
                <th className="pb-2 text-start font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 pl-4 text-end">{item.description}</td>
                  <td className="py-2 pl-4 text-end">{Number(item.quantity)}</td>
                  <td className="py-2 pl-4 text-end">{formatBudgetSAR(item.unitPrice)}</td>
                  <td className="py-2 pl-4 text-end">{Number(item.taxRate)}%</td>
                  <td className="py-2 text-start">{formatBudgetSAR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-start">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{formatBudgetSAR(invoice.subtotal)}</span>
              <span className="text-muted-foreground">المجموع الفرعي</span>
            </div>
            <div className="flex justify-between">
              <span>{formatBudgetSAR(invoice.taxAmount)}</span>
              <span className="text-muted-foreground">الضريبة</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{formatBudgetSAR(invoice.total)}</span>
              <span>الإجمالي الكلي</span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div className="mt-6 border-t pt-6">
            <p className="text-muted-foreground text-xs font-medium uppercase">ملاحظات</p>
            <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
