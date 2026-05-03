"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, projectServices, services, projects } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { requireAgencyOrganization } from "@/lib/org-session";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";

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
    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();
    const ctx = await requireAgencyOrganization();
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, parsedProjectId.data), eq(projects.organizationId, ctx.organizationId))
      )
      .limit(1);
    if (!proj) {
      return { ok: false as const, error: "Project not found" };
    }
    await db.delete(projectServices).where(eq(projectServices.projectId, parsedProjectId.data));
    if (parsedServiceIds.data.length > 0) {
      const validServices = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.organizationId, ctx.organizationId),
            inArray(services.id, parsedServiceIds.data)
          )
        );
      const allowed = new Set(validServices.map((s) => s.id));
      const toInsert = parsedServiceIds.data.filter((id) => allowed.has(id));
      if (toInsert.length > 0) {
        await db.insert(projectServices).values(
          toInsert.map((serviceId) => ({
            projectId: parsedProjectId.data,
            serviceId,
          }))
        );
      }
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
    const ctx = await requireAgencyOrganization();
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(inArray(projects.id, parsed.data), eq(projects.organizationId, ctx.organizationId))
      );
    const allowedIds = owned.map((r) => r.id);
    if (allowedIds.length === 0) return { ok: true as const, data: {} };

    const rows = await db
      .select({
        projectId: projectServices.projectId,
        serviceId: services.id,
        serviceName: services.name,
        serviceStatus: services.status,
      })
      .from(projectServices)
      .innerJoin(services, eq(projectServices.serviceId, services.id))
      .where(
        and(inArray(projectServices.projectId, allowedIds), eq(services.organizationId, ctx.organizationId))
      );

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
