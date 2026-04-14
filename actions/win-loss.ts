"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, clients, winLossReasons } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import type { WinLossStats } from "@/lib/win-loss-types";
import {
  appendClientLossNoteBlock,
  CLIENT_LOSS_CATEGORY_LABEL_EN,
} from "@/lib/client-loss";
import {
  createWinLossReasonSchema,
  markClientLostSchema,
  markClientWonSchema,
  type CreateWinLossReasonInput,
  type MarkClientLostInput,
  type MarkClientWonInput,
} from "@/lib/win-loss-schemas";

export async function getWinLossReasons(type?: "won" | "lost") {
  try {
    const base = db.select().from(winLossReasons).$dynamic();
    const rows = await (type
      ? base.where(eq(winLossReasons.type, type))
      : base
    )
      .orderBy(asc(winLossReasons.type), asc(winLossReasons.reason));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getWinLossReasons", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load win/loss reasons" };
  }
}

export async function createWinLossReason(input: CreateWinLossReasonInput) {
  const parsed = createWinLossReasonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  try {
    const [row] = await db
      .insert(winLossReasons)
      .values({
        type: parsed.data.type,
        reason: parsed.data.reason.trim(),
      })
      .onConflictDoNothing({
        target: [winLossReasons.type, winLossReasons.reason],
      })
      .returning();
    if (!row) {
      const [existing] = await db
        .select()
        .from(winLossReasons)
        .where(
          and(
            eq(winLossReasons.type, parsed.data.type),
            eq(winLossReasons.reason, parsed.data.reason.trim())
          )!
        )
        .limit(1);
      if (existing) {
        revalidatePath("/dashboard/crm/pipeline");
        revalidatePath("/dashboard/crm/win-loss");
        return { ok: true as const, data: existing };
      }
      return { ok: false as const, error: { reason: ["Could not create reason"] } };
    }
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard/crm/win-loss");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createWinLossReason", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to create reason"] },
    };
  }
}

export async function markClientWon(input: MarkClientWonInput) {
  const parsed = markClientWonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { clientId, reason, dealValue } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [row] = await db
      .update(clients)
      .set({
        status: "completed",
        wonLostReason: reason.trim(),
        wonLostDate: today,
        dealValue: dealValue != null ? dealValue.toFixed(2) : null,
      })
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard/crm/win-loss");
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("markClientWon", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to mark client won"] },
    };
  }
}

export async function markClientLost(input: MarkClientLostInput) {
  const parsed = markClientLostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { clientId, lossCategory, notes } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const categoryLabel = CLIENT_LOSS_CATEGORY_LABEL_EN[lossCategory];
  try {
    const [prev] = await db
      .select({ notes: clients.notes })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (!prev) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }
    const nextNotes = appendClientLossNoteBlock({
      existingNotes: prev.notes,
      categoryLabel,
      why: notes,
      lostDateIso: today,
    });
    const [row] = await db
      .update(clients)
      .set({
        status: "closed",
        wonLostReason: categoryLabel,
        wonLostDate: today,
        dealValue: null,
        notes: nextNotes,
      })
      .where(eq(clients.id, clientId))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard/crm/win-loss");
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("markClientLost", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to mark client lost"] },
    };
  }
}

export async function getWinLossStats(): Promise<WinLossStats> {
  const sortReasonCounts = (map: Map<string, number>): { reason: string; count: number }[] =>
    [...map.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .filter((x) => x.reason && x.reason.trim() !== "")
      .sort((a, b) => b.count - a.count);

  const rows = await db
    .select({
      status: clients.status,
      wonLostReason: clients.wonLostReason,
      wonLostDate: clients.wonLostDate,
    })
    .from(clients)
    .where(and(isNull(clients.deletedAt), inArray(clients.status, ["completed", "closed"]))!);

  let wonCount = 0;
  let lostCount = 0;
  const wonReasons = new Map<string, number>();
  const lostReasons = new Map<string, number>();
  const monthMap = new Map<string, { won: number; lost: number }>();

  for (const r of rows) {
    const isWon = r.status === "completed";
    if (isWon) wonCount += 1;
    else lostCount += 1;

    const reason = (r.wonLostReason ?? "").trim();
    if (reason) {
      const target = isWon ? wonReasons : lostReasons;
      target.set(reason, (target.get(reason) ?? 0) + 1);
    }

    const d = r.wonLostDate ? String(r.wonLostDate) : "";
    if (d.length >= 7) {
      const monthKey = d.slice(0, 7);
      let bucket = monthMap.get(monthKey);
      if (!bucket) {
        bucket = { won: 0, lost: 0 };
        monthMap.set(monthKey, bucket);
      }
      if (isWon) bucket.won += 1;
      else bucket.lost += 1;
    }
  }

  const terminal = wonCount + lostCount;
  const winRate = terminal > 0 ? Math.round((wonCount / terminal) * 1000) / 10 : 0;

  const monthlyTrend = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, v]) => {
      const [y, m] = monthKey.split("-");
      const label =
        y && m          ? new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
              month: "short",
              year: "numeric",
            })
          : monthKey;
      return { monthKey, monthLabel: label, won: v.won, lost: v.lost };
    });

  return {
    wonCount,
    lostCount,
    winRate,
    topWonReasons: sortReasonCounts(wonReasons).slice(0, 10),
    topLostReasons: sortReasonCounts(lostReasons).slice(0, 10),
    monthlyTrend,
  };
}
