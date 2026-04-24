import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";
import { isSarCurrency } from "@/lib/utils";
import type { PortalClientPaymentLedgerRow } from "@/actions/portal-dashboard";
import { MemberPaymentsInsights } from "@/components/member-dashboard/member-payments-insights";
import { PortalPaymentsLedgerTable } from "@/components/portal/portal-payments-ledger-table";
import type { MemberSalaryExpenseRow } from "@/actions/member-dashboard";

export function paymentKpis(rows: PortalClientPaymentLedgerRow[]) {
  let total = 0;
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  let monthTotal = 0;
  for (const r of rows) {
    const n = Number(r.amount);
    if (!Number.isNaN(n)) total += n;
    const base = typeof r.date === "string" ? r.date.slice(0, 10) : "";
    if (!base) continue;
    const d = new Date(`${base}T12:00:00`);
    if (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === y &&
      d.getMonth() === mo &&
      !Number.isNaN(n)
    ) {
      monthTotal += n;
    }
  }
  return { total, monthTotal };
}

function KpiAmount({
  value,
  currency,
}: {
  value: number;
  currency: string;
}) {
  const s = formatAmount(String(value));
  if (isSarCurrency(currency)) {
    return (
      <span className="inline-flex items-center gap-1 text-2xl font-semibold tabular-nums">
        <SarCurrencyIcon className="h-4 w-4" />
        <span>{s}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xl font-semibold tabular-nums">
      <span>{currency}</span>
      <span>{s}</span>
    </span>
  );
}

type KpiProps = {
  ledger: PortalClientPaymentLedgerRow[];
  defaultCurrency: string;
  kpiTotalLabel: string;
  kpiMonthLabel: string;
};

/** Summary cards (إجمالي المدفوعات / هذا الشهر) — same layout as member payments. */
export function PortalPaymentKpiCards({
  ledger,
  defaultCurrency,
  kpiTotalLabel,
  kpiMonthLabel,
}: KpiProps) {
  const { total, monthTotal } = paymentKpis(ledger);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" dir="rtl" lang="ar">
      <Card dir="rtl" className="text-start">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{kpiTotalLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <KpiAmount value={total} currency={defaultCurrency} />
        </CardContent>
      </Card>
      <Card dir="rtl" className="text-start">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{kpiMonthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <KpiAmount value={monthTotal} currency={defaultCurrency} />
        </CardContent>
      </Card>
    </div>
  );
}

type SectionProps = {
  ledger: PortalClientPaymentLedgerRow[];
  emptyLedgerMessage: string;
};

/** Sortable ledger + payment analytics charts. */
export function PortalClientPaymentsSection({ ledger, emptyLedgerMessage }: SectionProps) {
  const insightsRows = ledger as unknown as MemberSalaryExpenseRow[];

  return (
    <div className="space-y-8" dir="rtl" lang="ar">
      <PortalPaymentsLedgerTable data={ledger} emptyMessage={emptyLedgerMessage} />

      <MemberPaymentsInsights data={insightsRows} />
    </div>
  );
}
