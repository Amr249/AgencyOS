"use client";

import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

/** Riyal amounts with icon when SAR; formatted amount + USD when USD. */
export function ReportsMoney({
  amount,
  iconClassName,
}: {
  amount: number;
  iconClassName?: string;
}) {
  const { formatNumber, currency } = useReportsCurrency();
  const text = formatNumber(amount);
  if (currency === "USD") {
    return (
      <span className="tabular-nums" dir="ltr">
        {text} USD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
      {text}
      <SarCurrencyIcon className={iconClassName ?? "h-3.5 w-3.5 shrink-0"} />
    </span>
  );
}
