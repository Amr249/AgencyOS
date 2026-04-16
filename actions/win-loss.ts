"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, clients, winLossReasons } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  appendClientLossNoteBlock,
  CLIENT_LOSS_CATEGORY_LABEL_EN,
} from "@/lib/client-loss";
import {
  markClientLostSchema,
  markClientWonSchema,
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
