import type { Metadata } from "next";
import {
  getMostaqlProjects,
  getMostaqlScrapeRuns,
} from "@/actions/mostaql-reports";
import { MostaqlReportsView } from "@/components/modules/proposals/mostaql-reports-view";

export const metadata: Metadata = {
  title: "Mostaql Reports",
  description: "Scraped market data from Mostaql.com (programming + AI/ML)",
};

/** Allow the long-running scrape server action to run up to 5 minutes. */
export const maxDuration = 300;

type PageProps = {
  searchParams: Promise<{ run?: string; start?: string; end?: string }>;
};

/** Parse a YYYY-MM-DD string to a Date in UTC; returns undefined if invalid. */
function parseDateParam(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const date = new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    )
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function MostaqlReportsPage({ searchParams }: PageProps) {
  const { run: runParam, start: startParam, end: endParam } = await searchParams;
  const startDate = parseDateParam(startParam, false);
  const endDate = parseDateParam(endParam, true);

  const [runsResult, projectsResult] = await Promise.all([
    getMostaqlScrapeRuns(20),
    getMostaqlProjects({ runId: runParam, startDate, endDate }),
  ]);

  const runs = runsResult.ok ? runsResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data.projects : [];
  const activeRunId = projectsResult.ok ? projectsResult.data.runId : null;
  const error = !runsResult.ok
    ? runsResult.error
    : !projectsResult.ok
      ? projectsResult.error
      : null;

  return (
    <MostaqlReportsView
      runs={runs}
      projects={projects}
      activeRunId={activeRunId}
      startDate={startParam ?? null}
      endDate={endParam ?? null}
      error={error}
    />
  );
}
