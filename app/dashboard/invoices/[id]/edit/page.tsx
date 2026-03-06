import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
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
import { EditInvoiceForm } from "@/components/modules/invoices/edit-invoice-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getInvoiceById(id);
  if (!result.ok) return { title: "Edit Invoice | AgencyOS" };
  return {
    title: `Edit ${result.data.invoiceNumber} | AgencyOS`,
  };
}

export default async function EditInvoicePage({ params }: Props) {
  const { id } = await params;
  const [invoiceResult, settingsResult] = await Promise.all([
    getInvoiceById(id),
    getSettings(),
  ]);

  if (!invoiceResult.ok) {
    if (invoiceResult.error === "Invoice not found" || invoiceResult.error === "Invalid invoice id") {
      notFound();
    }
    return <p className="text-destructive">{invoiceResult.error}</p>;
  }

  const invoice = invoiceResult.data;
  if (invoice.status !== "pending") {
    notFound();
  }

  const settings = settingsResult.ok ? settingsResult.data : null;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/invoices">Invoices</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/dashboard/invoices/${id}`}>{invoice.invoiceNumber}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit Invoice</h1>
        <Link href={`/dashboard/invoices/${id}`}>
          <span className="text-muted-foreground text-sm hover:underline">View invoice</span>
        </Link>
      </div>

      <EditInvoiceForm invoice={invoice} settings={settings} />
    </div>
  );
}
