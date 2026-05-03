import { cache } from "react";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgMembers, organizations, settings } from "@/lib/db/schema";
import type { PlanTier } from "@/lib/plan-limits";

export type CachedOrganization = {
  id: string;
  /** URL-safe tenant key (R2 path prefix, etc.). */
  slug: string;
  /** `organizations.name` (agency / tenant display name). */
  orgName: string;
  plan: PlanTier;
  features: Record<string, unknown>;
  trialEndsAt: Date | null;
  aiUsageCount: number;
  storageUsedBytes: number;
  aiUsageResetAt: Date | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  /** `organizations.logo_url` — agency branding (sidebar, etc.). */
  orgLogoUrl: string | null;
  /** Active org_members rows (dashboard seats). */
  teamMemberCount: number;
};

/** Fresh read from DB (mutations and auth should use this, not React cache). */
export async function fetchOrganizationSnapshot(
  organizationId: string
): Promise<CachedOrganization | null> {
  try {
    const [orgRow] = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        orgDisplayName: organizations.name,
        plan: organizations.plan,
        features: organizations.features,
        trialEndsAt: organizations.trialEndsAt,
        aiUsageCount: organizations.aiUsageCount,
        storageUsedBytes: organizations.storageUsedBytes,
        aiUsageResetAt: organizations.aiUsageResetAt,
        onboardingCompleted: organizations.onboardingCompleted,
        onboardingStep: organizations.onboardingStep,
        orgLogoUrl: organizations.logoUrl,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!orgRow) return null;

    const [memberCountRow] = await db
      .select({ c: count() })
      .from(orgMembers)
      .where(eq(orgMembers.organizationId, organizationId));

    let settingsAgencyLogoUrl: string | null = null;
    try {
      const [settingsRow] = await db
        .select({ agencyLogoUrl: settings.agencyLogoUrl })
        .from(settings)
        .where(eq(settings.organizationId, organizationId))
        .limit(1);
      settingsAgencyLogoUrl = settingsRow?.agencyLogoUrl ?? null;
    } catch (settingsErr) {
      console.warn("[fetchOrganizationSnapshot] settings lookup failed", {
        organizationId,
        settingsErr,
      });
    }

    return {
      id: orgRow.id,
      slug: orgRow.slug,
      orgName: orgRow.orgDisplayName,
      plan: orgRow.plan as PlanTier,
      features: (orgRow.features ?? {}) as Record<string, unknown>,
      trialEndsAt: orgRow.trialEndsAt,
      aiUsageCount: orgRow.aiUsageCount,
      storageUsedBytes: orgRow.storageUsedBytes,
      aiUsageResetAt: orgRow.aiUsageResetAt,
      onboardingCompleted: orgRow.onboardingCompleted,
      onboardingStep: orgRow.onboardingStep,
      orgLogoUrl:
        orgRow.orgLogoUrl?.trim() || settingsAgencyLogoUrl?.trim() || null,
      teamMemberCount: Number(memberCountRow?.c ?? 0),
    };
  } catch (err) {
    console.error("[fetchOrganizationSnapshot] failed", { organizationId, err });
    return null;
  }
}

/**
 * Per-request memoized org row for `hasFeature` and other read-heavy paths in a single render.
 */
export const getCachedOrganization = cache(fetchOrganizationSnapshot);
