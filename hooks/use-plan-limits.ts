"use client";

import { useSession } from "next-auth/react";
import {
  getAiMonthlyLimitForPlan,
  getStorageBytesLimitForPlan,
  type PlanTier,
} from "@/lib/plan-limits";

export type PlanLimitsState = {
  aiLimit: number;
  storageLimit: number;
  aiUsed: number;
  storageUsed: number;
};

/**
 * Plan caps and current org usage from session (refreshed on each `getServerSession` / session resolution).
 */
export function usePlanLimits(): PlanLimitsState {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user) {
    return {
      aiLimit: 0,
      storageLimit: 0,
      aiUsed: 0,
      storageUsed: 0,
    };
  }
  const plan = session.user.plan as PlanTier;
  return {
    aiLimit: getAiMonthlyLimitForPlan(plan),
    storageLimit: getStorageBytesLimitForPlan(plan),
    aiUsed: session.user.aiUsageCount ?? 0,
    storageUsed: session.user.storageUsedBytes ?? 0,
  };
}
