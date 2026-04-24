import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getPortalClientPaymentLedger,
  getPortalInvoices,
} from "@/actions/portal-dashboard";
import {
  PortalClientPaymentsSection,
  PortalPaymentKpiCards,
} from "@/components/portal/portal-client-payments-section";
import {
  PortalOpenInvoicesTable,
  type PortalOpenInvoiceTableRow,
} from "@/components/portal/portal-open-invoices-table";

type InvoiceApiRow = {
  id: string;
  invoiceNumber: string;
  projectId?: string | null;
  projectName: string | null;
  projectCoverImageUrl?: string | null;
  clientLogoUrl?: string | null;
  issueDate: string;
  status: string;
  total: unknown;
  currency: string;
  amountDue: number;
};

function toOpenTableRow(r: InvoiceApiRow): PortalOpenInvoiceTableRow {
  return {
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    projectId: r.projectId ?? null,
    projectName: r.projectName,
    projectCoverImageUrl: r.projectCoverImageUrl ?? null,
    projectClientLogoUrl: r.clientLogoUrl ?? null,
    issueDate: String(r.issueDate),
    status: r.status,
    total: String(r.total),
    amountDue: r.amountDue,
    currency: r.currency,
  };
}

export default async function PortalInvoicesPage() {
  const t = await getTranslations("clientPortal");
  const [invRes, ledgerRes] = await Promise.all([getPortalInvoices(), getPortalClientPaymentLedger()]);

  if (!invRes.ok) {
    if (invRes.error === "unauthorized") {
      redirect(`/login?callbackUrl=${encodeURIComponent("/portal/invoices")}`);
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">{t("invoicesLoadError")}</p>
      </div>
    );
  }

  const rows = (invRes.data ?? []) as InvoiceApiRow[];
  const openRows = rows.filter((r) => r.status !== "paid");
  const openTableData = openRows.map(toOpenTableRow);

  const ledgerOk = ledgerRes.ok;
  const ledger = ledgerOk && ledgerRes.data ? ledgerRes.data : [];
  const defaultCurrency =
    ledgerOk && "defaultCurrency" in ledgerRes
      ? ledgerRes.defaultCurrency
      : (rows[0]?.currency ?? "SAR");

  return (
    <div className="space-y-10" dir="rtl" lang="ar">
      <div className="text-start">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("paymentsTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("paymentsSubtitle")}</p>
      </div>

      <PortalPaymentKpiCards
        ledger={ledger}
        defaultCurrency={defaultCurrency}
        kpiTotalLabel={t("paymentsKpiTotal")}
        kpiMonthLabel={t("paymentsKpiMonth")}
      />

      <section className="space-y-3 text-start" dir="rtl" lang="ar">
        <div>
          <h2 className="text-lg font-semibold leading-none">{t("invoicesOpenSection")}</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">{t("invoicesOpenDesc")}</p>
        </div>
        <PortalOpenInvoicesTable
          data={openTableData}
          showDue
          emptyMessage={t("invoicesEmptySection")}
        />
      </section>

      {!ledgerOk ? (
        <p className="text-destructive text-sm text-start">{t("paymentsLedgerLoadError")}</p>
      ) : null}

      {ledgerOk ? (
        <PortalClientPaymentsSection
          ledger={ledger}
          emptyLedgerMessage={t("paymentsLedgerEmpty")}
        />
      ) : null}
    </div>
  );
}
