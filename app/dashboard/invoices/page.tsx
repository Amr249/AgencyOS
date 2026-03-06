import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getInvoices,
  getInvoiceStats,
  getNextInvoiceNumber,
  migrateInvoicesToNewFormat,
} from "@/actions/invoices";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { InvoicesListView } from "@/components/modules/invoices/invoices-list-view";

export const metadata: Metadata = {
  title: "الفواتير",
  description: "Invoices and billing",
};

type PageProps = {
  searchParams: Promise<{ status?: string; dateRange?: string; search?: string }>;
};

export default async function InvoicesPage({ searchParams }: PageProps) {
  const { status, dateRange, search } = await searchParams;
  const [invoicesResult, statsResult, clientsResult, settingsResult, nextNumResult] = await Promise.all([
    getInvoices({ status: status ?? undefined, dateRange: dateRange ?? undefined, search: search ?? undefined }),
    getInvoiceStats(),
    getClientsList(),
    getSettings(),
    getNextInvoiceNumber(),
  ]);

  if (!invoicesResult.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">الفواتير</h1>
        <p className="text-destructive">{invoicesResult.error}</p>
      </div>
    );
  }

  let invoices = invoicesResult.data;
  const stats = statsResult.ok ? statsResult.data : { totalInvoiced: 0, collected: 0, outstanding: 0 };
  const clients = clientsResult.ok ? clientsResult.data : [];
  const settings = settingsResult.ok ? settingsResult.data : null;
  let nextInvoiceNumber = nextNumResult.ok ? nextNumResult.data : "فاتورة-001";

  const needsMigration = invoices.some((inv) => !/^فاتورة-\d{3}$/.test(inv.invoiceNumber));
  if (needsMigration) {
    const migrated = await migrateInvoicesToNewFormat();
    if (migrated.ok) {
      const [reinv, renext] = await Promise.all([
        getInvoices({ status: status ?? undefined, dateRange: dateRange ?? undefined, search: search ?? undefined }),
        getNextInvoiceNumber(),
      ]);
      if (reinv.ok) invoices = reinv.data;
      if (renext.ok) nextInvoiceNumber = renext.data;
    }
  }

  const settingsData = settings
    ? {
        invoicePrefix: settings.invoicePrefix,
        invoiceNextNumber: settings.invoiceNextNumber,
        defaultCurrency: settings.defaultCurrency,
        defaultPaymentTerms: settings.defaultPaymentTerms,
        invoiceFooter: settings.invoiceFooter,
      }
    : null;

  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
      <InvoicesListView
        invoices={invoices}
        stats={stats}
        clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))}
        settings={settingsData}
        nextInvoiceNumber={nextInvoiceNumber}
      />
    </Suspense>
  );
}
