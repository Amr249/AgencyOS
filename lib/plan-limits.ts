export type PlanTier = "starter" | "pro" | "enterprise" | "internal";

/** Max AI completions per billing month; `enterprise` / `internal` = unlimited. */
export const PLAN_AI_MONTHLY_LIMIT: Record<PlanTier, number> = {
  starter: 50,
  pro: 500,
  enterprise: Number.POSITIVE_INFINITY,
  internal: Number.POSITIVE_INFINITY,
};

/** Max total file storage per org (bytes); `internal` = unlimited. */
export const PLAN_STORAGE_BYTES_LIMIT: Record<PlanTier, number> = {
  starter: 10 * 1024 * 1024 * 1024,
  pro: 100 * 1024 * 1024 * 1024,
  enterprise: 500 * 1024 * 1024 * 1024,
  internal: Number.POSITIVE_INFINITY,
};

/** Max dashboard org members (owners + admins + members). `Infinity` = no cap. */
export const PLAN_MAX_TEAM_MEMBERS: Record<PlanTier, number> = {
  starter: 3,
  pro: Number.POSITIVE_INFINITY,
  enterprise: Number.POSITIVE_INFINITY,
  internal: Number.POSITIVE_INFINITY,
};

/** SAR display prices (no payment processing — reference only). */
export const PLAN_LIMITS = {
  starter: {
    name: "Starter",
    nameAr: "ستارتر",
    priceMonthly: 79,
    priceYearly: 758,
    currency: "SAR" as const,
    maxTeamMembers: 3,
    aiRequestsPerMonth: 50,
    storageBytes: 10 * 1024 * 1024 * 1024,
  },
  pro: {
    name: "Pro",
    nameAr: "برو",
    priceMonthly: 249,
    priceYearly: 2390,
    currency: "SAR" as const,
    maxTeamMembers: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: 500,
    storageBytes: 100 * 1024 * 1024 * 1024,
  },
  enterprise: {
    name: "Enterprise",
    nameAr: "إنتربرايز",
    priceMonthly: null,
    priceYearly: null,
    currency: "SAR" as const,
    maxTeamMembers: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: Number.POSITIVE_INFINITY,
    storageBytes: 500 * 1024 * 1024 * 1024,
  },
  internal: {
    name: "Internal",
    nameAr: "داخلي",
    priceMonthly: null,
    priceYearly: null,
    currency: "SAR" as const,
    maxTeamMembers: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: Number.POSITIVE_INFINITY,
    storageBytes: Number.POSITIVE_INFINITY,
  },
} as const;

/** Rounded monthly equivalent when paying yearly (yearly ÷ 12). */
export const PLAN_SAR_YEARLY_PER_MONTH: Record<"starter" | "pro", number> = {
  starter: Math.round(PLAN_LIMITS.starter.priceYearly / 12),
  pro: Math.round(PLAN_LIMITS.pro.priceYearly / 12),
};

export function getAiMonthlyLimitForPlan(plan: PlanTier): number {
  return PLAN_AI_MONTHLY_LIMIT[plan] ?? PLAN_AI_MONTHLY_LIMIT.starter;
}

export function getStorageBytesLimitForPlan(plan: PlanTier): number {
  return PLAN_STORAGE_BYTES_LIMIT[plan] ?? PLAN_STORAGE_BYTES_LIMIT.starter;
}

export function getMaxTeamMembersForPlan(plan: PlanTier): number {
  return PLAN_MAX_TEAM_MEMBERS[plan] ?? PLAN_MAX_TEAM_MEMBERS.starter;
}

export function isUnlimitedAi(plan: PlanTier): boolean {
  return !Number.isFinite(getAiMonthlyLimitForPlan(plan));
}

export function isUnlimitedStorage(plan: PlanTier): boolean {
  return !Number.isFinite(getStorageBytesLimitForPlan(plan));
}

export function isUnlimitedTeam(plan: PlanTier): boolean {
  return !Number.isFinite(getMaxTeamMembersForPlan(plan));
}
