"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientUsers, clients } from "@/lib/db/schema";
import { findPostgresErrorCode, getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { assertAdminSession } from "@/lib/auth-helpers";

function revalidateClient(clientId: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

function revalidateSettingsUsers() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/users");
}

export type ClientInviteOptionRow = {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
};

/** Admin-only: CRM clients list for inviting client portal users from Settings → Users. */
export async function listClientsForPortalInvite(): Promise<
  { ok: true; data: ClientInviteOptionRow[] } | { ok: false; error: string }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const rows = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        contactName: clients.contactName,
        contactEmail: clients.contactEmail,
      })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.companyName));

    return { ok: true, data: rows };
  } catch (e) {
    console.error("listClientsForPortalInvite", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

export type ClientPortalUserListRow = {
  id: string;
  clientId: string;
  companyName: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  invitedAt: Date | null;
  createdAt: Date;
};

/** Admin-only: all client portal users with CRM client name (Settings → Users). */
export async function listAllClientPortalUsers(): Promise<
  { ok: true; data: ClientPortalUserListRow[] } | { ok: false; error: string }
> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const rows = await db
      .select({
        id: clientUsers.id,
        clientId: clientUsers.clientId,
        email: clientUsers.email,
        name: clientUsers.name,
        isActive: clientUsers.isActive,
        lastLoginAt: clientUsers.lastLoginAt,
        invitedAt: clientUsers.invitedAt,
        createdAt: clientUsers.createdAt,
        companyName: clients.companyName,
      })
      .from(clientUsers)
      .innerJoin(clients, eq(clientUsers.clientId, clients.id))
      .where(isNull(clients.deletedAt))
      .orderBy(desc(clientUsers.createdAt));

    return { ok: true, data: rows };
  } catch (e) {
    console.error("listAllClientPortalUsers", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

const inviteSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(200),
  /** Optional initial password so the invitee can sign in immediately. Min 8 chars when set. */
  initialPassword: z.preprocess(
    (v) =>
      typeof v !== "string" || v.trim().length === 0 ? undefined : v.trim(),
    z.string().min(8).optional()
  ),
});

const setPasswordSchema = z.object({
  clientUserId: z.string().uuid(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function inviteClientUser(input: z.input<typeof inviteSchema>) {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { clientId, name } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const [clientRow] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (!clientRow) {
      return { ok: false as const, error: "Client not found" };
    }

    const passwordHash = parsed.data.initialPassword
      ? await bcrypt.hash(parsed.data.initialPassword, 12)
      : null;

    const inserted = await db
      .insert(clientUsers)
      .values({
        clientId,
        email,
        name: name.trim(),
        invitedAt: new Date(),
        passwordHash,
      })
      .returning({
        id: clientUsers.id,
        clientId: clientUsers.clientId,
        email: clientUsers.email,
        name: clientUsers.name,
        isActive: clientUsers.isActive,
        lastLoginAt: clientUsers.lastLoginAt,
        invitedAt: clientUsers.invitedAt,
        createdAt: clientUsers.createdAt,
      });

    let row = inserted[0];
    if (!row) {
      const [found] = await db
        .select({
          id: clientUsers.id,
          clientId: clientUsers.clientId,
          email: clientUsers.email,
          name: clientUsers.name,
          isActive: clientUsers.isActive,
          lastLoginAt: clientUsers.lastLoginAt,
          invitedAt: clientUsers.invitedAt,
          createdAt: clientUsers.createdAt,
        })
        .from(clientUsers)
        .where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.email, email)))
        .limit(1);
      row = found;
    }

    if (!row) {
      console.error("inviteClientUser: insert returned no row and no matching row found", {
        clientId,
        email,
      });
      return { ok: false as const, error: "Failed to invite user" };
    }
    revalidateClient(clientId);
    revalidateSettingsUsers();
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("inviteClientUser", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    const pgCode = findPostgresErrorCode(e);
    if (pgCode === "23505") {
      return {
        ok: false as const,
        error: "This email is already registered for a client portal user.",
      };
    }
    if (pgCode === "23503") {
      return {
        ok: false as const,
        error: "This client record is no longer valid. Refresh the page and pick a client again.",
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.toLowerCase().includes("unique") ||
      msg.includes("23505") ||
      msg.toLowerCase().includes("duplicate key")
    ) {
      return {
        ok: false as const,
        error: "This email is already registered for a client portal user.",
      };
    }
    return {
      ok: false as const,
      error:
        process.env.NODE_ENV === "development"
          ? `Invite failed: ${msg}`
          : "Failed to invite user",
    };
  }
}

export async function getClientUsers(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const rows = await db
      .select({
        id: clientUsers.id,
        clientId: clientUsers.clientId,
        email: clientUsers.email,
        name: clientUsers.name,
        isActive: clientUsers.isActive,
        lastLoginAt: clientUsers.lastLoginAt,
        invitedAt: clientUsers.invitedAt,
        createdAt: clientUsers.createdAt,
      })
      .from(clientUsers)
      .where(eq(clientUsers.clientId, parsed.data))
      .orderBy(asc(clientUsers.createdAt));
    return { ok: true as const, data: rows };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load portal users" };
  }
}

export async function deactivateClientUser(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid user id" };
  try {
    const [row] = await db
      .update(clientUsers)
      .set({ isActive: false })
      .where(eq(clientUsers.id, parsed.data))
      .returning({ clientId: clientUsers.clientId });
    if (!row) return { ok: false as const, error: "User not found" };
    revalidateClient(row.clientId);
    revalidateSettingsUsers();
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to deactivate user" };
  }
}

export async function enableClientPortal(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const [row] = await db
      .update(clients)
      .set({ portalEnabled: true })
      .where(eq(clients.id, parsed.data))
      .returning({ id: clients.id });
    if (!row) return { ok: false as const, error: "Client not found" };
    revalidateClient(parsed.data);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to enable portal" };
  }
}

/** Admin: set or reset a portal user's password (e.g. if invite had no initial password). */
export async function setClientPortalUserPassword(input: z.input<typeof setPasswordSchema>) {
  const admin = await assertAdminSession();
  if (!admin.ok) return { ok: false as const, error: "Forbidden" };

  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const [updated] = await db
      .update(clientUsers)
      .set({ passwordHash: hash })
      .where(eq(clientUsers.id, parsed.data.clientUserId))
      .returning({ clientId: clientUsers.clientId });
    if (!updated) return { ok: false as const, error: "User not found" };
    revalidateClient(updated.clientId);
    revalidateSettingsUsers();
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to set password" };
  }
}

export async function disableClientPortal(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const [row] = await db
      .update(clients)
      .set({ portalEnabled: false })
      .where(eq(clients.id, parsed.data))
      .returning({ id: clients.id });
    if (!row) return { ok: false as const, error: "Client not found" };
    revalidateClient(parsed.data);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to disable portal" };
  }
}
