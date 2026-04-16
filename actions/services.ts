"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db, projectServices, services } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const serviceStatusValues = ["active", "inactive"] as const;

const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional().nullable(),
  status: z.enum(serviceStatusValues).default("active"),
});

const updateServiceSchema = createServiceSchema.partial().extend({
  id: z.string().uuid(),
});

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  status: (typeof serviceStatusValues)[number];
  createdAt: Date;
  updatedAt: Date;
  projectCount: number;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getServices(): Promise<
  { ok: true; data: ServiceRow[] } | { ok: false; error: string }
> {
  try {
    const query = () =>
      db
        .select({
          id: services.id,
          name: services.name,
          description: services.description,
          status: services.status,
          createdAt: services.createdAt,
          updatedAt: services.updatedAt,
          projectCount: sql<number>`count(${projectServices.id})::int`,
        })
        .from(services)
        .leftJoin(projectServices, eq(projectServices.serviceId, services.id))
        .groupBy(services.id)
        .orderBy(asc(services.name));

    let rows: Awaited<ReturnType<typeof query>>;
    try {
      rows = await query();
    } catch (firstError) {
      if (!isDbConnectionError(firstError)) throw firstError;
      await sleep(350);
      rows = await query();
    }

    return { ok: true as const, data: rows as ServiceRow[] };
  } catch (e) {
    console.error("getServices", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load services" };
  }
}

export async function createService(input: z.infer<typeof createServiceSchema>) {
  const parsed = createServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  try {
    const [row] = await db.insert(services).values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
    }).returning();
    if (!row) return { ok: false as const, error: { _form: ["Failed to create service"] } };
    revalidatePath("/dashboard/services");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createService", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    return { ok: false as const, error: { _form: ["Failed to create service"] } };
  }
}

export async function updateService(input: z.infer<typeof updateServiceSchema>) {
  const parsed = updateServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  const { id, ...data } = parsed.data;
  const payload: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description ?? null;
  if (data.status !== undefined) payload.status = data.status;
  try {
    const [row] = await db.update(services).set(payload as typeof services.$inferInsert).where(eq(services.id, id)).returning();
    if (!row) return { ok: false as const, error: { _form: ["Service not found"] } };
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/projects");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateService", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    return { ok: false as const, error: { _form: ["Failed to update service"] } };
  }
}

export async function deleteService(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid service id" };
  try {
    const linked = await db.select({ count: sql<number>`count(*)::int` }).from(projectServices).where(eq(projectServices.serviceId, parsed.data));
    if ((linked[0]?.count ?? 0) > 0) return { ok: false as const, error: "Cannot delete service linked to projects" };
    const [row] = await db.delete(services).where(eq(services.id, parsed.data)).returning();
    if (!row) return { ok: false as const, error: "Service not found" };
    revalidatePath("/dashboard/services");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteService", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to delete service" };
  }
}

