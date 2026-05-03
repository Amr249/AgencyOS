import type { PlanTier } from "@/lib/plan-limits";

/** Pure trial clock input — safe to import from client components (no DB). */
export type TrialOrgInput = {
  plan: PlanTier;
  trialEndsAt: Date | null;
};

export type TrialStatus = {
  /** `trial_ends_at` is set (trial clock applies for non-internal orgs). */
  isTrial: boolean;
  /** Trial end is in the future (or org not on trial / internal). */
  isActive: boolean;
  /** Trial end is in the past (only when `isTrial`). */
  isExpired: boolean;
  /** Whole days until `trial_ends_at` from start of "now" UTC day; `null` when not on trial. */
  daysRemaining: number | null;
};

const MS_PER_DAY = 86_400_000;

/**
 * Internal orgs are exempt. `trial_ends_at === null` means not on a trial clock (treated as active for writes).
 */
export function getTrialStatus(org: TrialOrgInput, now: Date = new Date()): TrialStatus {
  if (org.plan === "internal") {
    return { isTrial: false, isActive: true, isExpired: false, daysRemaining: null };
  }
  if (org.trialEndsAt == null) {
    return { isTrial: false, isActive: true, isExpired: false, daysRemaining: null };
  }

  const end = org.trialEndsAt instanceof Date ? org.trialEndsAt : new Date(org.trialEndsAt);
  if (Number.isNaN(end.getTime())) {
    return { isTrial: false, isActive: true, isExpired: false, daysRemaining: null };
  }

  const isTrial = true;
  const isExpired = end.getTime() < now.getTime();
  const isActive = !isExpired;
  const msLeft = end.getTime() - now.getTime();
  const daysRemaining = isExpired ? 0 : Math.max(0, Math.ceil(msLeft / MS_PER_DAY));

  return {
    isTrial,
    isActive,
    isExpired,
    daysRemaining,
  };
}

export function isTrialExpired(org: TrialOrgInput, now?: Date): boolean {
  return getTrialStatus(org, now).isExpired;
}
