export type PlanTier = "starter" | "pro" | "enterprise" | "internal";

/** Max AI completions per billing month; `internal` = unlimited. */
export const PLAN_AI_MONTHLY_LIMIT: Record<PlanTier, number> = {
  starter: 50,
  pro: 500,
  enterprise: 5000,
  internal: Number.POSITIVE_INFINITY,
};

/** Max total file storage per org (bytes); `internal` = unlimited. */
export const PLAN_STORAGE_BYTES_LIMIT: Record<PlanTier, number> = {
  starter: 1 * 1024 * 1024 * 1024,
  pro: 10 * 1024 * 1024 * 1024,
  enterprise: 100 * 1024 * 1024 * 1024,
  internal: Number.POSITIVE_INFINITY,
};

export function getAiMonthlyLimitForPlan(plan: PlanTier): number {
  return PLAN_AI_MONTHLY_LIMIT[plan] ?? PLAN_AI_MONTHLY_LIMIT.starter;
}

export function getStorageBytesLimitForPlan(plan: PlanTier): number {
  return PLAN_STORAGE_BYTES_LIMIT[plan] ?? PLAN_STORAGE_BYTES_LIMIT.starter;
}

export function isUnlimitedAi(plan: PlanTier): boolean {
  return !Number.isFinite(getAiMonthlyLimitForPlan(plan));
}

export function isUnlimitedStorage(plan: PlanTier): boolean {
  return !Number.isFinite(getStorageBytesLimitForPlan(plan));
}
