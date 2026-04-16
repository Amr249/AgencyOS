"use server";

import { and, desc, eq, inArray, isNull, count } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
  actorId: string | null;
};

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

async function listAdminUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.map((r) => r.id);
}

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  actorId?: string | null;
};

/**
 * Insert notifications for a list of recipients. De-duplicates `userId`s and silently
 * ignores failures so that the caller's primary action is not blocked.
 */
export async function createNotificationsForUsers(
  input: Omit<CreateNotificationInput, "userId"> & { userIds: string[] }
): Promise<void> {
  const uniqueIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  try {
    await db.insert(notifications).values(
      uniqueIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkUrl: input.linkUrl ?? null,
        actorId: input.actorId ?? null,
      }))
    );
  } catch (e) {
    console.error("createNotificationsForUsers", e);
  }
}

/**
 * Helper: fan-out a notification to the target user + all admins.
 * Caller passes a single "event" and both the target user and every admin gets a row.
 */
export async function notifyUserAndAdmins(input: {
  targetUserId: string;
  actorId: string | null;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}): Promise<void> {
  const adminIds = await listAdminUserIds();
  const ids = new Set<string>([input.targetUserId, ...adminIds]);
  await createNotificationsForUsers({
    userIds: Array.from(ids),
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    linkUrl: input.linkUrl ?? null,
    actorId: input.actorId,
  });
}

export async function listMyNotifications(limit = 30): Promise<
  { ok: true; data: NotificationRow[] } | { ok: false; error: "unauthorized" | "unknown" }
> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  try {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorId: notifications.actorId,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return { ok: true, data: rows };
  } catch (e) {
    console.error("listMyNotifications", e);
    return { ok: false, error: "unknown" };
  }
}

export async function getMyUnreadNotificationCount(): Promise<
  { ok: true; count: number } | { ok: false; error: "unauthorized" | "unknown" }
> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  try {
    const [row] = await db
      .select({ n: count(notifications.id) })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true, count: Number(row?.n ?? 0) };
  } catch (e) {
    console.error("getMyUnreadNotificationCount", e);
    return { ok: false, error: "unknown" };
  }
}

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  all: z.boolean().optional(),
});

export async function markNotificationsRead(
  input: z.infer<typeof markReadSchema>
): Promise<{ ok: true } | { ok: false; error: "unauthorized" | "validation" | "unknown" }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    const now = new Date();
    if (parsed.data.all) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    } else if (parsed.data.ids && parsed.data.ids.length > 0) {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, userId), inArray(notifications.id, parsed.data.ids)));
    } else {
      return { ok: false, error: "validation" };
    }
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    console.error("markNotificationsRead", e);
    return { ok: false, error: "unknown" };
  }
}

const deleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  all: z.boolean().optional(),
});

export async function deleteNotifications(
  input: z.infer<typeof deleteSchema>
): Promise<{ ok: true } | { ok: false; error: "unauthorized" | "validation" | "unknown" }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    if (parsed.data.all) {
      await db.delete(notifications).where(eq(notifications.userId, userId));
    } else if (parsed.data.ids && parsed.data.ids.length > 0) {
      await db
        .delete(notifications)
        .where(and(eq(notifications.userId, userId), inArray(notifications.id, parsed.data.ids)));
    } else {
      return { ok: false, error: "validation" };
    }
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    console.error("deleteNotifications", e);
    return { ok: false, error: "unknown" };
  }
}
