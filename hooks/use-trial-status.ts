"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getTrialStatus, type TrialStatus } from "@/lib/trial-status";
import type { OrgPlan } from "@/types/next-auth";

export type UseTrialStatusResult = TrialStatus & {
  plan: OrgPlan;
  /** True when writes should be blocked (expired trial, non-internal). */
  writeBlocked: boolean;
};

/**
 * Trial state from the session (`plan`, `trialEndsAt` ISO). Internal plan is always exempt.
 */
export function useTrialStatus(): UseTrialStatusResult | null {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user) return null;

  const plan = session.user.plan as OrgPlan;
  const trialEndsAt =
    session.user.trialEndsAt != null && session.user.trialEndsAt !== ""
      ? new Date(session.user.trialEndsAt)
      : null;

  const t = getTrialStatus({ plan, trialEndsAt });
  return {
    ...t,
    plan,
    writeBlocked: t.isExpired,
  };
}

/** `errors.upgrade_to_continue` — for disabled action tooltips when trial expired. */
export function useUpgradeToContinueTitle(): string {
  const t = useTranslations("errors");
  return t("upgrade_to_continue");
}
