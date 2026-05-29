import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db, mostaqlScrapeRuns, organizations } from "@/lib/db";
import { evaluateFeatureAccess } from "@/lib/feature-registry";
import type { PlanTier } from "@/lib/plan-limits";
import { isTrialExpired } from "@/lib/trial-status";

export const MOSTAQL_DEFAULT_CATEGORIES = ["development", "ai-machine-learning"] as const;

/** `pages_requested = 0` means crawl all listing pages per category. */
export const MOSTAQL_ALL_PAGES_REQUESTED = 0;

function autoScrapeEnabled(): boolean {
  const raw = process.env.MOSTAQL_AUTO_SCRAPE_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

/**
 * Enqueue one "all pages" scrape per eligible organization (daily cron).
 * Skips orgs that already have a queued or running job.
 */
export async function enqueueDailyMostaqlScrapes(): Promise<{
  enqueued: { runId: string; organizationId: string }[];
  skipped: { organizationId: string; reason: string }[];
}> {
  if (!autoScrapeEnabled()) {
    return { enqueued: [], skipped: [] };
  }

  const orgRows = await db
    .select({
      id: organizations.id,
      plan: organizations.plan,
      features: organizations.features,
      trialEndsAt: organizations.trialEndsAt,
    })
    .from(organizations);

  const enqueued: { runId: string; organizationId: string }[] = [];
  const skipped: { organizationId: string; reason: string }[] = [];

  for (const org of orgRows) {
    const plan = org.plan as PlanTier;
    const features = (org.features ?? {}) as Record<string, unknown>;

    if (!evaluateFeatureAccess(plan, features, "scrape_mostaql")) {
      skipped.push({ organizationId: org.id, reason: "feature_disabled" });
      continue;
    }

    if (
      isTrialExpired({
        plan,
        trialEndsAt: org.trialEndsAt,
      })
    ) {
      skipped.push({ organizationId: org.id, reason: "trial_expired" });
      continue;
    }

    const [active] = await db
      .select({ id: mostaqlScrapeRuns.id })
      .from(mostaqlScrapeRuns)
      .where(
        and(
          eq(mostaqlScrapeRuns.organizationId, org.id),
          inArray(mostaqlScrapeRuns.status, ["queued", "running"])
        )
      )
      .limit(1);

    if (active) {
      skipped.push({ organizationId: org.id, reason: "already_active" });
      continue;
    }

    const [row] = await db
      .insert(mostaqlScrapeRuns)
      .values({
        organizationId: org.id,
        status: "queued",
        pagesRequested: MOSTAQL_ALL_PAGES_REQUESTED,
        projectsProcessed: 0,
        projectsTotal: 0,
        categoriesJson: [...MOSTAQL_DEFAULT_CATEGORIES],
      })
      .returning({ id: mostaqlScrapeRuns.id });

    if (row) {
      enqueued.push({ runId: row.id, organizationId: org.id });
    }
  }

  return { enqueued, skipped };
}
