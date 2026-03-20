"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, projectServices, services } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

export async function syncProjectServices(projectId: string, serviceIds?: string[]) {
  const parsedProjectId = z.string().uuid().safeParse(projectId);
  if (!parsedProjectId.success) {
    return { ok: false as const, error: "Invalid project id" };
  }
  if (serviceIds === undefined) return { ok: true as const };
  const parsedServiceIds = z.array(z.string().uuid()).safeParse(serviceIds);
  if (!parsedServiceIds.success) {
    return { ok: false as const, error: "Invalid service ids" };
  }
  try {
    await db.delete(projectServices).where(eq(projectServices.projectId, parsedProjectId.data));
    if (parsedServiceIds.data.length > 0) {
      await db.insert(projectServices).values(
        parsedServiceIds.data.map((serviceId) => ({
          projectId: parsedProjectId.data,
          serviceId,
        }))
      );
    }
    return { ok: true as const };
  } catch (e) {
    console.error("syncProjectServices", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to sync project services" };
  }
}

export async function getServiceIdsByProjectIds(projectIds: string[]): Promise<
  { ok: true; data: Record<string, { id: string; name: string; status: string }[]> } | { ok: false; error: string }
> {
  if (projectIds.length === 0) return { ok: true as const, data: {} };
  const parsed = z.array(z.string().uuid()).safeParse(projectIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid project ids" };
  try {
    const rows = await db
      .select({
        projectId: projectServices.projectId,
        serviceId: services.id,
        serviceName: services.name,
        serviceStatus: services.status,
      })
      .from(projectServices)
      .innerJoin(services, eq(projectServices.serviceId, services.id))
      .where(inArray(projectServices.projectId, parsed.data));

    const data: Record<string, { id: string; name: string; status: string }[]> = {};
    for (const id of parsed.data) data[id] = [];
    for (const row of rows) {
      data[row.projectId]?.push({
        id: row.serviceId,
        name: row.serviceName,
        status: row.serviceStatus,
      });
    }
    return { ok: true as const, data };
  } catch (e) {
    console.error("getServiceIdsByProjectIds", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load project services" };
  }
}
