"use client";

import { cn, formatAmount } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

type SarMoneyProps = {
  value: string | number | null | undefined;
  className?: string;
  iconClassName?: string;
  /** When USD, shows a leading $ instead of the riyal icon. */
  currency?: "SAR" | "USD";
};

export function SarMoney({
  value,
  className,
  iconClassName,
  currency = "SAR",
}: SarMoneyProps) {
  const text = formatAmount(value == null ? undefined : typeof value === "number" ? String(value) : value);
  if (text === "—") return <span>—</span>;
  if (currency === "USD") {
    return (
      <span className={cn("inline-flex items-center gap-0.5 tabular-nums", className)} dir="ltr">
        <span className="text-muted-foreground">$</span>
        {text}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} dir="ltr">
      {text}
      <SarCurrencyIcon className={cn("shrink-0", iconClassName ?? "h-3.5 w-3.5")} />
    </span>
  );
}
