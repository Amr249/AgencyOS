import "server-only";

import { and, eq } from "drizzle-orm";
import { db, mostaqlProjects, mostaqlScrapeRuns } from "@/lib/db";
import { crawlMostaql, type MostaqlScrapedProject } from "@/lib/mostaql/scraper";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toNumericString(n: number | null): string | null {
  return n == null || Number.isNaN(n) ? null : String(n);
}

function derivePagesValue(pagesRequested: number, categoriesCount: number): number | "all" {
  if (pagesRequested === 0) return "all";
  const perCategory = Math.floor(pagesRequested / Math.max(1, categoriesCount));
  return Math.max(1, perCategory);
}

async function buildSkipSets(organizationId: string | null): Promise<{
  skipMostaqlIds: Set<string>;
  skipUrls: Set<string>;
}> {
  if (!organizationId) {
    return { skipMostaqlIds: new Set(), skipUrls: new Set() };
  }
  try {
    const existing = await db
      .select({
        mostaqlId: mostaqlProjects.mostaqlId,
        url: mostaqlProjects.url,
      })
      .from(mostaqlProjects)
      .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
      .where(eq(mostaqlScrapeRuns.organizationId, organizationId));
    const ids = new Set(existing.map((e) => e.mostaqlId).filter((x): x is string => !!x));
    const urls = new Set(existing.map((e) => e.url));
    return { skipMostaqlIds: ids, skipUrls: urls };
  } catch (e) {
    console.error("mostaql:buildSkipSets", e);
    return { skipMostaqlIds: new Set(), skipUrls: new Set() };
  }
}

export async function processMostaqlScrapeRunById(runId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  let lastProgressWriteAt = 0;
  let lastWritten = {
    pagesFetched: -1,
    projectsFound: -1,
    projectsProcessed: -1,
    projectsTotal: -1,
  };
  const writeProgress = async (
    next: Partial<{
      pagesFetched: number;
      projectsFound: number;
      projectsProcessed: number;
      projectsTotal: number;
    }>,
    force = false
  ) => {
    const merged = {
      pagesFetched: next.pagesFetched ?? lastWritten.pagesFetched,
      projectsFound: next.projectsFound ?? lastWritten.projectsFound,
      projectsProcessed: next.projectsProcessed ?? lastWritten.projectsProcessed,
      projectsTotal: next.projectsTotal ?? lastWritten.projectsTotal,
    };
    const unchanged =
      merged.pagesFetched === lastWritten.pagesFetched &&
      merged.projectsFound === lastWritten.projectsFound &&
      merged.projectsProcessed === lastWritten.projectsProcessed &&
      merged.projectsTotal === lastWritten.projectsTotal;
    if (unchanged) return;
    const now = Date.now();
    if (!force && now - lastProgressWriteAt < 2000) return;
    await db
      .update(mostaqlScrapeRuns)
      .set({
        pagesFetched: Math.max(0, merged.pagesFetched),
        projectsFound: Math.max(0, merged.projectsFound),
        projectsProcessed: Math.max(0, merged.projectsProcessed),
        projectsTotal: Math.max(0, merged.projectsTotal),
      })
      .where(eq(mostaqlScrapeRuns.id, runId));
    lastProgressWriteAt = now;
    lastWritten = merged;
  };

  const [claimed] = await db
    .update(mostaqlScrapeRuns)
    .set({
      status: "running",
      finishedAt: null,
      errorMessage: null,
      pagesFetched: 0,
      projectsFound: 0,
      projectsProcessed: 0,
      projectsTotal: 0,
      projectsSaved: 0,
    })
    .where(and(eq(mostaqlScrapeRuns.id, runId), eq(mostaqlScrapeRuns.status, "queued")))
    .returning({ id: mostaqlScrapeRuns.id });

  // Already claimed/finished by another worker (or legacy old run).
  if (!claimed) {
    const [existing] = await db
      .select({
        status: mostaqlScrapeRuns.status,
        finishedAt: mostaqlScrapeRuns.finishedAt,
      })
      .from(mostaqlScrapeRuns)
      .where(eq(mostaqlScrapeRuns.id, runId))
      .limit(1);
    if (!existing) return { ok: false, reason: "Run not found" };
    if (existing.finishedAt) return { ok: true, skipped: true, reason: "Already finished" };
    if (existing.status !== "running") {
      return { ok: true, skipped: true, reason: `Run status is ${existing.status}` };
    }
  }

  const [run] = await db
    .select({
      id: mostaqlScrapeRuns.id,
      organizationId: mostaqlScrapeRuns.organizationId,
      pagesRequested: mostaqlScrapeRuns.pagesRequested,
      categoriesJson: mostaqlScrapeRuns.categoriesJson,
    })
    .from(mostaqlScrapeRuns)
    .where(eq(mostaqlScrapeRuns.id, runId))
    .limit(1);

  if (!run) return { ok: false, reason: "Run not found after claim" };

  const categories = run.categoriesJson?.length
    ? run.categoriesJson
    : ["development", "ai-machine-learning"];
  const pagesValue = derivePagesValue(run.pagesRequested, categories.length);

  const { skipMostaqlIds, skipUrls } = await buildSkipSets(run.organizationId ?? null);

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
      onProgress: (info) => {
        void writeProgress(
          {
            pagesFetched: info.pagesFetched,
            projectsFound: info.projectsFound,
            projectsProcessed: info.projectsScraped,
            projectsTotal: info.projectsFound,
          },
          false
        );
      },
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
    console.error("processMostaqlScrapeRunById:crawl", e);
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
      console.error("processMostaqlScrapeRunById:insert", e);
      crawlError = crawlError ?? (e instanceof Error ? e.message : "Failed to save scraped rows");
    }
  }

  const status = crawlError ? (projectsSaved > 0 ? "partial" : "failed") : "success";
  await writeProgress(
    {
      pagesFetched,
      projectsFound,
      projectsProcessed: projectsFound,
      projectsTotal: projectsFound,
    },
    true
  );
  await db
    .update(mostaqlScrapeRuns)
    .set({
      status,
      finishedAt: new Date(),
      pagesFetched,
      projectsFound,
      projectsProcessed: projectsFound,
      projectsTotal: projectsFound,
      projectsSaved,
      errorMessage: crawlError,
    })
    .where(eq(mostaqlScrapeRuns.id, runId));

  // Keep this metric only in logs for now.
  if (projectsSkippedDuplicate > 0) {
    console.info(`[mostaql] run ${runId} skipped duplicates: ${projectsSkippedDuplicate}`);
  }

  const { chainNextQueuedMostaqlRun } = await import("@/lib/mostaql/worker-client");
  void chainNextQueuedMostaqlRun();

  return { ok: true };
}

export async function processNextQueuedMostaqlRun(): Promise<{
  ok: boolean;
  runId?: string;
  skipped?: boolean;
}> {
  const [row] = await db
    .select({ id: mostaqlScrapeRuns.id })
    .from(mostaqlScrapeRuns)
    .where(eq(mostaqlScrapeRuns.status, "queued"))
    .orderBy(mostaqlScrapeRuns.startedAt)
    .limit(1);
  if (!row) return { ok: true, skipped: true };
  await processMostaqlScrapeRunById(row.id);
  return { ok: true, runId: row.id };
}
