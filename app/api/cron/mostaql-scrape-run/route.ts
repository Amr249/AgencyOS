import { NextResponse } from "next/server";
import { processNextQueuedMostaqlRun } from "@/lib/mostaql/scrape-runner";

export const dynamic = "force-dynamic";
/** Vercel Hobby max is 300s; Pro allows up to 800s if you raise this later. */
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const secret = process.env.MOSTAQL_SCRAPE_SECRET ?? process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return !!(secret && authHeader === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processNextQueuedMostaqlRun();
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to process queued run" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
