/**
 * Full-column export of Mostaql scrape tables (`mostaql_scrape_runs`, `mostaql_projects`)
 * for AI context. Row counts are capped; totals are for the given organization only.
 */

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, mostaqlProjects, mostaqlScrapeRuns } from "@/lib/db";

/** Hard caps — raise via env if your DB is small enough for larger prompts. */
function maxRunRows(): number {
  const n = Number(process.env.AI_CHAT_MOSTAQL_MAX_RUNS ?? "500");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : 500;
}

function maxProjectRows(): number {
  const n = Number(process.env.AI_CHAT_MOSTAQL_MAX_PROJECT_ROWS ?? "250");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 250;
}

function charBudget(): number {
  const n = Number(process.env.AI_CHAT_MOSTAQL_CHAR_BUDGET ?? "48000");
  return Number.isFinite(n) && n > 5000 ? Math.min(n, 200000) : 48000;
}

export async function buildMostaqlDatasetSection(organizationId: string): Promise<string> {
  const budget = charBudget();
  const runLimit = maxRunRows();
  const projectLimit = maxProjectRows();

  const [[{ totalProjects }], [{ totalRuns }], dateAgg] = await Promise.all([
    db
      .select({ totalProjects: count() })
      .from(mostaqlProjects)
      .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
      .where(eq(mostaqlScrapeRuns.organizationId, organizationId)),
    db
      .select({ totalRuns: count() })
      .from(mostaqlScrapeRuns)
      .where(eq(mostaqlScrapeRuns.organizationId, organizationId)),
    db
      .select({
        minScrapedAt: sql<string | null>`min(${mostaqlProjects.scrapedAt})`,
        maxScrapedAt: sql<string | null>`max(${mostaqlProjects.scrapedAt})`,
        minPublishedAt: sql<string | null>`min(${mostaqlProjects.publishedAt})`,
        maxPublishedAt: sql<string | null>`max(${mostaqlProjects.publishedAt})`,
      })
      .from(mostaqlProjects)
      .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
      .where(eq(mostaqlScrapeRuns.organizationId, organizationId)),
  ]);

  const agg = dateAgg[0] ?? {};

  const lines: string[] = [
    "## Mostaql scrape data (full columns, `mostaql_scrape_runs` + `mostaql_projects`)",
    "",
    "### Organization stats (current tenant only)",
    `- total rows in \`mostaql_projects\` for this organization: ${totalProjects}`,
    `- total rows in \`mostaql_scrape_runs\` for this organization: ${totalRuns}`,
    `- scraped_at range on projects: min=${agg.minScrapedAt ?? "null"} max=${agg.maxScrapedAt ?? "null"}`,
    `- published_at range on projects: min=${agg.minPublishedAt ?? "null"} max=${agg.maxPublishedAt ?? "null"}`,
    "",
    "### Column reference (every persisted field)",
    "**mostaql_scrape_runs:** id, started_at, finished_at, status, pages_requested, pages_fetched, projects_found, projects_saved, categories_json, error_message",
    "**mostaql_projects:** id, run_id, mostaql_id, url, title, category, subcategory, budget_min, budget_max, currency, description, skills_tags (json array), client_name, client_url, offers_count, project_status, published_at, duration_days, scraped_at",
    "",
    "### All scrape runs (newest first; every column per row as JSON)",
    `Up to ${runLimit} rows (there are ${totalRuns} total for this organization).`,
  ];

  let used = lines.join("\n").length;

  const runs = await db
    .select({
      id: mostaqlScrapeRuns.id,
      startedAt: mostaqlScrapeRuns.startedAt,
      finishedAt: mostaqlScrapeRuns.finishedAt,
      status: mostaqlScrapeRuns.status,
      pagesRequested: mostaqlScrapeRuns.pagesRequested,
      pagesFetched: mostaqlScrapeRuns.pagesFetched,
      projectsFound: mostaqlScrapeRuns.projectsFound,
      projectsSaved: mostaqlScrapeRuns.projectsSaved,
      categoriesJson: mostaqlScrapeRuns.categoriesJson,
      errorMessage: mostaqlScrapeRuns.errorMessage,
    })
    .from(mostaqlScrapeRuns)
    .where(eq(mostaqlScrapeRuns.organizationId, organizationId))
    .orderBy(desc(mostaqlScrapeRuns.startedAt))
    .limit(runLimit);

  for (const [i, r] of runs.entries()) {
    const row = {
      id: r.id,
      started_at: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      finished_at: r.finishedAt instanceof Date ? r.finishedAt.toISOString() : r.finishedAt,
      status: r.status,
      pages_requested: r.pagesRequested,
      pages_fetched: r.pagesFetched,
      projects_found: r.projectsFound,
      projects_saved: r.projectsSaved,
      categories_json: r.categoriesJson,
      error_message: r.errorMessage,
    };
    const piece = `- ${JSON.stringify(row)}`;
    if (used + piece.length + 1 > budget) {
      lines.push(
        `… [run rows truncated after ${i} of ${runs.length} fetched; raise AI_CHAT_MOSTAQL_CHAR_BUDGET or AI_CHAT_MOSTAQL_MAX_RUNS]`
      );
      break;
    }
    lines.push(piece);
    used += piece.length + 1;
  }

  lines.push("", `### Scraped projects (newest by scraped_at; every column; up to ${projectLimit} of ${totalProjects} total for this organization)`, "");

  const projects = await db
    .select({
      id: mostaqlProjects.id,
      runId: mostaqlProjects.runId,
      mostaqlId: mostaqlProjects.mostaqlId,
      url: mostaqlProjects.url,
      title: mostaqlProjects.title,
      category: mostaqlProjects.category,
      subcategory: mostaqlProjects.subcategory,
      budgetMin: mostaqlProjects.budgetMin,
      budgetMax: mostaqlProjects.budgetMax,
      currency: mostaqlProjects.currency,
      description: mostaqlProjects.description,
      skillsTags: mostaqlProjects.skillsTags,
      clientName: mostaqlProjects.clientName,
      clientUrl: mostaqlProjects.clientUrl,
      offersCount: mostaqlProjects.offersCount,
      projectStatus: mostaqlProjects.projectStatus,
      publishedAt: mostaqlProjects.publishedAt,
      durationDays: mostaqlProjects.durationDays,
      scrapedAt: mostaqlProjects.scrapedAt,
    })
    .from(mostaqlProjects)
    .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
    .where(eq(mostaqlScrapeRuns.organizationId, organizationId))
    .orderBy(desc(mostaqlProjects.scrapedAt))
    .limit(projectLimit);

  for (const [i, p] of projects.entries()) {
    const row = {
      id: p.id,
      run_id: p.runId,
      mostaql_id: p.mostaqlId,
      url: p.url,
      title: p.title,
      category: p.category,
      subcategory: p.subcategory,
      budget_min: p.budgetMin != null ? String(p.budgetMin) : null,
      budget_max: p.budgetMax != null ? String(p.budgetMax) : null,
      currency: p.currency,
      description: p.description,
      skills_tags: p.skillsTags,
      client_name: p.clientName,
      client_url: p.clientUrl,
      offers_count: p.offersCount,
      project_status: p.projectStatus,
      published_at: p.publishedAt instanceof Date ? p.publishedAt.toISOString() : p.publishedAt,
      duration_days: p.durationDays,
      scraped_at: p.scrapedAt instanceof Date ? p.scrapedAt.toISOString() : p.scrapedAt,
    };
    const piece = `- ${JSON.stringify(row)}`;
    if (used + piece.length + 1 > budget) {
      lines.push(
        `… [project rows truncated after ${i} of ${projects.length} in this batch; ${totalProjects} total for this organization — increase AI_CHAT_MOSTAQL_MAX_PROJECT_ROWS or AI_CHAT_MOSTAQL_CHAR_BUDGET]`
      );
      break;
    }
    lines.push(piece);
    used += piece.length + 1;
  }

  lines.push(
    "",
    "_Note: CRM job bids live in the `proposals` table (different from scraped `mostaql_projects`). Totals above are scrape-only for this organization._"
  );

  return lines.join("\n");
}

/** For keyword search blocks — same columns as full export, fewer rows (skills matched via JSON cast text). */
export async function searchMostaqlProjectsFullColumns(
  organizationId: string,
  pattern: string,
  limit = 20
) {
  const safe = pattern.replace(/[%_\\]/g, "").slice(0, 64);
  if (!safe) return [];
  const p = `%${safe}%`;
  return db
    .select({
      id: mostaqlProjects.id,
      runId: mostaqlProjects.runId,
      mostaqlId: mostaqlProjects.mostaqlId,
      url: mostaqlProjects.url,
      title: mostaqlProjects.title,
      category: mostaqlProjects.category,
      subcategory: mostaqlProjects.subcategory,
      budgetMin: mostaqlProjects.budgetMin,
      budgetMax: mostaqlProjects.budgetMax,
      currency: mostaqlProjects.currency,
      description: mostaqlProjects.description,
      skillsTags: mostaqlProjects.skillsTags,
      clientName: mostaqlProjects.clientName,
      clientUrl: mostaqlProjects.clientUrl,
      offersCount: mostaqlProjects.offersCount,
      projectStatus: mostaqlProjects.projectStatus,
      publishedAt: mostaqlProjects.publishedAt,
      durationDays: mostaqlProjects.durationDays,
      scrapedAt: mostaqlProjects.scrapedAt,
    })
    .from(mostaqlProjects)
    .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
    .where(
      and(
        eq(mostaqlScrapeRuns.organizationId, organizationId),
        or(
          ilike(mostaqlProjects.title, p),
          ilike(mostaqlProjects.description, p),
          ilike(mostaqlProjects.clientName, p),
          ilike(mostaqlProjects.category, p),
          ilike(mostaqlProjects.subcategory, p),
          sql`${mostaqlProjects.skillsTags}::text ilike ${p}`
        )
      )
    )
    .orderBy(desc(mostaqlProjects.scrapedAt))
    .limit(limit);
}
