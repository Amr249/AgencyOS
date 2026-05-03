import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  getInvoicesWithPayments,
  getInvoiceStatsWithPayments,
  getNextInvoiceNumber,
  migrateInvoicesToNewFormat,
} from "@/actions/invoices";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { InvoicesListView } from "@/components/modules/invoices/invoices-list-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoices");
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

type PageProps = {
  searchParams: Promise<{
    status?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }>;
};

export default async function InvoicesPage({ searchParams }: PageProps) {
  const { status, dateRange, dateFrom, dateTo, search } = await searchParams;
  const invoiceFilters = {
    status: status ?? undefined,
    dateRange: dateRange ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
    search: search ?? undefined,
  };
  const tList = await getTranslations("invoices.list");
  const [invoicesResult, statsResult, clientsResult, settingsResult, nextNumResult] = await Promise.all([
    getInvoicesWithPayments(invoiceFilters),
    getInvoiceStatsWithPayments(),
    getClientsList(),
    getSettings(),
    getNextInvoiceNumber(),
  ]);

  if (!invoicesResult.ok) {
    const t = await getTranslations("invoices");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("loadErrorTitle")}</h1>
        <p className="text-destructive">{invoicesResult.error}</p>
      </div>
    );
  }

  let invoices = invoicesResult.data;
  const stats = statsResult.ok ? statsResult.data : { totalInvoiced: 0, collected: 0, outstanding: 0 };
  const clients = clientsResult.ok ? clientsResult.data : [];
  const settings = settingsResult.ok ? settingsResult.data : null;
  let nextInvoiceNumber = nextNumResult.ok ? nextNumResult.data : "INV-001";

  /** Only auto-run legacy fix when invoice numbers look like MIG-{uuid} (broken migration), not for custom prefixes. */
  const needsMigration = invoices.some((inv) => !/^INV-\d{3,}$/.test(inv.invoiceNumber));
  if (needsMigration) {
    const migrated = await migrateInvoicesToNewFormat();
    if (migrated.ok) {
      const [reinv, renext] = await Promise.all([getInvoicesWithPayments(invoiceFilters), getNextInvoiceNumber()]);
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
    <Suspense fallback={<div className="text-muted-foreground">{tList("loading")}</div>}>
      <InvoicesListView
        invoices={invoices}
        stats={stats}
        clients={clients.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          logoUrl: c.logoUrl,
        }))}
        settings={settingsData}
        nextInvoiceNumber={nextInvoiceNumber}
      />
    </Suspense>
  );
}
