import { NextResponse } from "next/server";
import { z } from "zod";
import { processMostaqlScrapeRunById } from "@/lib/mostaql/scrape-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const bodySchema = z.object({
  runId: z.string().uuid(),
});

function authorize(request: Request): boolean {
  const secret = process.env.MOSTAQL_SCRAPE_SECRET ?? process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return !!(secret && authHeader === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  try {
    const result = await processMostaqlScrapeRunById(parsed.data.runId);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to process run" },
      { status: 500 }
    );
  }
}
