import { requireAgencyOrganization } from "@/lib/org-session";
import { getCachedOrganization } from "@/lib/org-snapshot";
import { evaluateFeatureAccess, type FeatureName } from "@/lib/feature-registry";
import type { PlanTier } from "@/lib/plan-limits";

export const FEATURE_NOT_AVAILABLE_MESSAGE =
  "This feature is not available on your current plan.";

export type { FeatureName, FeatureDefinition } from "@/lib/feature-registry";
export { FEATURE_REGISTRY, evaluateFeatureAccess } from "@/lib/feature-registry";

export type { CachedOrganization } from "@/lib/org-snapshot";
export { getCachedOrganization } from "@/lib/org-snapshot";

/**
 * @param organizationId - org UUID
 * @param featureName - registry key
 */
export async function hasFeature(
  organizationId: string,
  featureName: FeatureName
): Promise<boolean> {
  const row = await getCachedOrganization(organizationId);
  if (!row) return false;
  return evaluateFeatureAccess(row.plan, row.features, featureName);
}

/**
 * When plan + features are already known (e.g. mirroring client logic on the server).
 */
export function hasFeatureSync(
  plan: PlanTier,
  featuresJson: Record<string, unknown> | null | undefined,
  featureName: FeatureName
): boolean {
  return evaluateFeatureAccess(plan, featuresJson, featureName);
}

export type RequireFeatureResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

/**
 * Server-side guard for dashboard actions. Uses session org; returns a stable error message when denied.
 */
export async function requireFeature(
  featureName: FeatureName
): Promise<RequireFeatureResult> {
  const ctx = await requireAgencyOrganization();
  const allowed = await hasFeature(ctx.organizationId, featureName);
  if (!allowed) {
    return { ok: false, error: FEATURE_NOT_AVAILABLE_MESSAGE };
  }
  return { ok: true, organizationId: ctx.organizationId };
}
