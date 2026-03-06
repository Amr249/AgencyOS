"use server";

import { eq, isNull, and, sql, inArray, lt, ne, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, tasks, clients, invoices, expenses } from "@/lib/db";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  parseISO,
  startOfDay,
  getYear,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isBefore,
  isAfter,
  startOfYear,
  differenceInDays,
} from "date-fns";
import { ar } from "date-fns/locale";

// --- Types ---

export type ProjectsSummary = {
  activeProjectsCount: number;
  completedThisYearCount: number;
  overdueTasksCount: number;
  taskCompletionRate: number; // 0–100
  totalTasks: number;
  doneTasks: number;
};

export type ProjectsByStatusRow = {
  status: string;
  count: number;
  label: string;
};

export type WeeklyTaskCompletionRow = {
  weekLabel: string;
  weekStart: string;
  count: number;
};

export type OverdueTaskRow = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: string;
  dueDate: string;
  daysOverdue: number;
};

export type ActiveProjectRow = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  status: string;
  endDate: string | null;
  budget: string | null;
  totalTasks: number;
  doneTasks: number;
  daysRemaining: number | null;
};

export type NewClientsPerMonthRow = {
  monthKey: string;
  monthLabel: string;
  count: number;
};

export type RecentClientRow = {
  id: string;
  companyName: string;
  status: string;
  createdAt: string;
};

// Status labels Arabic (for reports)
const PROJECT_STATUS_LABELS_AR: Record<string, string> = {
  lead: "عميل محتمل",
  active: "نشط",
  on_hold: "متوقف",
  review: "مراجعة",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export async function getProjectsSummary(): Promise<ProjectsSummary> {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentYear = getYear(now);

  const [activeCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(eq(projects.status, "active"), isNull(projects.deletedAt)));

  const [completedThisYearResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(
      and(
        eq(projects.status, "completed"),
        isNull(projects.deletedAt),
        sql`${projects.endDate} is not null and to_char(${projects.endDate}, 'YYYY') = ${String(currentYear)}`
      )
    );

  const allTasksCounts = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    })
    .from(tasks)
    .where(isNull(tasks.deletedAt));

  const [overdueCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        ne(tasks.status, "done"),
        sql`${tasks.dueDate} is not null`,
        lt(tasks.dueDate, todayStr)
      )
    );

  const totalTasks = allTasksCounts[0]?.total ?? 0;
  const doneTasks = allTasksCounts[0]?.done ?? 0;
  const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return {
    activeProjectsCount: activeCountResult?.count ?? 0,
    completedThisYearCount: completedThisYearResult?.count ?? 0,
    overdueTasksCount: overdueCountResult?.count ?? 0,
    taskCompletionRate,
    totalTasks,
    doneTasks,
  };
}

export async function getProjectsByStatus(): Promise<ProjectsByStatusRow[]> {
  const rows = await db
    .select({
      status: projects.status,
      count: sql<number>`count(*)::int`,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.status);

  return rows.map((r) => ({
    status: r.status,
    count: r.count,
    label: PROJECT_STATUS_LABELS_AR[r.status] ?? r.status,
  }));
}

/** Last 8 weeks: count of tasks with status = 'done' by week of createdAt (approximation for "completed that week"). */
export async function getWeeklyTaskCompletion(): Promise<WeeklyTaskCompletionRow[]> {
  const now = new Date();
  const result: WeeklyTaskCompletionRow[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 6 }); // Saturday start for Saudi
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 6 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "done"),
          isNull(tasks.deletedAt),
          gte(tasks.createdAt, weekStart),
          lte(tasks.createdAt, weekEnd)
        )
      );

    result.push({
      weekLabel: `الأسبوع ${8 - i}`,
      weekStart: weekStartStr,
      count: row?.count ?? 0,
    });
  }
  return result;
}

export async function getOverdueTasks(): Promise<OverdueTaskRow[]> {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const today = startOfDay(now);

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        ne(tasks.status, "done"),
        sql`${tasks.dueDate} is not null`,
        lt(tasks.dueDate, todayStr)
      )
    )
    .orderBy(tasks.dueDate);

  const projectIds = [...new Set(taskRows.map((t) => t.projectId))];
  const projectNames =
    projectIds.length > 0
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];
  const projectNameMap = new Map(projectNames.map((p) => [p.id, p.name]));

  return taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    projectName: projectNameMap.get(t.projectId) ?? "—",
    priority: t.priority,
    dueDate: String(t.dueDate),
    daysOverdue: Math.floor(
      (today.getTime() - parseISO(String(t.dueDate)).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

export async function getActiveProjectsWithProgress(): Promise<ActiveProjectRow[]> {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      status: projects.status,
      endDate: projects.endDate,
      budget: projects.budget,
      clientName: clients.companyName,
      clientLogoUrl: clients.logoUrl,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        isNull(projects.deletedAt),
        ne(projects.status, "completed"),
        ne(projects.status, "cancelled")
      )
    )
    .orderBy(projects.endDate);

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);
  const taskCountsResult = await db
    .select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))
    .groupBy(tasks.projectId);

  const countMap = new Map<string, { total: number; done: number }>();
  for (const id of projectIds) countMap.set(id, { total: 0, done: 0 });
  for (const row of taskCountsResult) {
    if (row.projectId) countMap.set(row.projectId, { total: row.total, done: row.done });
  }

  return projectRows.map((p) => {
    const counts = countMap.get(p.id) ?? { total: 0, done: 0 };
    const endDate = p.endDate ? parseISO(String(p.endDate)) : null;
    const daysRemaining =
      endDate != null
        ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    return {
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      clientName: p.clientName ?? "—",
      clientLogoUrl: p.clientLogoUrl ?? null,
      status: p.status,
      endDate: p.endDate,
      budget: p.budget,
      totalTasks: counts.total,
      doneTasks: counts.done,
      daysRemaining,
    };
  });
}

export async function getNewClientsPerMonth(year: number): Promise<{
  total: number;
  byMonth: NewClientsPerMonthRow[];
  recent: RecentClientRow[];
}> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const yearStart = new Date(`${start}T00:00:00.000Z`);
  const yearEnd = new Date(`${end}T23:59:59.999Z`);

  const allInYear = await db
    .select({ createdAt: clients.createdAt })
    .from(clients)
    .where(
      and(
        isNull(clients.deletedAt),
        gte(clients.createdAt, yearStart),
        lte(clients.createdAt, yearEnd)
      )
    );

  const monthCounts = new Map<string, number>();
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    monthCounts.set(key, 0);
  }
  for (const r of allInYear) {
    const key = format(new Date(r.createdAt), "yyyy-MM");
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const monthLabels: Record<string, string> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const d = parseISO(`${key}-01`);
    monthLabels[key] = format(d, "MMMM", { locale: ar });
  }

  const byMonth: NewClientsPerMonthRow[] = Array.from(monthCounts.entries()).map(
    ([monthKey, count]) => ({
      monthKey,
      monthLabel: monthLabels[monthKey] ?? monthKey,
      count,
    })
  );
  byMonth.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const recentRows = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      status: clients.status,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(
      and(
        isNull(clients.deletedAt),
        gte(clients.createdAt, yearStart),
        lte(clients.createdAt, yearEnd)
      )
    )
    .orderBy(desc(clients.createdAt))
    .limit(5);

  const recent: RecentClientRow[] = recentRows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));

  return {
    total: allInYear.length,
    byMonth,
    recent,
  };
}

// --- Financial Reports ---

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export type DateRangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "all";

export type FinancialSummary = {
  revenueThisMonth: number; // SUM(total) WHERE status='paid' AND paid_at in current month
  revenueLastMonth: number;
  totalCollectedAllTime: number;
  totalCollectedThisYear: number; // SUM(total) WHERE status='paid' AND EXTRACT(YEAR FROM paid_at) = current year
  outstandingTotal: number;
  invoicedThisYear: number; // by issue_date
};

export type MonthlyRevenuePoint = {
  monthKey: string;
  monthLabel: string;
  profits: number;
  expenses: number;
};

export type TopClientRow = {
  clientId: string;
  clientName: string | null;
  logoUrl: string | null;
  totalPaid: number;
  invoiceCount: number;
};

export type RecentInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientName: string | null;
  total: string;
  status: string;
  createdAt: Date;
};

export type OutstandingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string | null;
  clientLogoUrl: string | null;
  projectName: string | null;
  total: string;
  issueDate: string;
  daysSinceIssue: number;
};

/** KPI summary for financial reports. إيرادات هذا الشهر and إجمالي الأرباح هذه السنة use paid_at. */
export async function getFinancialSummary(): Promise<FinancialSummary> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const thisYearStart = startOfYear(now);
  const currentYear = getYear(now);

  const rows = await db
    .select({
      total: invoices.total,
      status: invoices.status,
      paidAt: invoices.paidAt,
      issueDate: invoices.issueDate,
    })
    .from(invoices);

  let revenueThisMonth = 0; // SUM where paid_at in current month
  let revenueLastMonth = 0;
  let totalCollectedAllTime = 0;
  let totalCollectedThisYear = 0; // SUM where status=paid AND year(paid_at)=currentYear
  let outstandingTotal = 0;
  let invoicedThisYear = 0;

  for (const inv of rows) {
    const totalNum = Number(inv.total);
    if (inv.status === "paid" && inv.paidAt) {
      const paidAt = new Date(inv.paidAt);
      totalCollectedAllTime += totalNum;
      if (getYear(paidAt) === currentYear) {
        totalCollectedThisYear += totalNum;
      }
      if (!isBefore(paidAt, thisMonthStart) && !isAfter(paidAt, thisMonthEnd)) {
        revenueThisMonth += totalNum;
      }
      if (!isBefore(paidAt, lastMonthStart) && !isAfter(paidAt, lastMonthEnd)) {
        revenueLastMonth += totalNum;
      }
    }
    if (inv.status === "pending") {
      outstandingTotal += totalNum;
    }
    const issueDate = inv.issueDate ? parseISO(String(inv.issueDate)) : null;
    if (issueDate && !isBefore(issueDate, thisYearStart)) {
      invoicedThisYear += totalNum;
    }
  }

  return {
    revenueThisMonth,
    revenueLastMonth,
    totalCollectedAllTime,
    totalCollectedThisYear,
    outstandingTotal,
    invoicedThisYear,
  };
}

/** Last 12 months with Arabic labels. Collected by paid_at (cast to timestamptz), expenses by date. */
export async function getMonthlyRevenue(dateRange: DateRangeKey): Promise<MonthlyRevenuePoint[]> {
  const now = new Date();

  // Debug: log paid_at values to verify storage type
  const debug = await db.select({ paidAt: invoices.paidAt, status: invoices.status }).from(invoices);
  console.log("Invoice paid_at values:", debug);

  let monthKeys: string[];
  if (dateRange === "this_year") {
    monthKeys = [];
    for (let m = 0; m < 12; m++) {
      monthKeys.push(format(new Date(now.getFullYear(), m, 1), "yyyy-MM"));
    }
  } else {
    monthKeys = [];
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, 11 - i);
      monthKeys.push(format(d, "yyyy-MM"));
    }
  }

  const firstMonth = monthKeys[0]!;
  const lastMonth = monthKeys[monthKeys.length - 1]!;
  const rangeStart = parseISO(`${firstMonth}-01`);
  const rangeEnd = startOfMonth(addMonths(parseISO(`${lastMonth}-01`), 1));

  // الأرباح — grouped by paid_at (cast to timestamptz so string/timestamp both work)
  const collectedRaw = await db.execute(sql`
    SELECT to_char(paid_at::timestamptz, 'YYYY-MM') as month_key, sum(total)::numeric as total
    FROM invoices
    WHERE status = 'paid' AND paid_at IS NOT NULL
      AND paid_at::timestamptz >= ${rangeStart}
      AND paid_at::timestamptz < ${rangeEnd}
    GROUP BY to_char(paid_at::timestamptz, 'YYYY-MM')
  `);
  const collectedRows = Array.isArray(collectedRaw) ? collectedRaw : (collectedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
  const collectedMap = new Map<string, number>();
  for (const row of collectedRows) {
    const r = row as { month_key: string; total: string };
    collectedMap.set(r.month_key, Number(r.total));
  }

  // Monthly expenses (by expense date)
  const expenseRangeEnd = format(endOfMonth(parseISO(`${lastMonth}-01`)), "yyyy-MM-dd");
  const expenseRows = await db
    .select({ date: expenses.date, amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.date, `${firstMonth}-01`), lte(expenses.date, expenseRangeEnd)));
  const expensesMap = new Map<string, number>();
  for (const ex of expenseRows) {
    const key = format(parseISO(String(ex.date)), "yyyy-MM");
    const prev = expensesMap.get(key) ?? 0;
    expensesMap.set(key, prev + Number(ex.amount));
  }

  return monthKeys.map((monthKey) => {
    const [, mStr] = monthKey.split("-");
    const m = parseInt(mStr, 10);
    const monthLabel = ARABIC_MONTHS[m - 1] ?? monthKey;
    return {
      monthKey,
      monthLabel,
      profits: Math.round((collectedMap.get(monthKey) ?? 0) * 100) / 100,
      expenses: Math.round((expensesMap.get(monthKey) ?? 0) * 100) / 100,
    };
  });
}

/** Monthly profits and expenses between startDate and endDate for the area chart. */
export type MonthlyAreaPoint = {
  month: number;
  year: number;
  monthLabel: string;
  profits: number;
  expenses: number;
};

/** Returns monthly profits and expenses between startDate and endDate. Sorted by year ASC, month ASC. */
export async function getMonthlyAreaData(
  startDate: string,
  endDate: string
): Promise<MonthlyAreaPoint[]> {
  const rangeStart = startOfMonth(parseISO(startDate));
  const rangeEnd = endOfMonth(parseISO(endDate));

  const monthKeys: string[] = [];
  let d = rangeStart;
  while (d <= rangeEnd) {
    monthKeys.push(format(d, "yyyy-MM"));
    d = addMonths(d, 1);
  }

  const firstMonth = monthKeys[0]!;
  const lastMonth = monthKeys[monthKeys.length - 1]!;
  const rangeStartSql = parseISO(`${firstMonth}-01`);
  const rangeEndSql = startOfMonth(addMonths(parseISO(`${lastMonth}-01`), 1));

  const collectedRaw = await db.execute(sql`
    SELECT to_char(paid_at::timestamptz, 'YYYY-MM') as month_key, sum(total)::numeric as total
    FROM invoices
    WHERE status = 'paid' AND paid_at IS NOT NULL
      AND paid_at::timestamptz >= ${rangeStartSql}
      AND paid_at::timestamptz < ${rangeEndSql}
    GROUP BY to_char(paid_at::timestamptz, 'YYYY-MM')
  `);
  const collectedRows = Array.isArray(collectedRaw) ? collectedRaw : (collectedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
  const collectedMap = new Map<string, number>();
  for (const row of collectedRows) {
    const r = row as { month_key: string; total: string };
    collectedMap.set(r.month_key, Number(r.total));
  }

  const expenseRangeEnd = format(endOfMonth(parseISO(`${lastMonth}-01`)), "yyyy-MM-dd");
  const expenseRows = await db
    .select({ date: expenses.date, amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.date, `${firstMonth}-01`), lte(expenses.date, expenseRangeEnd)));
  const expensesMap = new Map<string, number>();
  for (const ex of expenseRows) {
    const key = format(parseISO(String(ex.date)), "yyyy-MM");
    const prev = expensesMap.get(key) ?? 0;
    expensesMap.set(key, prev + Number(ex.amount));
  }

  return monthKeys.map((monthKey) => {
    const [yStr, mStr] = monthKey.split("-");
    const year = parseInt(yStr!, 10);
    const month = parseInt(mStr!, 10);
    const monthLabel = `${ARABIC_MONTHS[month - 1] ?? monthKey} ${year}`;
    return {
      month,
      year,
      monthLabel,
      profits: Math.round((collectedMap.get(monthKey) ?? 0) * 100) / 100,
      expenses: Math.round((expensesMap.get(monthKey) ?? 0) * 100) / 100,
    };
  });
}

/** Top N clients by total paid (all time). */
export async function getTopClientsByRevenue(limit: number): Promise<TopClientRow[]> {
  const rows = await db
    .select({
      clientId: invoices.clientId,
      total: invoices.total,
      clientName: clients.companyName,
      logoUrl: clients.logoUrl,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.status, "paid"));

  const byClient = new Map<string, { clientName: string | null; logoUrl: string | null; total: number; count: number }>();
  for (const r of rows) {
    const id = r.clientId;
    const existing = byClient.get(id);
    const totalNum = Number(r.total);
    if (!existing) {
      byClient.set(id, {
        clientName: r.clientName,
        logoUrl: r.logoUrl,
        total: totalNum,
        count: 1,
      });
    } else {
      existing.total += totalNum;
      existing.count += 1;
    }
  }

  const sorted = Array.from(byClient.entries())
    .map(([clientId, v]) => ({
      clientId,
      clientName: v.clientName,
      logoUrl: v.logoUrl,
      totalPaid: v.total,
      invoiceCount: v.count,
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, limit);

  return sorted;
}

/** Last N invoices by created_at DESC. */
export async function getRecentInvoices(limit: number): Promise<RecentInvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.companyName,
      total: invoices.total,
      status: invoices.status,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    clientName: r.clientName,
    total: String(r.total),
    status: r.status,
    createdAt: r.createdAt!,
  }));
}

/** All pending invoices with client/project and days since issue. */
export async function getOutstandingInvoices(): Promise<OutstandingInvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      clientName: clients.companyName,
      clientLogoUrl: clients.logoUrl,
      projectName: projects.name,
      total: invoices.total,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(eq(invoices.status, "pending"))
    .orderBy(desc(invoices.issueDate));

  const today = new Date();
  return rows.map((r) => {
    const issueDate = String(r.issueDate);
    const issue = parseISO(issueDate);
    const daysSinceIssue = differenceInDays(today, issue);
    return {
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      clientId: r.clientId,
      clientName: r.clientName,
      clientLogoUrl: r.clientLogoUrl,
      projectName: r.projectName,
      total: String(r.total),
      issueDate,
      daysSinceIssue,
    };
  });
}
