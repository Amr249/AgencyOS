"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { db, clients } from "@/lib/db";

export async function deleteClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    await db.delete(clients).where(eq(clients.id, parsed.data));
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteClient", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete client",
    };
  }
}

const createClientSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  status: z.enum(["lead", "active", "on_hold", "completed", "closed"]).default("lead"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Phone is required"),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export async function createClient(input: CreateClientInput) {
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(clients)
      .values({
        companyName: data.companyName,
        status: data.status,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone ?? null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
        notes: data.notes ?? null,
      })
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Failed to create client"] } };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createClient", e);
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to create client"] },
    };
  }
}

export async function updateClient(input: UpdateClientInput) {
  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  try {
    const updatePayload: Record<string, unknown> = {};
    if (data.companyName !== undefined) updatePayload.companyName = data.companyName;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.contactName !== undefined) updatePayload.contactName = data.contactName;
    if (data.contactEmail !== undefined)
      updatePayload.contactEmail = data.contactEmail || null;
    if (data.contactPhone !== undefined) updatePayload.contactPhone = data.contactPhone;
    if (data.website !== undefined) updatePayload.website = data.website || null;
    if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl || null;
    if (data.notes !== undefined) updatePayload.notes = data.notes;

    const [row] = await db
      .update(clients)
      .set(updatePayload as typeof clients.$inferInsert)
      .where(eq(clients.id, id))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateClient", e);
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to update client"] },
    };
  }
}

export async function archiveClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const [row] = await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(eq(clients.id, parsed.data))
      .returning();
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("archiveClient", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to archive client",
    };
  }
}

export async function getClientsList() {
  try {
    const list = await db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.companyName);
    return { ok: true as const, data: list };
  } catch (e) {
    console.error("getClientsList", e);
    return { ok: false as const, error: "Failed to load clients" };
  }
}

export async function getArchivedClientsList() {
  try {
    const list = await db
      .select()
      .from(clients)
      .where(isNotNull(clients.deletedAt))
      .orderBy(clients.companyName);
    return { ok: true as const, data: list };
  } catch (e) {
    console.error("getArchivedClientsList", e);
    return { ok: false as const, error: "Failed to load archived clients" };
  }
}

export async function unarchiveClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const [row] = await db
      .update(clients)
      .set({ deletedAt: null })
      .where(eq(clients.id, parsed.data))
      .returning();
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("unarchiveClient", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to restore client",
    };
  }
}

export async function getClientById(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const [row] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, parsed.data));
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("getClientById", e);
    return { ok: false as const, error: "Failed to load client" };
  }
}
