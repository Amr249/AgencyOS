"use server";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  files,
  invoiceItems,
  invoiceProjects,
  invoices,
  payments,
  projects,
} from "@/lib/db/schema";
import type { MemberSalaryExpenseRow } from "@/actions/member-dashboard";
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
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(and(eq(projects.clientId, ctx.clientId), isNull(projects.deletedAt)));

    const totalProjectCount = projectRows.length;
    const activeProjectCount = projectRows.filter((p) => p.status === "active").length;
    const completedProjectCount = projectRows.filter((p) => p.status === "completed").length;
    const reviewProjectCount = projectRows.filter((p) => p.status === "review").length;

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
        totalProjectCount,
        activeProjectCount,
        completedProjectCount,
        reviewProjectCount,
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
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
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

/** Client-visible payment rows (invoice payments + legacy fully-paid invoices) for the payments UI. */
export type PortalClientPaymentLedgerRow = MemberSalaryExpenseRow & {
  invoiceId: string;
  invoiceNumber: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  currency: string;
};

export async function getPortalClientPaymentLedger(): Promise<
  | {
      ok: true;
      data: PortalClientPaymentLedgerRow[];
      defaultCurrency: string;
    }
  | { ok: false; error: "unauthorized" | ReturnType<typeof getDbErrorKey> | "unknown" }
> {
  const ctx = await getPortalSession();
  if (!ctx) return { ok: false as const, error: "unauthorized" as const };

  try {
    const invRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        total: invoices.total,
        paidAt: invoices.paidAt,
        issueDate: invoices.issueDate,
        projectId: invoices.projectId,
        currency: invoices.currency,
      })
      .from(invoices)
      .where(eq(invoices.clientId, ctx.clientId))
      .orderBy(desc(invoices.issueDate));

    if (invRows.length === 0) {
      return { ok: true as const, data: [], defaultCurrency: "SAR" };
    }

    const invIds = invRows.map((r) => r.id);
    const defaultCurrency = invRows[0]?.currency ?? "SAR";
    const invMap = new Map(invRows.map((i) => [i.id, i]));

    const itemRows = await db
      .select({
        invoiceId: invoiceItems.invoiceId,
        description: invoiceItems.description,
        order: invoiceItems.order,
      })
      .from(invoiceItems)
      .where(inArray(invoiceItems.invoiceId, invIds))
      .orderBy(asc(invoiceItems.order));

    const servicesByInvoice = new Map<string, string[]>();
    for (const it of itemRows) {
      const arr = servicesByInvoice.get(it.invoiceId) ?? [];
      arr.push(it.description);
      servicesByInvoice.set(it.invoiceId, arr);
    }

    const linkRows = await db
      .select({
        invoiceId: invoiceProjects.invoiceId,
        projectId: invoiceProjects.projectId,
        name: projects.name,
        coverImageUrl: projects.coverImageUrl,
        clientLogoUrl: clients.logoUrl,
      })
      .from(invoiceProjects)
      .innerJoin(projects, eq(invoiceProjects.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(inArray(invoiceProjects.invoiceId, invIds))
      .orderBy(asc(projects.name));

    const linksByInv = new Map<string, typeof linkRows>();
    for (const l of linkRows) {
      const arr = linksByInv.get(l.invoiceId) ?? [];
      arr.push(l);
      linksByInv.set(l.invoiceId, arr);
    }

    const extraProjectIds = new Set<string>();
    for (const inv of invRows) {
      if (inv.projectId) extraProjectIds.add(inv.projectId);
    }
    for (const l of linkRows) extraProjectIds.add(l.projectId);

    const projectMeta = new Map<
      string,
      { name: string; cover: string | null; logo: string | null }
    >();
    if (extraProjectIds.size > 0) {
      const plist = [...extraProjectIds];
      const pr = await db
        .select({
          id: projects.id,
          name: projects.name,
          coverImageUrl: projects.coverImageUrl,
          clientLogoUrl: clients.logoUrl,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(inArray(projects.id, plist));
      for (const p of pr) {
        projectMeta.set(p.id, {
          name: p.name,
          cover: p.coverImageUrl,
          logo: p.clientLogoUrl,
        });
      }
    }

    function resolveProject(inv: (typeof invRows)[number]): {
      projectId: string | null;
      projectName: string | null;
      cover: string | null;
      logo: string | null;
    } {
      if (inv.projectId) {
        const m = projectMeta.get(inv.projectId);
        if (m) {
          return {
            projectId: inv.projectId,
            projectName: m.name,
            cover: m.cover,
            logo: m.logo,
          };
        }
      }
      const links = linksByInv.get(inv.id);
      if (links?.length) {
        const first = links[0]!;
        return {
          projectId: first.projectId,
          projectName: first.name,
          cover: first.coverImageUrl,
          logo: first.clientLogoUrl,
        };
      }
      return { projectId: null, projectName: null, cover: null, logo: null };
    }

    function paidAtToYmd(paidAt: (typeof invRows)[number]["paidAt"]): string {
      if (paidAt == null) return "";
      if (paidAt instanceof Date && !Number.isNaN(paidAt.getTime())) {
        return paidAt.toISOString().slice(0, 10);
      }
      return "";
    }

    function issueToYmd(issue: (typeof invRows)[number]["issueDate"]): string {
      return String(issue).slice(0, 10);
    }

    function paymentDateToYmd(value: unknown): string {
      if (value == null) return "";
      if (typeof value === "string") return value.slice(0, 10);
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }
      return String(value).slice(0, 10);
    }

    const payRows = await db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        reference: payments.reference,
        notes: payments.notes,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(invoices.clientId, ctx.clientId))
      .orderBy(desc(payments.paymentDate));

    const out: PortalClientPaymentLedgerRow[] = [];

    for (const p of payRows) {
      const inv = invMap.get(p.invoiceId);
      if (!inv) continue;
      const proj = resolveProject(inv);
      const serviceNames = servicesByInvoice.get(inv.id) ?? [];
      const dateStr = paymentDateToYmd(p.paymentDate);
      out.push({
        id: p.id,
        title: inv.invoiceNumber,
        amount: String(p.amount),
        date: dateStr,
        receiptUrl: null,
        projectId: proj.projectId,
        projectName: proj.projectName,
        projectCoverImageUrl: proj.cover,
        projectClientLogoUrl: proj.logo,
        serviceNames,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        paymentMethod: p.paymentMethod ?? null,
        reference: p.reference ?? null,
        notes: p.notes ?? null,
        currency: inv.currency,
      });
    }

    const paidCountByInv = new Map<string, number>();
    for (const p of payRows) {
      paidCountByInv.set(p.invoiceId, (paidCountByInv.get(p.invoiceId) ?? 0) + 1);
    }

    for (const inv of invRows) {
      if (inv.status !== "paid") continue;
      if ((paidCountByInv.get(inv.id) ?? 0) > 0) continue;
      const proj = resolveProject(inv);
      const serviceNames = servicesByInvoice.get(inv.id) ?? [];
      const paidStr = paidAtToYmd(inv.paidAt);
      const dateStr = paidStr || issueToYmd(inv.issueDate);
      out.push({
        id: `legacy-paid:${inv.id}`,
        title: inv.invoiceNumber,
        amount: String(inv.total),
        date: dateStr,
        receiptUrl: null,
        projectId: proj.projectId,
        projectName: proj.projectName,
        projectCoverImageUrl: proj.cover,
        projectClientLogoUrl: proj.logo,
        serviceNames,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        paymentMethod: null,
        reference: null,
        notes: null,
        currency: inv.currency,
      });
    }

    out.sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true as const, data: out, defaultCurrency };
  } catch (e) {
    console.error("getPortalClientPaymentLedger", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "unknown" };
  }
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
      label: `فاتورة ${inv.invoiceNumber}`,
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
