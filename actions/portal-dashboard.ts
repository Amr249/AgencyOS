"use server";

import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, files, projects } from "@/lib/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { getInvoicesWithPayments } from "@/actions/invoices";
import { getProjectTaskCounts } from "@/actions/projects";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

export async function getPortalDashboardSummary() {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };

  try {
    const [clientRow] = await db
      .select({
        companyName: clients.companyName,
        logoUrl: clients.logoUrl,
      })
      .from(clients)
      .where(and(eq(clients.id, ctx.clientId), isNull(clients.deletedAt)))
      .limit(1);

    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.clientId, ctx.clientId), isNull(projects.deletedAt)));

    const projectIds = projectRows.map((p) => p.id);
    const countsRes =
      projectIds.length > 0 ? await getProjectTaskCounts(projectIds) : { ok: true as const, data: {} };
    const counts = countsRes.ok ? countsRes.data : {};

    let tasksDone = 0;
    let tasksTotal = 0;
    for (const id of projectIds) {
      tasksDone += counts[id]?.done ?? 0;
      tasksTotal += counts[id]?.total ?? 0;
    }
    const overallTaskPercent =
      tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);

    const invRes = await getInvoicesWithPayments({ clientId: ctx.clientId });
    const invoiceRows = invRes.ok ? invRes.data ?? [] : [];
    const openAmountDue = invoiceRows
      .filter((i) => i.status !== "paid")
      .reduce((sum, i) => sum + i.amountDue, 0);

    return {
      ok: true as const,
      data: {
        clientName: clientRow?.companyName ?? "",
        logoUrl: clientRow?.logoUrl ?? null,
        activeProjectCount: projectIds.length,
        openAmountDue,
        currency: invoiceRows[0]?.currency ?? "USD",
        overallTaskPercent,
        tasksDone,
        tasksTotal,
      },
    };
  } catch (e) {
    console.error("getPortalDashboardSummary", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}

export async function getPortalProjects() {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };

  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        coverImageUrl: projects.coverImageUrl,
      })
      .from(projects)
      .where(and(eq(projects.clientId, ctx.clientId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt));

    const ids = rows.map((r) => r.id);
    const countsRes = ids.length > 0 ? await getProjectTaskCounts(ids) : { ok: true as const, data: {} };
    const counts = countsRes.ok ? countsRes.data : {};

    const data = rows.map((r) => {
      const c = counts[r.id] ?? { total: 0, done: 0 };
      const percent = c.total === 0 ? 0 : Math.round((c.done / c.total) * 100);
      return {
        ...r,
        taskTotal: c.total,
        taskDone: c.done,
        taskPercent: percent,
      };
    });

    return { ok: true as const, data };
  } catch (e) {
    console.error("getPortalProjects", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}

export async function getPortalInvoices() {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };
  return getInvoicesWithPayments({ clientId: ctx.clientId });
}

/** Shared deliverables: files tagged to the client or any of their projects (no internal expense rows). */
export async function getPortalSharedFiles() {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };

  try {
    const projectIds = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.clientId, ctx.clientId), isNull(projects.deletedAt)));

    const pidList = projectIds.map((p) => p.id);

    const scopeOr =
      pidList.length > 0
        ? or(eq(files.clientId, ctx.clientId), inArray(files.projectId, pidList))!
        : eq(files.clientId, ctx.clientId);

    const conditions = [isNull(files.deletedAt), isNull(files.expenseId), scopeOr];

    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        imagekitUrl: files.imagekitUrl,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        description: files.description,
        clientId: files.clientId,
        projectId: files.projectId,
        invoiceId: files.invoiceId,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt))
      .limit(100);

    const projectNames: Record<string, string> = {};
    if (pidList.length) {
      const pr = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, pidList));
      for (const p of pr) projectNames[p.id] = p.name;
    }

    const data = rows.map((f) => ({
      ...f,
      projectName: f.projectId ? projectNames[f.projectId] ?? null : null,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getPortalSharedFiles", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}

export type PortalActivityItem =
  | {
      kind: "invoice";
      id: string;
      label: string;
      sublabel: string | null;
      at: Date;
      meta: string;
    }
  | {
      kind: "file";
      id: string;
      label: string;
      sublabel: string | null;
      at: Date;
      meta: string;
    };

/** Lightweight combined timeline for the portal home (sanitized). */
export async function getPortalActivityFeed(limit = 12) {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };

  try {
    const invRes = await getInvoicesWithPayments({ clientId: ctx.clientId });
    const invs = invRes.ok ? invRes.data ?? [] : [];

    const invItems: PortalActivityItem[] = invs.slice(0, 8).map((inv) => ({
      kind: "invoice" as const,
      id: inv.id,
      label: `Invoice ${inv.invoiceNumber}`,
      sublabel: inv.projectName ?? null,
      at: new Date(`${String(inv.issueDate).slice(0, 10)}T12:00:00`),
      meta: inv.status,
    }));

    const filesRes = await getPortalSharedFiles();
    const fileRows = filesRes.ok ? filesRes.data ?? [] : [];
    const fileItems: PortalActivityItem[] = fileRows.slice(0, 8).map((f) => ({
      kind: "file" as const,
      id: f.id,
      label: f.name,
      sublabel: f.projectName,
      at: f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt),
      meta: f.mimeType ?? "file",
    }));

    const merged = [...invItems, ...fileItems]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);

    return { ok: true as const, data: merged };
  } catch (e) {
    console.error("getPortalActivityFeed", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
}
