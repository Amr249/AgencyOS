"use server";

import { eq, isNull, and, desc, inArray, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, projects, tasks, clients, settings } from "@/lib/db";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  parseISO,
  isBefore,
  isAfter,
  addDays,
  startOfDay,
} from "date-fns";

export type DashboardData = {
  currency: string;
  revenueThisMonth: number;
  revenueLastMonth: number;
  outstandingTotal: number;
  outstandingCount: number;
  activeProjectsCount: number;
  overdueTasksCount: number;
  revenueByMonth: { month: string; invoiced: number; collected: number }[];
  projectStatusCounts: { status: string; count: number; label: string }[];
  overdueTasks: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    dueDate: string;
    daysOverdue: number;
  }[];
  upcomingProjects: {
    id: string;
    name: string;
    clientName: string | null;
    endDate: string;
    status: string;
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    clientName: string | null;
    total: string;
    status: string;
  }[];
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  lead: "Lead",
  review: "Review",
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const twelveMonthsAgo = startOfMonth(subMonths(now, 11));

  const [settingsRow] = await db
    .select({ defaultCurrency: settings.defaultCurrency })
    .from(settings)
    .where(eq(settings.id, 1));
  const currency = settingsRow?.defaultCurrency ?? "USD";

  const allInvoices = await db
    .select({
      id: invoices.id,
      total: invoices.total,
      status: invoices.status,
      paidAt: invoices.paidAt,
      issueDate: invoices.issueDate,
      createdAt: invoices.createdAt,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
    })
    .from(invoices);

  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let outstandingTotal = 0;
  let outstandingCount = 0;
  const monthMap = new Map<
    string,
    { invoiced: number; collected: number }
  >();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, 11 - i);
    monthMap.set(format(d, "yyyy-MM"), { invoiced: 0, collected: 0 });
  }

  for (const inv of allInvoices) {
    const totalNum = Number(inv.total);
    if (inv.status === "paid" && inv.paidAt) {
      const paidAt = new Date(inv.paidAt);
      if (!isBefore(paidAt, thisMonthStart) && !isAfter(paidAt, thisMonthEnd)) {
        revenueThisMonth += totalNum;
      }
      if (!isBefore(paidAt, lastMonthStart) && !isAfter(paidAt, lastMonthEnd)) {
        revenueLastMonth += totalNum;
      }
      const key = format(paidAt, "yyyy-MM");
      if (monthMap.has(key)) {
        monthMap.get(key)!.collected += totalNum;
      }
    }
    if (inv.status === "pending") {
      outstandingTotal += totalNum;
      outstandingCount += 1;
    }
    const issueDate = inv.issueDate ? parseISO(String(inv.issueDate)) : null;
    if (issueDate && !isBefore(issueDate, twelveMonthsAgo)) {
      const key = format(issueDate, "yyyy-MM");
      if (monthMap.has(key)) {
        monthMap.get(key)!.invoiced += totalNum;
      }
    }
  }

  const revenueByMonth = Array.from(monthMap.entries()).map(([month, v]) => ({
    month: format(parseISO(`${month}-01`), "MMM yyyy"),
    invoiced: Math.round(v.invoiced * 100) / 100,
    collected: Math.round(v.collected * 100) / 100,
  }));

  const activeProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.status, "active"), isNull(projects.deletedAt))
    );
  const activeProjectsCount = activeProjects.length;

  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      dueDate: tasks.dueDate,
      status: tasks.status,
    })
    .from(tasks)
    .where(isNull(tasks.deletedAt));
  const today = startOfDay(now);
  const overdueTasksRows = allTasks.filter(
    (t) =>
      t.dueDate &&
      isBefore(parseISO(String(t.dueDate)), today) &&
      t.status !== "done"
  );
  const overdueTasksCount = overdueTasksRows.length;

  const projectIds = [...new Set(overdueTasksRows.map((t) => t.projectId))];
  const projectNames =
    projectIds.length > 0
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];
  const projectNameMap = new Map(projectNames.map((p) => [p.id, p.name]));

  const overdueTasks = overdueTasksRows
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: projectNameMap.get(t.projectId) ?? "—",
      dueDate: String(t.dueDate),
      daysOverdue: Math.floor(
        (today.getTime() - parseISO(String(t.dueDate)).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

  const todayStr = format(now, "yyyy-MM-dd");
  const fourteenDaysLaterStr = format(addDays(now, 14), "yyyy-MM-dd");
  const upcomingProjectsRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      endDate: projects.endDate,
      status: projects.status,
    })
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        gte(projects.endDate, todayStr),
        lte(projects.endDate, fourteenDaysLaterStr)
      )
    )
    .orderBy(projects.endDate)
    .limit(5);

  const clientIds = [...new Set(upcomingProjectsRows.map((p) => p.clientId))];
  const clientNames =
    clientIds.length > 0
      ? await db
          .select({ id: clients.id, companyName: clients.companyName })
          .from(clients)
          .where(inArray(clients.id, clientIds))
      : [];
  const clientNameMap = new Map(clientNames.map((c) => [c.id, c.companyName]));

  const upcomingProjects = upcomingProjectsRows.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.clientId ? clientNameMap.get(p.clientId) ?? null : null,
    endDate: String(p.endDate),
    status: p.status,
  }));

  const recentInvoicesRows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      total: invoices.total,
      status: invoices.status,
    })
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(5);

  const invClientIds = [...new Set(recentInvoicesRows.map((i) => i.clientId))];
  const invClientNames =
    invClientIds.length > 0
      ? await db
          .select({ id: clients.id, companyName: clients.companyName })
          .from(clients)
          .where(inArray(clients.id, invClientIds))
      : [];
  const invClientMap = new Map(invClientNames.map((c) => [c.id, c.companyName]));

  const recentInvoices = recentInvoicesRows.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientName: invClientMap.get(i.clientId) ?? null,
    total: String(i.total),
    status: i.status,
  }));

  const projectStatusRows = await db
    .select({ status: projects.status })
    .from(projects)
    .where(isNull(projects.deletedAt));
  const statusCounts = new Map<string, number>();
  for (const r of projectStatusRows) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  const projectStatusCounts = Array.from(statusCounts.entries()).map(
    ([status, count]) => ({
      status,
      count,
      label: PROJECT_STATUS_LABELS[status] ?? status,
    })
  );

  return {
    currency,
    revenueThisMonth,
    revenueLastMonth,
    outstandingTotal,
    outstandingCount,
    activeProjectsCount,
    overdueTasksCount,
    revenueByMonth,
    projectStatusCounts,
    overdueTasks,
    upcomingProjects,
    recentInvoices,
  };
}
