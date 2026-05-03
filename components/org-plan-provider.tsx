"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { evaluateFeatureAccess, type FeatureName } from "@/lib/feature-registry";
import {
  PLAN_AI_MONTHLY_LIMIT,
  PLAN_STORAGE_BYTES_LIMIT,
  type PlanTier,
} from "@/lib/plan-limits";

const OrgPlanContext = React.createContext<OrgPlanSnapshot | null>(null);

export type OrgPlanSnapshot = {
  plan: PlanTier;
  features: Record<string, unknown>;
  trialEndsAt: string | null;
  aiUsageCount: number;
  storageUsedBytes: number;
};

export type NavGatedFeature = Extract<FeatureName, "proposals">;

export function OrgPlanProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: OrgPlanSnapshot | null;
}) {
  return <OrgPlanContext.Provider value={value}>{children}</OrgPlanContext.Provider>;
}

export function useOrgPlanSnapshot(): OrgPlanSnapshot | null {
  return React.useContext(OrgPlanContext);
}

function mergeFromSession(
  ctx: OrgPlanSnapshot | null,
  session: ReturnType<typeof useSession>["data"]
): OrgPlanSnapshot | null {
  const u = session?.user;
  if (!u?.organizationId) return ctx;
  const plan = (ctx?.plan ?? u.plan) as PlanTier;
  const features = ctx?.features ?? u.orgFeatures ?? {};
  const trialEndsAt = ctx?.trialEndsAt ?? u.trialEndsAt ?? null;
  const aiUsageCount = ctx?.aiUsageCount ?? u.aiUsageCount ?? 0;
  const storageUsedBytes = ctx?.storageUsedBytes ?? u.storageUsedBytes ?? 0;
  return { plan, features, trialEndsAt, aiUsageCount, storageUsedBytes };
}

export function useFeature(feature: NavGatedFeature): boolean {
  const ctx = React.useContext(OrgPlanContext);
  const { data: session } = useSession();
  const merged = mergeFromSession(ctx, session);
  const plan = (merged?.plan ?? "starter") as PlanTier;
  const features = merged?.features ?? {};
  return evaluateFeatureAccess(plan, features, feature);
}

export type PlanLimitsInfo =
  | {
      isInternal: true;
      plan: PlanTier;
      trialEndsAt: string | null;
    }
  | {
      isInternal: false;
      plan: PlanTier;
      trialEndsAt: string | null;
      aiUsageCount: number;
      aiLimit: number;
      storageUsedBytes: number;
      storageLimitBytes: number;
    };

export function usePlanLimits(): PlanLimitsInfo | null {
  const ctx = React.useContext(OrgPlanContext);
  const { data: session } = useSession();
  const merged = mergeFromSession(ctx, session);
  if (!merged && !session?.user?.plan) return null;
  const plan = (merged?.plan ?? session?.user?.plan ?? "starter") as PlanTier;
  const trialEndsAt = merged?.trialEndsAt ?? session?.user?.trialEndsAt ?? null;
  if (plan === "internal") {
    return { isInternal: true, plan, trialEndsAt };
  }
  const aiUsageCount = merged?.aiUsageCount ?? session?.user?.aiUsageCount ?? 0;
  const storageUsedBytes = merged?.storageUsedBytes ?? session?.user?.storageUsedBytes ?? 0;
  const aiLimit = PLAN_AI_MONTHLY_LIMIT[plan];
  const storageLimit = PLAN_STORAGE_BYTES_LIMIT[plan];
  return {
    isInternal: false,
    plan,
    trialEndsAt,
    aiUsageCount,
    aiLimit,
    storageUsedBytes,
    storageLimitBytes: storageLimit,
  };
}
