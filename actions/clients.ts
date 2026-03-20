"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, clientServices, clients, projects, services } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

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
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete client",
    };
  }
}

export async function deleteClients(ids: string[]) {
  const uuidSchema = z.array(z.string().uuid());
  const parsed = uuidSchema.safeParse(ids);
  if (!parsed.success || ids.length === 0) {
    return { ok: false as const, error: "Invalid client ids" };
  }
  try {
    await db.delete(clients).where(inArray(clients.id, parsed.data));
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteClients", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete clients",
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
  serviceIds: z.array(z.string().uuid()).optional(),
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
    if (data.serviceIds?.length) {
      await db.insert(clientServices).values(
        data.serviceIds.map((serviceId) => ({
          clientId: row.id,
          serviceId,
        }))
      );
    }
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
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
    const serviceIds = data.serviceIds;

    const [row] = await db
      .update(clients)
      .set(updatePayload as typeof clients.$inferInsert)
      .where(eq(clients.id, id))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }
    if (serviceIds !== undefined) {
      await db.delete(clientServices).where(eq(clientServices.clientId, id));
      if (serviceIds.length) {
        await db.insert(clientServices).values(
          serviceIds.map((serviceId) => ({
            clientId: id,
            serviceId,
          }))
        );
      }
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
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
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to archive client",
    };
  }
}

async function mergeProjectCounts<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { projectCount: number }>> {
  if (rows.length === 0) return [];
  const countRows = await db
    .select({
      clientId: projects.clientId,
      n: count(),
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.clientId);
  const countMap = new Map(countRows.map((r) => [r.clientId, Number(r.n)]));
  return rows.map((c) => ({
    ...c,
    projectCount: countMap.get(c.id) ?? 0,
  }));
}

export async function getClientsList() {
  try {
    const list = await db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.companyName);
    const data = await mergeProjectCounts(list);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getClientsList", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
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
    const data = await mergeProjectCounts(list);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getArchivedClientsList", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
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
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
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
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client" };
  }
}

export async function getClientServiceIds(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const rows = await db
      .select({ serviceId: clientServices.serviceId })
      .from(clientServices)
      .where(eq(clientServices.clientId, parsed.data));
    return { ok: true as const, data: rows.map((r) => r.serviceId) };
  } catch (e) {
    console.error("getClientServiceIds", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client services" };
  }
}

export async function getServiceIdsByClientIds(clientIds: string[]) {
  if (clientIds.length === 0) return { ok: true as const, data: {} as Record<string, { id: string; name: string; status: string }[]> };
  const parsed = z.array(z.string().uuid()).safeParse(clientIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid client ids" };
  try {
    const rows = await db
      .select({
        clientId: clientServices.clientId,
        serviceId: services.id,
        serviceName: services.name,
        serviceStatus: services.status,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .where(inArray(clientServices.clientId, parsed.data));
    const data: Record<string, { id: string; name: string; status: string }[]> = {};
    for (const id of parsed.data) data[id] = [];
    for (const row of rows) {
      data[row.clientId]?.push({
        id: row.serviceId,
        name: row.serviceName,
        status: row.serviceStatus,
      });
    }
    return { ok: true as const, data };
  } catch (e) {
    console.error("getServiceIdsByClientIds", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client services map" };
  }
}
