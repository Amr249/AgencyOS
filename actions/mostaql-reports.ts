"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, mostaqlScrapeRuns, mostaqlProjects } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  crawlMostaql,
  type MostaqlScrapedProject,
} from "@/lib/mostaql/scraper";

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toNumericString(n: number | null): string | null {
  return n == null || Number.isNaN(n) ? null : String(n);
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

  let runId: string;
  try {
    const [row] = await db
      .insert(mostaqlScrapeRuns)
      .values({
        status: "running",
        pagesRequested,
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

  let skipMostaqlIds = new Set<string>();
  let skipUrls = new Set<string>();
  try {
    const existing = await db
      .select({
        mostaqlId: mostaqlProjects.mostaqlId,
        url: mostaqlProjects.url,
      })
      .from(mostaqlProjects);
    skipMostaqlIds = new Set(
      existing
        .map((e) => e.mostaqlId)
        .filter((x): x is string => !!x)
    );
    skipUrls = new Set(existing.map((e) => e.url));
  } catch (e) {
    console.error("runMostaqlScrape:loadExisting", e);
  }

  let projects: MostaqlScrapedProject[] = [];
  let pagesFetched = 0;
  let projectsFound = 0;
  let projectsSkippedDuplicate = 0;
  let projectsFailedDetail = 0;
  let abortedByRateLimit = false;
  let crawlError: string | null = null;
  try {
    const result = await crawlMostaql({
      pages: pagesValue,
      categories,
      skipMostaqlIds,
      skipUrls,
    });
    projects = result.projects;
    pagesFetched = result.pagesFetched;
    projectsFound = result.projectsFound;
    projectsSkippedDuplicate = result.projectsSkippedDuplicate;
    projectsFailedDetail = result.projectsFailedDetail;
    abortedByRateLimit = result.abortedByRateLimit;
    if (abortedByRateLimit) {
      crawlError =
        "Mostaql rate-limited the crawler. Saved what we got — re-run later to fetch the rest (already-scraped projects will be skipped).";
    } else if (projectsFailedDetail > 0) {
      crawlError = `${projectsFailedDetail} project page${projectsFailedDetail === 1 ? "" : "s"} failed to load and were skipped — re-run later to retry.`;
    }
  } catch (e) {
    crawlError = e instanceof Error ? e.message : "Unknown scrape error";
    console.error("runMostaqlScrape:crawl", e);
  }

  let projectsSaved = 0;
  if (projects.length > 0) {
    try {
      const seen = new Set<string>(skipMostaqlIds);
      const seenUrls = new Set<string>(skipUrls);
      const rows = projects
        .filter((p) => {
          const idKey = p.mostaqlId;
          if (idKey && seen.has(idKey)) return false;
          if (!idKey && seenUrls.has(p.url)) return false;
          if (idKey) seen.add(idKey);
          seenUrls.add(p.url);
          return true;
        })
        .map((p) => ({
          runId,
          mostaqlId: p.mostaqlId,
          url: p.url,
          title: p.title,
          category: p.category,
          subcategory: p.subcategory,
          budgetMin: toNumericString(p.budgetMin),
          budgetMax: toNumericString(p.budgetMax),
          currency: p.currency,
          description: p.description,
          skillsTags: p.skillsTags,
          clientName: p.clientName,
          clientUrl: p.clientUrl,
          offersCount: p.offersCount,
          projectStatus: p.projectStatus,
          publishedAt: p.publishedAt,
          durationDays: p.durationDays,
        }));
      for (const batch of chunk(rows, 100)) {
        await db.insert(mostaqlProjects).values(batch);
        projectsSaved += batch.length;
      }
    } catch (e) {
      console.error("runMostaqlScrape:insert", e);
      crawlError =
        crawlError ?? (e instanceof Error ? e.message : "Failed to save scraped rows");
    }
  }

  const status = crawlError
    ? projectsSaved > 0
      ? "partial"
      : "failed"
    : "success";

  try {
    await db
      .update(mostaqlScrapeRuns)
      .set({
        status,
        finishedAt: new Date(),
        pagesFetched,
        projectsFound,
        projectsSaved,
        errorMessage: crawlError,
      })
      .where(eq(mostaqlScrapeRuns.id, runId));
  } catch (e) {
    console.error("runMostaqlScrape:update", e);
  }

  revalidatePath("/dashboard/proposals/mostaql-reports");

  return {
    ok: true as const,
    data: {
      runId,
      status,
      pagesFetched,
      projectsFound,
      projectsSaved,
      projectsSkippedDuplicate,
      projectsFailedDetail,
      abortedByRateLimit,
      errorMessage: crawlError,
    },
  };
}

export async function getMostaqlScrapeRuns(limit = 20) {
  try {
    const rows = await db
      .select()
      .from(mostaqlScrapeRuns)
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
    const conditions = [];
    if (params?.runId) {
      conditions.push(eq(mostaqlProjects.runId, params.runId));
    }
    if (params?.startDate) {
      conditions.push(gte(mostaqlProjects.publishedAt, params.startDate));
    }
    if (params?.endDate) {
      conditions.push(lte(mostaqlProjects.publishedAt, params.endDate));
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);

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
    await db.delete(mostaqlScrapeRuns).where(eq(mostaqlScrapeRuns.id, parsed.data));
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
