"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn, isSarCurrency } from "@/lib/utils";
import type { ProjectHealth } from "@/actions/project-health";
import type { BudgetAlertState } from "@/lib/budget-alert";
import { budgetAlertStateFromHealth } from "@/lib/budget-alert";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

const DISMISS_PREFIX = "budgetAlertDismissed:";

function formatMoney(amount: number, currency: string): React.ReactNode {
  if (isSarCurrency(currency)) {
    const formatted = amount.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return (
      <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
        {formatted}
        <SarCurrencyIcon className="h-4 w-4 shrink-0" />
      </span>
    );
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type BudgetAlertProps = {
  projectId: string;
  /** Precomputed alert; null hides the banner. */
  state: BudgetAlertState | null;
  currency: string;
  variant?: "banner" | "compact";
  dismissible?: boolean;
  className?: string;
};

export function BudgetAlert({
  projectId,
  state,
  currency,
  variant = "banner",
  dismissible = true,
  className,
}: BudgetAlertProps) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !dismissible) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_PREFIX + projectId) === "1");
    } catch {
      // ignore
    }
  }, [projectId, dismissible]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_PREFIX + projectId, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (!state || dismissed) return null;

  return (
    <BudgetAlertInner
      state={state}
      currency={currency}
      variant={variant}
      dismissible={dismissible}
      onDismiss={handleDismiss}
      className={className}
    />
  );
}

export function BudgetAlertInner({
  state,
  currency,
  variant = "banner",
  dismissible,
  onDismiss,
  className,
}: {
  state: BudgetAlertState;
  currency: string;
  variant?: "banner" | "compact";
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  const isDanger = state.level === "danger";
  const remainingLabel =
    state.remaining < 0
      ? `${formatMoney(Math.abs(state.remaining), currency)} over budget`
      : `${formatMoney(state.remaining, currency)} remaining`;

  return (
    <div
      role="alert"
      className={cn(
        "relative flex gap-3 rounded-lg border px-4 py-3 text-sm",
        isDanger
          ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        variant === "compact" && "py-2 px-3",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {isDanger ? "Budget exceeded" : "Approaching budget limit"}
        </p>
        <p
          className={cn(
            "text-xs opacity-90",
            isDanger ? "text-red-900/90 dark:text-red-100/90" : "text-amber-900/90 dark:text-amber-100/90"
          )}
        >
          Project is at <span className="font-semibold tabular-nums">{state.percentUsed}%</span> of
          budget ({formatMoney(state.spent, currency)} of {formatMoney(state.budget, currency)} in
          recorded spend — expenses plus billable time at logged rates). {remainingLabel}.
        </p>
      </div>
      {dismissible && onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100",
            isDanger ? "hover:bg-red-100 dark:hover:bg-red-900/50" : "hover:bg-amber-100 dark:hover:bg-amber-900/50"
          )}
          aria-label="Dismiss budget alert for this session"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function formatPlainAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** List/table icon when project health crosses budget thresholds (matches health badge logic). */
export function ProjectBudgetWarningGlyphFromHealth({
  health,
  className,
}: {
  health: ProjectHealth | undefined;
  className?: string;
}) {
  const state = health ? budgetAlertStateFromHealth(health) : null;
  if (!state) return null;
  const isDanger = state.level === "danger";
  const tip =
    state.remaining < 0
      ? `${state.percentUsed}% of budget — ${formatPlainAmount(Math.abs(state.remaining))} over`
      : `${state.percentUsed}% of budget — ${formatPlainAmount(state.remaining)} remaining`;
  return (
    <span title={tip} className={cn("inline-flex", className)}>
      <AlertTriangle
        className={cn(
          "h-4 w-4 shrink-0",
          isDanger ? "text-red-600 dark:text-red-400" : "text-amber-500 dark:text-amber-400"
        )}
        aria-hidden
      />
      <span className="sr-only">{tip}</span>
    </span>
  );
}
