"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { db } from "@/lib/db";
import {
  activityLogs,
  tasks,
  milestones,
  invoices,
  invoiceProjects,
  projects,
  clients,
} from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

type ActivityLogRow = typeof activityLogs.$inferSelect;

export type RecentActivityEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string | null;
  /** ISO timestamp (serializable for client components) */
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  entityLabel: string | null;
  entityHref: string | null;
  relativeTime: string;
};

const logActivitySchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().uuid(),
  action: z.string().min(1).max(64),
  actorName: z.string().min(1).max(256).optional().nullable(),
  actorId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const getByEntitySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  limit: z.number().int().min(1).max(500).optional().default(50),
});

const limitOnlySchema = z.number().int().min(1).max(500).optional().default(50);

export type LogActivityInput = z.infer<typeof logActivitySchema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getActivityActor(): Promise<{ actorName: string; actorId: string | undefined }> {
  try {
    const session = await getServerSession(authOptions);
    const u = session?.user;
    if (!u) return { actorName: "Admin", actorId: undefined };
    const name = (typeof u.name === "string" && u.name.trim()) || u.email || "Admin";
    const id = (u as { id?: string }).id;
    return {
      actorName: name,
      actorId: id && UUID_RE.test(id) ? id : undefined,
    };
  } catch {
    return { actorName: "Admin", actorId: undefined };
  }
}

/** Attach current session user; logs a warning if insert fails (does not throw). */
export async function logActivityWithActor(
  input: Omit<LogActivityInput, "actorName" | "actorId">
): Promise<void> {
  const { actorName, actorId } = await getActivityActor();
  const res = await logActivity({
    ...input,
    actorName,
    ...(actorId ? { actorId } : {}),
  });
  if (!res.ok) console.warn("[activity-log] logActivity failed", res.error);
}

export async function logActivity(input: LogActivityInput) {
  const parsed = logActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const { entityType, entityId, action, actorName, actorId, metadata } = parsed.data;

  try {
    const [row] = await db
      .insert(activityLogs)
      .values({
        entityType,
        entityId,
        action,
        actorName: actorName ?? null,
        actorId: actorId ?? null,
        metadata: metadata ?? null,
      })
      .returning();

    if (!row) return { ok: false as const, error: "Failed to create activity log" };

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/activity");

    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to create activity log" };
  }
}

export async function getActivityByEntity(entityType: string, entityId: string, limit?: number) {
  const parsed = getByEntitySchema.safeParse({ entityType, entityId, limit });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const data = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.entityType, parsed.data.entityType),
          eq(activityLogs.entityId, parsed.data.entityId)
        )
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(parsed.data.limit);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load activity" };
  }
}

async function enrichRecentActivityLogs(logs: ActivityLogRow[]): Promise<RecentActivityEntry[]> {
  if (logs.length === 0) return [];

  const byType = new Map<string, string[]>();
  for (const log of logs) {
    const t = log.entityType.toLowerCase();
    const arr = byType.get(t) ?? [];
    arr.push(log.entityId);
    byType.set(t, arr);
  }

  const uniq = (ids: string[]) => [...new Set(ids)];

  const projectIdsForNames = new Set<string>();
  const projectMap = new Map<string, string>();
  const taskMap = new Map<string, { title: string; projectId: string }>();
  const milestoneMap = new Map<string, { name: string; projectId: string }>();
  const invoiceMap = new Map<string, { invoiceNumber: string; projectId: string | null }>();
  const clientMap = new Map<string, string>();

  const projectEntityIds = uniq(byType.get("project") ?? []);
  for (const id of projectEntityIds) projectIdsForNames.add(id);

  const taskEntityIds = uniq(byType.get("task") ?? []);
  if (taskEntityIds.length > 0) {
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId })
      .from(tasks)
      .where(inArray(tasks.id, taskEntityIds));
    for (const r of rows) {
      taskMap.set(r.id, { title: r.title, projectId: r.projectId });
      projectIdsForNames.add(r.projectId);
    }
  }

  const milestoneEntityIds = uniq(byType.get("milestone") ?? []);
  if (milestoneEntityIds.length > 0) {
    const rows = await db
      .select({ id: milestones.id, name: milestones.name, projectId: milestones.projectId })
      .from(milestones)
      .where(inArray(milestones.id, milestoneEntityIds));
    for (const r of rows) {
      milestoneMap.set(r.id, { name: r.name, projectId: r.projectId });
      projectIdsForNames.add(r.projectId);
    }
  }

  const invoiceEntityIds = uniq(byType.get("invoice") ?? []);
  if (invoiceEntityIds.length > 0) {
    const invRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
      })
      .from(invoices)
      .where(inArray(invoices.id, invoiceEntityIds));

    const needLink = invRows.filter((r) => !r.projectId).map((r) => r.id);
    const firstProjectByInvoice = new Map<string, string>();
    if (needLink.length > 0) {
      const links = await db
        .select({
          invoiceId: invoiceProjects.invoiceId,
          projectId: invoiceProjects.projectId,
        })
        .from(invoiceProjects)
        .where(inArray(invoiceProjects.invoiceId, needLink));
      for (const l of links) {
        if (!firstProjectByInvoice.has(l.invoiceId)) {
          firstProjectByInvoice.set(l.invoiceId, l.projectId);
        }
      }
    }
    for (const inv of invRows) {
      const pid = inv.projectId ?? firstProjectByInvoice.get(inv.id) ?? null;
      invoiceMap.set(inv.id, { invoiceNumber: inv.invoiceNumber, projectId: pid });
      if (pid) projectIdsForNames.add(pid);
    }
  }

  const clientEntityIds = uniq(byType.get("client") ?? []);
  if (clientEntityIds.length > 0) {
    const rows = await db
      .select({ id: clients.id, companyName: clients.companyName })
      .from(clients)
      .where(inArray(clients.id, clientEntityIds));
    for (const r of rows) {
      clientMap.set(r.id, r.companyName ?? "Client");
    }
  }

  if (projectIdsForNames.size > 0) {
    const rows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, [...projectIdsForNames]));
    for (const r of rows) projectMap.set(r.id, r.name);
  }

  const resolve = (log: ActivityLogRow): Omit<RecentActivityEntry, "relativeTime" | "createdAt"> & { createdAt: Date } => {
    const meta = log.metadata;
    const mt = log.entityType.toLowerCase();
    const metaPid = typeof meta?.projectId === "string" ? meta.projectId : null;
    const metaLabel = typeof meta?.title === "string" ? meta.title : typeof meta?.name === "string" ? meta.name : null;

    if (mt === "project") {
      const name = projectMap.get(log.entityId) ?? "Project";
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
        projectId: log.entityId,
        projectName: name,
        entityLabel: name,
        entityHref: `/dashboard/projects/${log.entityId}`,
      };
    }

    if (mt === "task") {
      const t = taskMap.get(log.entityId);
      const pid = t?.projectId ?? metaPid;
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
        projectId: pid ?? null,
        projectName: pid ? projectMap.get(pid) ?? null : null,
        entityLabel: t?.title ?? metaLabel ?? "Task",
        entityHref: pid ? `/dashboard/projects/${pid}` : null,
      };
    }

    if (mt === "milestone") {
      const m = milestoneMap.get(log.entityId);
      const pid = m?.projectId ?? metaPid;
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
        projectId: pid ?? null,
        projectName: pid ? projectMap.get(pid) ?? null : null,
        entityLabel: m?.name ?? metaLabel ?? "Milestone",
        entityHref: pid ? `/dashboard/projects/${pid}` : null,
      };
    }

    if (mt === "invoice") {
      const inv = invoiceMap.get(log.entityId);
      const pid = inv?.projectId ?? metaPid;
      const label = inv?.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : metaLabel ?? "Invoice";
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
        projectId: pid ?? null,
        projectName: pid ? projectMap.get(pid) ?? null : null,
        entityLabel: label,
        entityHref: `/dashboard/invoices/${log.entityId}`,
      };
    }

    if (mt === "client") {
      const name = clientMap.get(log.entityId) ?? metaLabel ?? "Client";
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        actorName: log.actorName,
        createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
        projectId: metaPid,
        projectName: metaPid ? projectMap.get(metaPid) ?? null : null,
        entityLabel: name,
        entityHref: `/dashboard/clients/${log.entityId}`,
      };
    }

    const pid = metaPid;
    return {
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      actorName: log.actorName,
      createdAt: log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt),
      projectId: pid,
      projectName: pid ? projectMap.get(pid) ?? null : null,
      entityLabel: metaLabel ?? log.entityType,
      entityHref: pid ? `/dashboard/projects/${pid}` : null,
    };
  };

  return logs.map((log) => {
    const base = resolve(log);
    const created = base.createdAt;
    return {
      id: base.id,
      entityType: base.entityType,
      entityId: base.entityId,
      action: base.action,
      actorName: base.actorName,
      createdAt: created.toISOString(),
      projectId: base.projectId,
      projectName: base.projectName,
      entityLabel: base.entityLabel,
      entityHref: base.entityHref,
      relativeTime: formatDistanceToNow(created, { addSuffix: true, locale: enUS }),
    };
  });
}

export async function getRecentActivity(limit?: number) {
  const parsed = limitOnlySchema.safeParse(limit);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid limit" };
  }

  try {
    const logs = await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(parsed.data);

    const data = await enrichRecentActivityLogs(logs);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load recent activity" };
  }
}

export async function getProjectActivity(projectId: string, limit?: number) {
  const idParsed = z.string().uuid().safeParse(projectId);
  const limitParsed = limitOnlySchema.safeParse(limit);
  if (!idParsed.success) return { ok: false as const, error: "Invalid project id" };
  if (!limitParsed.success) return { ok: false as const, error: "Invalid limit" };

  const pid = idParsed.data;
  const lim = limitParsed.data;

  try {
    const [taskRows, milestoneRows, invoiceDirectRows, invoiceJunctionRows] = await Promise.all([
      db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, pid)),
      db.select({ id: milestones.id }).from(milestones).where(eq(milestones.projectId, pid)),
      db.select({ id: invoices.id }).from(invoices).where(eq(invoices.projectId, pid)),
      db
        .select({ invoiceId: invoiceProjects.invoiceId })
        .from(invoiceProjects)
        .where(eq(invoiceProjects.projectId, pid)),
    ]);

    const taskIds = taskRows.map((r) => r.id);
    const milestoneIds = milestoneRows.map((r) => r.id);
    const invoiceIds = [
      ...new Set([
        ...invoiceDirectRows.map((r) => r.id),
        ...invoiceJunctionRows.map((r) => r.invoiceId),
      ]),
    ];

    const orParts = [and(eq(activityLogs.entityType, "project"), eq(activityLogs.entityId, pid))];
    if (taskIds.length > 0) {
      orParts.push(and(eq(activityLogs.entityType, "task"), inArray(activityLogs.entityId, taskIds)));
    }
    if (milestoneIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "milestone"), inArray(activityLogs.entityId, milestoneIds))
      );
    }
    if (invoiceIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "invoice"), inArray(activityLogs.entityId, invoiceIds))
      );
    }

    const whereClause = orParts.length === 1 ? orParts[0]! : or(...orParts);

    const data = await db
      .select()
      .from(activityLogs)
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(lim);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load project activity" };
  }
}
