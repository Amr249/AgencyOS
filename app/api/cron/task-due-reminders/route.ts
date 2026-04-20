import { NextResponse } from "next/server";
import { runTaskDueReminderJob } from "@/lib/task-due-reminders";

export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return !!(secret && authHeader === `Bearer ${secret}`);
}

/**
 * Daily cron: notifies assignees (1 day before + on due date) and all admins for every open task with a due date.
 * Secure with env `CRON_SECRET`; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when configured.
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTaskDueReminderJob();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: result.data });
}

export async function POST(request: Request) {
  return GET(request);
}
