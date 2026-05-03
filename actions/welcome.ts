"use server";

import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Marks the one-time dashboard welcome toast as seen. User id comes only from the session. */
export async function markWelcomeSeen(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, error: "Unauthorized" };
  }
  if (session.user.role === "client_portal") {
    return { ok: true };
  }
  if (!sessionUserRole(session)) {
    return { ok: false, error: "Forbidden" };
  }

  try {
    await db.update(users).set({ hasSeenWelcome: true }).where(eq(users.id, session.user.id));
    return { ok: true };
  } catch (e) {
    console.error("markWelcomeSeen", e);
    return { ok: false, error: "Failed to save preference" };
  }
}
