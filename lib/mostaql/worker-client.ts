import "server-only";

import { eq } from "drizzle-orm";
import { db, mostaqlScrapeRuns } from "@/lib/db";

export function mostaqlWorkerSecret(): string | null {
  return process.env.MOSTAQL_SCRAPE_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

export function appBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
  return null;
}

/** Invoke the long-running scrape worker for one run id. */
export async function triggerMostaqlRunWorker(runId: string): Promise<void> {
  const base = appBaseUrl();
  const secret = mostaqlWorkerSecret();
  if (!base || !secret) {
    const { processMostaqlScrapeRunById } = await import("@/lib/mostaql/scrape-runner");
    await processMostaqlScrapeRunById(runId);
    return;
  }
  const res = await fetch(`${base}/api/internal/mostaql-scrape-run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ runId }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Worker trigger failed (${res.status})`);
  }
}

/** After a run finishes, start the next queued run (multi-org / daily batch). */
export async function chainNextQueuedMostaqlRun(): Promise<void> {
  const [row] = await db
    .select({ id: mostaqlScrapeRuns.id })
    .from(mostaqlScrapeRuns)
    .where(eq(mostaqlScrapeRuns.status, "queued"))
    .orderBy(mostaqlScrapeRuns.startedAt)
    .limit(1);
  if (!row) return;
  try {
    await triggerMostaqlRunWorker(row.id);
  } catch (e) {
    console.error("[mostaql] chainNextQueuedMostaqlRun", e);
  }
}
