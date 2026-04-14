"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientTagAssignments, clientTags, clients } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const tagColorValues = ["blue", "green", "red", "purple", "orange", "gray"] as const;

const createTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  color: z.enum(tagColorValues).optional().default("blue"),
});

const updateTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  color: z.enum(tagColorValues).optional(),
});

const tagIdSchema = z.string().uuid();

const assignSchema = z.object({
  clientId: z.string().uuid(),
  tagId: z.string().uuid(),
});

function revalidateClientPaths(clientId?: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/crm/pipeline");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function createTag(input: z.input<typeof createTagSchema>) {
  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const name = parsed.data.name.trim();
  if (!name) {
    return { ok: false as const, error: { name: ["Name is required"] } as Record<string, string[]> };
  }
  try {
    const [row] = await db
      .insert(clientTags)
      .values({ name, color: parsed.data.color })
      .returning();
    if (!row) return { ok: false as const, error: "Failed to create tag" };
    revalidateClientPaths();
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
      return { ok: false as const, error: "A tag with this name already exists." };
    }
    return { ok: false as const, error: "Failed to create tag" };
  }
}

export async function updateTag(input: z.input<typeof updateTagSchema>) {
  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...rest } = parsed.data;
  if (rest.name === undefined && rest.color === undefined) {
    return { ok: false as const, error: { _form: ["Nothing to update"] } };
  }
  try {
    const patch: { name?: string; color?: string } = {};
    if (rest.name !== undefined) patch.name = rest.name.trim();
    if (rest.color !== undefined) patch.color = rest.color;
    const [row] = await db.update(clientTags).set(patch).where(eq(clientTags.id, id)).returning();
    if (!row) return { ok: false as const, error: "Tag not found" };
    revalidateClientPaths();
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
      return { ok: false as const, error: "A tag with this name already exists." };
    }
    return { ok: false as const, error: "Failed to update tag" };
  }
}

export async function setClientTags(clientId: string, tagIds: string[]) {
  const clientParsed = z.string().uuid().safeParse(clientId);
  const idsParsed = z.array(z.string().uuid()).safeParse(tagIds);
  if (!clientParsed.success || !idsParsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  const uniqueIds = [...new Set(idsParsed.data)];
  try {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientParsed.data)).limit(1);
    if (!c) return { ok: false as const, error: "Client not found" };
    if (uniqueIds.length > 0) {
      const existing = await db
        .select({ id: clientTags.id })
        .from(clientTags)
        .where(inArray(clientTags.id, uniqueIds));
      if (existing.length !== uniqueIds.length) {
        return { ok: false as const, error: "One or more tags were not found" };
      }
    }
    await db.delete(clientTagAssignments).where(eq(clientTagAssignments.clientId, clientParsed.data));
    if (uniqueIds.length > 0) {
      await db.insert(clientTagAssignments).values(
        uniqueIds.map((tagId) => ({ clientId: clientParsed.data, tagId }))
      );
    }
    revalidateClientPaths(clientParsed.data);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update client tags" };
  }
}

export async function deleteTag(id: string) {
  const parsed = tagIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid tag id" };
  try {
    const [row] = await db.delete(clientTags).where(eq(clientTags.id, parsed.data)).returning();
    if (!row) return { ok: false as const, error: "Tag not found" };
    revalidateClientPaths();
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete tag" };
  }
}

export async function getTags() {
  try {
    const rows = await db.select().from(clientTags).orderBy(asc(clientTags.name));
    return { ok: true as const, data: rows };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load tags" };
  }
}

export async function assignTagToClient(input: z.input<typeof assignSchema>) {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { clientId, tagId } = parsed.data;
  try {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) return { ok: false as const, error: "Client not found" };
    const [t] = await db.select({ id: clientTags.id }).from(clientTags).where(eq(clientTags.id, tagId)).limit(1);
    if (!t) return { ok: false as const, error: "Tag not found" };

    await db
      .insert(clientTagAssignments)
      .values({ clientId, tagId })
      .onConflictDoNothing({ target: [clientTagAssignments.clientId, clientTagAssignments.tagId] });

    revalidateClientPaths(clientId);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to assign tag" };
  }
}

export async function removeTagFromClient(input: z.input<typeof assignSchema>) {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { clientId, tagId } = parsed.data;
  try {
    await db
      .delete(clientTagAssignments)
      .where(
        and(eq(clientTagAssignments.clientId, clientId), eq(clientTagAssignments.tagId, tagId))
      );
    revalidateClientPaths(clientId);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to remove tag" };
  }
}

export async function getClientTags(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const rows = await db
      .select({
        id: clientTags.id,
        name: clientTags.name,
        color: clientTags.color,
      })
      .from(clientTagAssignments)
      .innerJoin(clientTags, eq(clientTagAssignments.tagId, clientTags.id))
      .where(eq(clientTagAssignments.clientId, parsed.data))
      .orderBy(asc(clientTags.name));
    return { ok: true as const, data: rows };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client tags" };
  }
}

export async function getClientsByTag(tagId: string) {
  const parsed = tagIdSchema.safeParse(tagId);
  if (!parsed.success) return { ok: false as const, error: "Invalid tag id" };
  try {
    const rows = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        status: clients.status,
        contactEmail: clients.contactEmail,
        deletedAt: clients.deletedAt,
      })
      .from(clientTagAssignments)
      .innerJoin(clients, eq(clientTagAssignments.clientId, clients.id))
      .where(
        and(eq(clientTagAssignments.tagId, parsed.data), isNull(clients.deletedAt))
      )
      .orderBy(asc(clients.companyName));
    return { ok: true as const, data: rows };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load clients" };
  }
}
