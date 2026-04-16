import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";
import type { MemberSalaryExpenseRow } from "@/actions/member-dashboard";
import { MemberPaymentsDataTable } from "@/components/member-dashboard/member-financial-tables";
import { MemberPaymentsInsights } from "@/components/member-dashboard/member-payments-insights";

type Props = {
  salaryExpenses: MemberSalaryExpenseRow[];
};

function paymentKpis(rows: MemberSalaryExpenseRow[]) {
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
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === mo && !Number.isNaN(n)) {
      monthTotal += n;
    }
  }
  return { total, monthTotal };
}

export async function MemberPaymentsPageContent({ salaryExpenses }: Props) {
  const { total, monthTotal } = paymentKpis(salaryExpenses);

  return (
    <div className="space-y-8" dir="rtl" lang="ar">
      <div className="text-start">
        <h1 className="text-2xl font-bold tracking-tight">المدفوعات</h1>
        <p className="text-muted-foreground mt-1 text-sm">سجل المدفوعات والمستحقات الخاصة بك.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card dir="rtl" className="text-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">إجمالي المدفوعات</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="inline-flex items-center gap-1 text-2xl font-semibold tabular-nums">
              <SarCurrencyIcon className="h-4 w-4" />
              <span>{formatAmount(String(total))}</span>
            </span>
          </CardContent>
        </Card>
        <Card dir="rtl" className="text-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">هذا الشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="inline-flex items-center gap-1 text-2xl font-semibold tabular-nums">
              <SarCurrencyIcon className="h-4 w-4" />
              <span>{formatAmount(String(monthTotal))}</span>
            </span>
          </CardContent>
        </Card>
      </div>

      <MemberPaymentsDataTable
        data={salaryExpenses}
        emptyMessage="لا توجد مدفوعات مسجّلة بعد."
      />

      <MemberPaymentsInsights data={salaryExpenses} />
    </div>
  );
}
