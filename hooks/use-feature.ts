"use client";

import { useSession } from "next-auth/react";
import { evaluateFeatureAccess, type FeatureName } from "@/lib/feature-registry";
import type { PlanTier } from "@/lib/plan-limits";

/**
 * Client-side feature flag from session only (plan + `orgFeatures` overrides).
 * Server actions must still call `requireFeature` / `hasFeature` — never rely on this for security.
 */
export function useFeature(featureName: FeatureName): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user?.organizationId) return false;
  const plan = session.user.plan as PlanTier;
  const orgFeatures = session.user.orgFeatures ?? {};
  return evaluateFeatureAccess(plan, orgFeatures, featureName);
}
