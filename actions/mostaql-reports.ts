"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, mostaqlProjects, mostaqlScrapeRuns } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { requireAgencyOrganization } from "@/lib/org-session";
import { processMostaqlScrapeRunById } from "@/lib/mostaql/scrape-runner";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";

const PAGES_VALUES = ["1", "3", "5", "all"] as const;
const DEFAULT_CATEGORIES = ["development", "ai-machine-learning"] as const;

const runScrapeSchema = z.object({
  pages: z.enum(PAGES_VALUES).default("1"),
});

export type RunMostaqlScrapeInput = z.infer<typeof runScrapeSchema>;

function pagesParamToValue(p: (typeof PAGES_VALUES)[number]): number | "all" {
  if (p === "all") return "all";
  return parseInt(p, 10);
}

function appBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
  return null;
}

function internalJobSecret(): string | null {
  return process.env.MOSTAQL_SCRAPE_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

async function triggerMostaqlRunWorker(runId: string): Promise<void> {
  const base = appBaseUrl();
  const secret = internalJobSecret();
  if (!base || !secret) {
    await processMostaqlScrapeRunById(runId);
    return;
  }
  await fetch(`${base}/api/internal/mostaql-scrape-run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ runId }),
    cache: "no-store",
  });
}

export async function runMostaqlScrape(input: RunMostaqlScrapeInput) {
  const parsed = runScrapeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  const pagesValue = pagesParamToValue(parsed.data.pages);
  const pagesRequested =
    pagesValue === "all" ? 0 : pagesValue * DEFAULT_CATEGORIES.length;
  const categories = [...DEFAULT_CATEGORIES];

  const waRun = await requireWriteAccess();
  if (!waRun.ok) return trialExpiredPlain();

  let runId: string;
  try {
    const [row] = await db
      .insert(mostaqlScrapeRuns)
      .values({
        organizationId: waRun.organizationId,
        status: "queued",
        pagesRequested,
        projectsProcessed: 0,
        projectsTotal: 0,
        categoriesJson: categories,
      })
      .returning({ id: mostaqlScrapeRuns.id });
    if (!row) {
      return { ok: false as const, error: "Failed to start scrape run" };
    }
    runId = row.id;
  } catch (e) {
    console.error("runMostaqlScrape:create", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to start scrape run" };
  }

  after(async () => {
    try {
      await triggerMostaqlRunWorker(runId);
    } catch (e) {
      console.error("runMostaqlScrape:triggerWorker", e);
      try {
        await processMostaqlScrapeRunById(runId);
      } catch (fallbackErr) {
        console.error("runMostaqlScrape:fallbackProcess", fallbackErr);
      }
    }
  });

  revalidatePath("/dashboard/proposals/mostaql-reports");

  return {
    ok: true as const,
    data: {
      runId,
      status: "queued" as const,
    },
  };
}

export async function getMostaqlScrapeRuns(limit = 20) {
  try {
    const ctx = await requireAgencyOrganization();
    const rows = await db
      .select()
      .from(mostaqlScrapeRuns)
      .where(eq(mostaqlScrapeRuns.organizationId, ctx.organizationId))
      .orderBy(desc(mostaqlScrapeRuns.startedAt))
      .limit(limit);
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getMostaqlScrapeRuns", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load scrape runs" };
  }
}

/**
 * Returns scraped projects.
 *  - If `runId` is provided → only that run.
 *  - Otherwise → all projects across all runs (de-duplicated at scrape time).
 *  - `startDate` / `endDate` (inclusive) filter `publishedAt`.
 */
export async function getMostaqlProjects(params?: {
  runId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const ctx = await requireAgencyOrganization();
    const runIdRows = await db
      .select({ id: mostaqlScrapeRuns.id })
      .from(mostaqlScrapeRuns)
      .where(eq(mostaqlScrapeRuns.organizationId, ctx.organizationId));
    if (runIdRows.length === 0) {
      return {
        ok: true as const,
        data: { runId: params?.runId ?? null, projects: [] },
      };
    }

    const conditions = [inArray(mostaqlProjects.runId, runIdRows.map((r) => r.id))];
    if (params?.runId) {
      conditions.push(eq(mostaqlProjects.runId, params.runId));
    }
    if (params?.startDate) {
      conditions.push(gte(mostaqlProjects.publishedAt, params.startDate));
    }
    if (params?.endDate) {
      conditions.push(lte(mostaqlProjects.publishedAt, params.endDate));
    }
    const where = and(...conditions);

    const rows = await db
      .select()
      .from(mostaqlProjects)
      .where(where)
      .orderBy(desc(mostaqlProjects.publishedAt));

    return {
      ok: true as const,
      data: { runId: params?.runId ?? null, projects: rows },
    };
  } catch (e) {
    console.error("getMostaqlProjects", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load scraped projects" };
  }
}

export async function deleteMostaqlScrapeRun(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid run id" };
  }
  try {
    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();
    await db
      .delete(mostaqlScrapeRuns)
      .where(
        and(eq(mostaqlScrapeRuns.id, parsed.data), eq(mostaqlScrapeRuns.organizationId, wa.organizationId))
      );
    revalidatePath("/dashboard/proposals/mostaql-reports");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteMostaqlScrapeRun", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete run",
    };
  }
}
