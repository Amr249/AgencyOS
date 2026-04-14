"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { PROJECT_STATUS_LABELS_EN } from "@/types";

const CLIENT_STATUS_LABELS_EN: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  closed: "Lost",
};
import { db } from "@/lib/db";
import {
  activityLogs,
  tasks,
  milestones,
  invoices,
  invoiceProjects,
  projects,
  clients,
  files,
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

export type TimelineIconKind =
  | "client"
  | "status"
  | "project"
  | "invoice"
  | "file"
  | "note"
  | "proposal"
  | "task"
  | "milestone"
  | "generic";

/** Serialized client detail timeline row (English copy; dates as ISO). */
export type ClientTimelineItem = {
  id: string;
  createdAt: string;
  description: string;
  iconKind: TimelineIconKind;
  entityHref: string | null;
  actorName: string | null;
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

  const metaClientIds = new Set<string>();
  for (const log of logs) {
    const m = log.metadata as Record<string, unknown> | null | undefined;
    if (m && typeof m.clientId === "string") metaClientIds.add(m.clientId);
    if (m && typeof m.projectId === "string") projectIdsForNames.add(m.projectId);
  }

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

  const clientEntityIds = uniq([...byType.get("client") ?? [], ...metaClientIds]);
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

    if (mt === "file") {
      const fname = typeof meta?.name === "string" ? meta.name : metaLabel ?? "File";
      const cid = typeof meta?.clientId === "string" ? meta.clientId : null;
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
        entityLabel: fname,
        entityHref: cid ? `/dashboard/clients/${cid}` : pid ? `/dashboard/projects/${pid}` : null,
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

function metaStr(
  meta: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" ? v : undefined;
}

function describeClientTimelineEvent(
  log: ActivityLogRow,
  entry: RecentActivityEntry
): string {
  const meta = log.metadata as Record<string, unknown> | undefined;
  const mt = log.entityType.toLowerCase();
  const action = log.action;
  const label = entry.entityLabel ?? "";
  const invNum = metaStr(meta, "invoiceNumber");

  if (mt === "client") {
    if (action === "created") {
      const cn = metaStr(meta, "companyName") ?? label;
      return `${cn} was added as a client`;
    }
    if (action === "status_changed") {
      const to = metaStr(meta, "toStatus") ?? metaStr(meta, "status");
      const toLabel = to ? CLIENT_STATUS_LABELS_EN[to] ?? to : "updated";
      return `Client status changed to ${toLabel}`;
    }
    if (action === "notes_updated") return "Client notes were updated";
    if (action === "proposal_converted") {
      const title = metaStr(meta, "proposalTitle") ?? "Proposal";
      return `Proposal converted to this client: ${title}`;
    }
    return `Client ${action}`;
  }

  if (mt === "project") {
    if (action === "created") return `Project created: ${label}`;
    if (action === "deleted") return `Project removed: ${label}`;
    if (action === "updated") {
      const st = metaStr(meta, "status");
      if (st === "completed") return `Project completed: ${label}`;
      if (st) {
        const sl = PROJECT_STATUS_LABELS_EN[st] ?? st;
        return `Project ${label} updated (${sl})`;
      }
      return `Project updated: ${label}`;
    }
    return `Project ${action}: ${label}`;
  }

  if (mt === "invoice") {
    const num = invNum ?? label;
    if (action === "created") return `Invoice created: ${num}`;
    if (action === "paid") return `Invoice paid: ${num}`;
    return `Invoice ${action}: ${num}`;
  }

  if (mt === "file" && action === "uploaded") {
    return `File uploaded: ${metaStr(meta, "name") ?? label}`;
  }

  if (mt === "task") {
    if (action === "created") return `Task created: ${label}`;
    if (action === "status_changed") return `Task status updated: ${label}`;
    if (action === "deleted") return `Task removed: ${label}`;
    return `Task ${action}: ${label}`;
  }

  if (mt === "milestone") {
    if (action === "created") return `Milestone created: ${label}`;
    if (action === "completed") return `Milestone completed: ${label}`;
    return `Milestone ${action}: ${label}`;
  }

  return `${entry.entityType} ${action}: ${label}`;
}

function timelineIconKind(log: ActivityLogRow): TimelineIconKind {
  const mt = log.entityType.toLowerCase();
  const action = log.action;
  if (mt === "client") {
    if (action === "status_changed") return "status";
    if (action === "notes_updated") return "note";
    if (action === "proposal_converted") return "proposal";
    return "client";
  }
  if (mt === "project") return "project";
  if (mt === "invoice") return "invoice";
  if (mt === "file") return "file";
  if (mt === "task") return action === "status_changed" ? "status" : "task";
  if (mt === "milestone") return "milestone";
  return "generic";
}

/** Activity for a client: own logs plus related projects, invoices, tasks, milestones, and files. */
export async function getClientTimeline(clientId: string, limit = 150) {
  const idParsed = z.string().uuid().safeParse(clientId);
  const limParsed = z.number().int().min(1).max(500).safeParse(limit);
  if (!idParsed.success) return { ok: false as const, error: "Invalid client id" };
  if (!limParsed.success) return { ok: false as const, error: "Invalid limit" };

  const cid = idParsed.data;
  const lim = limParsed.data;

  try {
    const [clientRow] = await db
      .select({
        createdAt: clients.createdAt,
        companyName: clients.companyName,
      })
      .from(clients)
      .where(eq(clients.id, cid))
      .limit(1);
    if (!clientRow) {
      return { ok: false as const, error: "Client not found" };
    }

    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.clientId, cid));
    const projectIds = projectRows.map((r) => r.id);

    const invoiceRows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.clientId, cid));
    const invoiceIds = invoiceRows.map((r) => r.id);

    let taskIds: string[] = [];
    if (projectIds.length > 0) {
      const tr = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.projectId, projectIds));
      taskIds = tr.map((r) => r.id);
    }

    let milestoneIds: string[] = [];
    if (projectIds.length > 0) {
      const mr = await db
        .select({ id: milestones.id })
        .from(milestones)
        .where(inArray(milestones.projectId, projectIds));
      milestoneIds = mr.map((r) => r.id);
    }

    const fileParts = [eq(files.clientId, cid)];
    if (projectIds.length > 0) fileParts.push(inArray(files.projectId, projectIds));
    if (invoiceIds.length > 0) fileParts.push(inArray(files.invoiceId, invoiceIds));
    const fileRows = await db
      .select({ id: files.id })
      .from(files)
      .where(and(isNull(files.deletedAt), or(...fileParts)));
    const fileIds = fileRows.map((r) => r.id);

    const orParts = [and(eq(activityLogs.entityType, "client"), eq(activityLogs.entityId, cid))];
    if (projectIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "project"), inArray(activityLogs.entityId, projectIds))
      );
    }
    if (invoiceIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "invoice"), inArray(activityLogs.entityId, invoiceIds))
      );
    }
    if (taskIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "task"), inArray(activityLogs.entityId, taskIds))
      );
    }
    if (milestoneIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "milestone"), inArray(activityLogs.entityId, milestoneIds))
      );
    }
    if (fileIds.length > 0) {
      orParts.push(
        and(eq(activityLogs.entityType, "file"), inArray(activityLogs.entityId, fileIds))
      );
    }

    const whereClause = orParts.length === 1 ? orParts[0]! : or(...orParts);

    const logs = await db
      .select()
      .from(activityLogs)
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(Math.min(lim * 2, 500));

    const hasClientCreated = logs.some(
      (l) => l.entityType.toLowerCase() === "client" && l.action === "created"
    );

    const items: ClientTimelineItem[] = [];

    if (!hasClientCreated && clientRow.createdAt) {
      const ca =
        clientRow.createdAt instanceof Date
          ? clientRow.createdAt
          : new Date(clientRow.createdAt);
      items.push({
        id: `__fallback_client_created__${cid}`,
        createdAt: ca.toISOString(),
        description: `${clientRow.companyName ?? "Client"} was added as a client`,
        iconKind: "client",
        entityHref: `/dashboard/clients/${cid}`,
        actorName: null,
      });
    }

    const enriched = await enrichRecentActivityLogs(logs);
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]!;
      const e = enriched[i]!;
      items.push({
        id: e.id,
        createdAt: e.createdAt,
        description: describeClientTimelineEvent(log, e),
        iconKind: timelineIconKind(log),
        entityHref: e.entityHref,
        actorName: e.actorName,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { ok: true as const, data: items.slice(0, lim) };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client timeline" };
  }
}
