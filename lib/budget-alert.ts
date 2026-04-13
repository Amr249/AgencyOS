/** Yellow warning when this % of budget is consumed (inclusive). */
export const BUDGET_WARN_PERCENT = 80;
/** Red alert at or above this % of budget. */
export const BUDGET_CRITICAL_PERCENT = 100;

export type BudgetAlertLevel = "warning" | "danger";

export type BudgetAlertState = {
  level: BudgetAlertLevel;
  /** Rounded to one decimal, capped for display sanity when over 100%. */
  percentUsed: number;
  remaining: number;
  budget: number;
  spent: number;
};

export function parsePositiveBudget(budget: string | null | undefined): number | null {
  if (budget == null || budget === "") return null;
  const n = Number(budget);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Compares recorded project expenses (`spent`) to `budget`.
 * Returns null if there is no meaningful budget or usage is below the warning threshold.
 */
export function getBudgetAlertState(spent: number, budget: number): BudgetAlertState | null {
  if (!Number.isFinite(budget) || budget <= 0) return null;
  const spentSafe = Number.isFinite(spent) && spent > 0 ? spent : 0;
  const rawPercent = (spentSafe / budget) * 100;
  if (rawPercent < BUDGET_WARN_PERCENT) return null;
  const level: BudgetAlertLevel =
    rawPercent >= BUDGET_CRITICAL_PERCENT ? "danger" : "warning";
  return {
    level,
    percentUsed: Math.min(999, Math.round(rawPercent * 10) / 10),
    remaining: Math.round((budget - spentSafe) * 100) / 100,
    budget,
    spent: Math.round(spentSafe * 100) / 100,
  };
}

/** Build alert state from stored budget string + numeric spend (e.g. expenses only). */
export function budgetAlertStateFromBudgetString(
  budget: string | null | undefined,
  spent: number
): BudgetAlertState | null {
  const b = parsePositiveBudget(budget);
  if (b == null) return null;
  return getBudgetAlertState(spent, b);
}

export type ProjectHealthLike = {
  status: string;
  budget: number | null;
  totalBurn: number;
  budgetUsedPercent: number | null;
};

/** Aligns with `deriveProjectHealth` thresholds (80% / 100%). */
export function budgetAlertStateFromHealth(h: ProjectHealthLike): BudgetAlertState | null {
  if (h.budget == null || h.budgetUsedPercent == null || h.budgetUsedPercent < BUDGET_WARN_PERCENT) {
    return null;
  }
  const level: BudgetAlertLevel =
    h.status === "over_budget" || h.budgetUsedPercent >= BUDGET_CRITICAL_PERCENT
      ? "danger"
      : "warning";
  return {
    level,
    percentUsed: h.budgetUsedPercent,
    remaining: Math.round((h.budget - h.totalBurn) * 100) / 100,
    budget: h.budget,
    spent: Math.round(h.totalBurn * 100) / 100,
  };
}
