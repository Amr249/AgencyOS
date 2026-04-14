"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientUsers, clients } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

function revalidateClient(clientId: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

const inviteSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(200),
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

    const [row] = await db
      .insert(clientUsers)
      .values({
        clientId,
        email,
        name: name.trim(),
        invitedAt: new Date(),
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

    if (!row) return { ok: false as const, error: "Failed to invite user" };
    revalidateClient(clientId);
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
      return { ok: false as const, error: "This email is already registered for a client portal user." };
    }
    return { ok: false as const, error: "Failed to invite user" };
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
