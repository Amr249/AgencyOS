import { NextResponse } from "next/server";
import { enqueueDailyMostaqlScrapes } from "@/lib/mostaql/daily-scrape";
import { processNextQueuedMostaqlRun } from "@/lib/mostaql/scrape-runner";
import { triggerMostaqlRunWorker } from "@/lib/mostaql/worker-client";

export const dynamic = "force-dynamic";
/** Vercel Hobby max is 300s; Pro allows up to 800s if you raise this later. */
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const secret = process.env.MOSTAQL_SCRAPE_SECRET ?? process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return !!(secret && authHeader === `Bearer ${secret}`);
}

/**
 * Daily automation (see vercel.json `0 8 * * *`):
 * 1) Enqueue an "all pages" scrape for each org with scrape_mostaql enabled
 * 2) Kick the oldest queued run (further runs chain when each finishes)
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const enqueue = await enqueueDailyMostaqlScrapes();

    let processResult: Awaited<ReturnType<typeof processNextQueuedMostaqlRun>>;
    if (enqueue.enqueued.length > 0) {
      try {
        await triggerMostaqlRunWorker(enqueue.enqueued[0]!.runId);
      } catch (e) {
        console.error(`[mostaql] cron:trigger ${enqueue.enqueued[0]!.runId}`, e);
      }
      processResult = { ok: true, runId: enqueue.enqueued[0]!.runId };
    } else {
      processResult = await processNextQueuedMostaqlRun();
    }

    return NextResponse.json({
      ok: true,
      data: {
        enqueue,
        process: processResult,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Daily Mostaql cron failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
