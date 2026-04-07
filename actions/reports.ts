"use server";

import { eq, isNull, and, sql, inArray, lt, ne, gte, lte, desc, sum, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projects,
  tasks,
  clients,
  invoices,
  expenses,
  services,
  projectServices,
  clientServices,
  payments,
  recurringExpenses,
  settings,
} from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  parseISO,
  startOfDay,
  endOfDay,
  getYear,
  getMonth,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  addDays,
  addWeeks,
  addYears,
  isBefore,
  isAfter,
  startOfYear,
  endOfYear,
  differenceInDays,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  subYears,
  differenceInCalendarDays,
} from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  PROFIT_LOSS_PERIODS,
  type ProfitLossPeriodKey,
} from "@/lib/reports-constants";

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

export type DateRangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "all";

export type ProfitLossStatementPeriod = {
  label: string;
  startDate: string;
  endDate: string;
};

export type ProfitLossExpensesByCategory = {
  software: number;
  hosting: number;
  marketing: number;
  salaries: number;
  equipment: number;
  office: number;
  other: number;
};

export type ProfitLossStatement = {
  period: ProfitLossStatementPeriod;
  revenue: {
    /** Sum of `invoices.total` with `issue_date` in range. */
    invoiced: number;
    /** Sum of `payments.amount` with `payment_date` in range. */
    collected: number;
    /** Unpaid balance on invoices issued in the period (payments with `payment_date` ≤ period end). */
    outstanding: number;
  };
  expenses: {
    byCategory: ProfitLossExpensesByCategory;
    total: number;
  };
  profit: {
    /** Cash collected in period (same as `revenue.collected`). */
    gross: number;
    /** `collected - expenses.total`. */
    net: number;
    /** `(net / collected) * 100` when collected &gt; 0. */
    margin: number | null;
  };
  comparison: {
    previousPeriod: ProfitLossStatementPeriod;
    previousNet: number;
    previousCollected: number;
    delta: number;
    percentChange: number | null;
    collectedPercentChange: number | null;
    compareLabel: string;
  } | null;
};

export type FinancialSummary = {
  /** Sum of payments with `payment_date` in the current calendar month. */
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalCollectedAllTime: number;
  /** Sum of payments with `payment_date` in the current calendar year. */
  totalCollectedThisYear: number;
  /** Sum of remaining balance across all invoices (total − payments) where &gt; 0. */
  outstandingTotal: number;
  invoicedThisYear: number; // by issue_date
};

export type MonthlyRevenuePoint = {
  monthKey: string;
  monthLabel: string;
  /** Cash collected in the month (sum of `payments` by `payment_date`). */
  profits: number;
  expenses: number;
  /** Total invoiced in the month (sum of `invoices.total` by `created_at`). */
  invoiced: number;
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
  /** Remaining balance (invoice total − sum of payments). */
  amountDue: string;
  issueDate: string;
  daysSinceIssue: number;
};

export type ClientServiceSpendRow = {
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  totalPaid: number;
  invoiceCount: number;
};

export type ServiceProfitabilityRow = {
  serviceId: string;
  serviceName: string;
  totalRevenue: number;
  revenueSharePercent: number;
  clientCount: number;
};

/** Per-project cash collected (payments) vs expenses; revenue split evenly when an invoice links to multiple projects. */
export type ProjectProfitabilityRow = {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  status: string;
  budget: string | null;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  /** Null when revenue is 0; otherwise profit / revenue × 100. */
  profitMargin: number | null;
  /** Revenue minus budget when budget is set; null otherwise. */
  budgetVariance: number | null;
  invoiceCount: number;
  expenseCount: number;
};

/** Per-client: revenue = payments on their invoices; expenses = direct `client_id` or project-linked (no double count per client). */
export type ClientProfitabilityRow = {
  clientId: string;
  companyName: string | null;
  logoUrl: string | null;
  status: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  /** (profit / revenue) × 100; 0 when revenue is 0. */
  profitMargin: number;
  projectCount: number;
  invoiceCount: number;
  expenseCount: number;
};

export type ClientProfitabilitySummary = {
  clientCount: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
};

/** Optional `yyyy-MM-dd` bounds; omit both for all-time (legacy collected rules for projects). */
export type ProfitabilityDateRange = {
  dateFrom?: string;
  dateTo?: string;
};

/** Service-level profitability: project revenue/expense in range split evenly across services on each project. */
export type ServiceProfitabilityAnalyticsRow = {
  serviceId: string;
  serviceName: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  projectCount: number;
};

function sqlPaymentDateFilterPayments(dateFrom?: string, dateTo?: string): SQL {
  if (!dateFrom && !dateTo) return sql``;
  const parts: SQL[] = [];
  if (dateFrom) parts.push(sql`payment_date >= ${dateFrom}::date`);
  if (dateTo) parts.push(sql`payment_date <= ${dateTo}::date`);
  return sql` AND ${sql.join(parts, sql` AND `)}`;
}

function sqlExpenseDateFilterAliasE(dateFrom?: string, dateTo?: string): SQL {
  if (!dateFrom && !dateTo) return sql``;
  const parts: SQL[] = [];
  if (dateFrom) parts.push(sql`e.date >= ${dateFrom}::date`);
  if (dateTo) parts.push(sql`e.date <= ${dateTo}::date`);
  return sql` AND ${sql.join(parts, sql` AND `)}`;
}

/** KPI summary: collected metrics use `payments.payment_date`; invoiced-this-year uses `issue_date`. */
export async function getFinancialSummary(): Promise<FinancialSummary> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const thisYearStart = startOfYear(now);
  const currentYear = getYear(now);

  const allPayments = await db
    .select({ amount: payments.amount, paymentDate: payments.paymentDate })
    .from(payments);

  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let totalCollectedAllTime = 0;
  let totalCollectedThisYear = 0;

  for (const p of allPayments) {
    const amt = Number(p.amount);
    const pd = String(p.paymentDate);
    totalCollectedAllTime += amt;
    const pdDate = parseISO(pd.length === 10 ? `${pd}T12:00:00` : pd);
    if (getYear(pdDate) === currentYear) {
      totalCollectedThisYear += amt;
    }
    if (!isBefore(pdDate, thisMonthStart) && !isAfter(pdDate, thisMonthEnd)) {
      revenueThisMonth += amt;
    }
    if (!isBefore(pdDate, lastMonthStart) && !isAfter(pdDate, lastMonthEnd)) {
      revenueLastMonth += amt;
    }
  }

  const invoiceTotals = await db
    .select({ id: invoices.id, total: invoices.total, issueDate: invoices.issueDate })
    .from(invoices);

  const paidByInvoice = await db
    .select({
      invoiceId: payments.invoiceId,
      paid: sum(payments.amount),
    })
    .from(payments)
    .groupBy(payments.invoiceId);

  const paidMap = new Map(paidByInvoice.map((r) => [r.invoiceId, Number(r.paid ?? 0)]));

  let outstandingTotal = 0;
  let invoicedThisYear = 0;

  for (const inv of invoiceTotals) {
    const totalNum = Number(inv.total);
    const paid = paidMap.get(inv.id) ?? 0;
    const due = totalNum - paid;
    if (due > 0.0001) {
      outstandingTotal += due;
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

const PL_ALL_TIME_START = "1970-01-01";

const PL_COMPARE_LABELS: Record<Exclude<ProfitLossPeriodKey, "all_time">, string> = {
  this_month: "same period last month",
  last_month: "prior month",
  this_quarter: "same period last quarter",
  this_year: "same period last year",
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type PlWindow = { startStr: string; endStr: string; label: string };

/** Current window (month/quarter/year-to-date where applicable) and an aligned prior window for comparison. */
function resolveProfitLossWindow(period: ProfitLossPeriodKey, now: Date): {
  current: PlWindow;
  prev: PlWindow | null;
  compareLabel: string;
} {
  const today = startOfDay(now);
  const todayStr = format(today, "yyyy-MM-dd");

  switch (period) {
    case "this_month": {
      const start = startOfMonth(today);
      const daySpan = differenceInCalendarDays(today, start);
      const prevMonthStart = startOfMonth(subMonths(start, 1));
      const prevMonthEndCap = endOfMonth(prevMonthStart);
      const compareEnd = addDays(prevMonthStart, daySpan);
      const prevEnd = compareEnd > prevMonthEndCap ? prevMonthEndCap : compareEnd;
      return {
        current: {
          startStr: format(start, "yyyy-MM-dd"),
          endStr: todayStr,
          label: format(today, "MMMM yyyy", { locale: enUS }),
        },
        prev: {
          startStr: format(prevMonthStart, "yyyy-MM-dd"),
          endStr: format(prevEnd, "yyyy-MM-dd"),
          label: format(prevMonthStart, "MMMM yyyy", { locale: enUS }),
        },
        compareLabel: PL_COMPARE_LABELS.this_month,
      };
    }
    case "last_month": {
      const start = startOfMonth(subMonths(today, 1));
      const end = endOfMonth(subMonths(today, 1));
      const prevStart = startOfMonth(subMonths(today, 2));
      const prevEnd = endOfMonth(subMonths(today, 2));
      return {
        current: {
          startStr: format(start, "yyyy-MM-dd"),
          endStr: format(end, "yyyy-MM-dd"),
          label: format(start, "MMMM yyyy", { locale: enUS }),
        },
        prev: {
          startStr: format(prevStart, "yyyy-MM-dd"),
          endStr: format(prevEnd, "yyyy-MM-dd"),
          label: format(prevStart, "MMMM yyyy", { locale: enUS }),
        },
        compareLabel: PL_COMPARE_LABELS.last_month,
      };
    }
    case "this_quarter": {
      const qStart = startOfQuarter(today);
      const daySpan = differenceInCalendarDays(today, qStart);
      const prevQStart = startOfQuarter(subQuarters(today, 1));
      const prevQEndCap = endOfQuarter(subQuarters(today, 1));
      const compareEnd = addDays(prevQStart, daySpan);
      const prevEnd = compareEnd > prevQEndCap ? prevQEndCap : compareEnd;
      const q = Math.floor(today.getMonth() / 3) + 1;
      const pq = Math.floor(prevQStart.getMonth() / 3) + 1;
      return {
        current: {
          startStr: format(qStart, "yyyy-MM-dd"),
          endStr: todayStr,
          label: `Q${q} ${getYear(today)}`,
        },
        prev: {
          startStr: format(prevQStart, "yyyy-MM-dd"),
          endStr: format(prevEnd, "yyyy-MM-dd"),
          label: `Q${pq} ${getYear(prevQStart)}`,
        },
        compareLabel: PL_COMPARE_LABELS.this_quarter,
      };
    }
    case "this_year": {
      const yStart = startOfYear(today);
      const daySpan = differenceInCalendarDays(today, yStart);
      const prevYStart = startOfYear(subYears(today, 1));
      const prevYEndCap = endOfYear(subYears(today, 1));
      const compareEnd = addDays(prevYStart, daySpan);
      const prevEnd = compareEnd > prevYEndCap ? prevYEndCap : compareEnd;
      return {
        current: {
          startStr: format(yStart, "yyyy-MM-dd"),
          endStr: todayStr,
          label: String(getYear(today)),
        },
        prev: {
          startStr: format(prevYStart, "yyyy-MM-dd"),
          endStr: format(prevEnd, "yyyy-MM-dd"),
          label: String(getYear(prevYStart)),
        },
        compareLabel: PL_COMPARE_LABELS.this_year,
      };
    }
    case "all_time":
      return {
        current: {
          startStr: PL_ALL_TIME_START,
          endStr: todayStr,
          label: "All time",
        },
        prev: null,
        compareLabel: "",
      };
    default: {
      const _exhaustive: never = period;
      return _exhaustive;
    }
  }
}

async function aggregateProfitLossForRange(startStr: string, endStr: string): Promise<{
  invoiced: number;
  collected: number;
  outstanding: number;
  byCategory: ProfitLossExpensesByCategory;
  expenseTotal: number;
  gross: number;
  net: number;
  margin: number | null;
}> {
  const [invRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)::text`,
    })
    .from(invoices)
    .where(and(gte(invoices.issueDate, startStr), lte(invoices.issueDate, endStr)));

  const [payRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)::text`,
    })
    .from(payments)
    .where(and(gte(payments.paymentDate, startStr), lte(payments.paymentDate, endStr)));

  const categoryRows = await db
    .select({
      category: expenses.category,
      total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)::text`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, startStr), lte(expenses.date, endStr)))
    .groupBy(expenses.category);

  const byCategory: ProfitLossExpensesByCategory = {
    software: 0,
    hosting: 0,
    marketing: 0,
    salaries: 0,
    equipment: 0,
    office: 0,
    other: 0,
  };

  for (const row of categoryRows) {
    const key = row.category as keyof ProfitLossExpensesByCategory;
    if (key in byCategory) {
      byCategory[key] = roundMoney(Number(row.total));
    }
  }

  const expenseTotal = roundMoney(
    Object.values(byCategory).reduce((sum, v) => sum + v, 0)
  );

  const invoiced = roundMoney(Number(invRow?.total ?? 0));
  const collected = roundMoney(Number(payRow?.total ?? 0));

  const periodInvoices = await db
    .select({ id: invoices.id, total: invoices.total })
    .from(invoices)
    .where(and(gte(invoices.issueDate, startStr), lte(invoices.issueDate, endStr)));

  let outstanding = 0;
  const invoiceIds = periodInvoices.map((i) => i.id);
  if (invoiceIds.length > 0) {
    const paidRows = await db
      .select({
        invoiceId: payments.invoiceId,
        paid: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)::text`,
      })
      .from(payments)
      .where(and(inArray(payments.invoiceId, invoiceIds), lte(payments.paymentDate, endStr)))
      .groupBy(payments.invoiceId);

    const paidMap = new Map<string, number>();
    for (const r of paidRows) {
      paidMap.set(r.invoiceId, Number(r.paid));
    }
    for (const inv of periodInvoices) {
      const totalNum = Number(inv.total);
      const paid = paidMap.get(inv.id) ?? 0;
      outstanding += Math.max(0, roundMoney(totalNum - paid));
    }
    outstanding = roundMoney(outstanding);
  }

  const gross = collected;
  const net = roundMoney(collected - expenseTotal);
  const margin =
    collected > 0.0001 ? Math.round((net / collected) * 10000) / 100 : null;

  return {
    invoiced,
    collected,
    outstanding,
    byCategory,
    expenseTotal,
    gross,
    net,
    margin,
  };
}

/**
 * Profit &amp; Loss: invoiced by `issue_date`, collected by `payment_date`, expenses by `date`.
 * This month / quarter / year run through today; comparison uses an aligned prior window (omitted for `all_time`).
 */
export async function getProfitLossStatement(
  period: string
): Promise<
  | { ok: true; data: ProfitLossStatement }
  | { ok: false; error: ReturnType<typeof getDbErrorKey> | "invalid_period" }
> {
  if (!PROFIT_LOSS_PERIODS.includes(period as ProfitLossPeriodKey)) {
    return { ok: false, error: "invalid_period" };
  }

  const key = period as ProfitLossPeriodKey;

  try {
    const now = new Date();
    const resolved = resolveProfitLossWindow(key, now);
    const current = await aggregateProfitLossForRange(
      resolved.current.startStr,
      resolved.current.endStr
    );

    let comparison: ProfitLossStatement["comparison"] = null;
    if (resolved.prev) {
      const prev = await aggregateProfitLossForRange(resolved.prev.startStr, resolved.prev.endStr);
      const delta = roundMoney(current.net - prev.net);
      let percentChange: number | null = null;
      if (Math.abs(prev.net) > 0.0001) {
        percentChange = Math.round((delta / prev.net) * 10000) / 100;
      } else if (Math.abs(delta) < 0.0001) {
        percentChange = 0;
      } else if (Math.abs(current.net) > 0.0001) {
        percentChange = null;
      }

      const collDelta = roundMoney(current.collected - prev.collected);
      let collectedPercentChange: number | null = null;
      if (Math.abs(prev.collected) > 0.0001) {
        collectedPercentChange = Math.round((collDelta / prev.collected) * 10000) / 100;
      } else if (Math.abs(collDelta) < 0.0001) {
        collectedPercentChange = 0;
      } else if (Math.abs(current.collected) > 0.0001) {
        collectedPercentChange = null;
      }

      comparison = {
        previousPeriod: {
          label: resolved.prev.label,
          startDate: resolved.prev.startStr,
          endDate: resolved.prev.endStr,
        },
        previousNet: prev.net,
        previousCollected: prev.collected,
        delta,
        percentChange,
        collectedPercentChange,
        compareLabel: resolved.compareLabel,
      };
    }

    const data: ProfitLossStatement = {
      period: {
        label: resolved.current.label,
        startDate: resolved.current.startStr,
        endDate: resolved.current.endStr,
      },
      revenue: {
        invoiced: current.invoiced,
        collected: current.collected,
        outstanding: current.outstanding,
      },
      expenses: {
        byCategory: current.byCategory,
        total: current.expenseTotal,
      },
      profit: {
        gross: current.gross,
        net: current.net,
        margin: current.margin,
      },
      comparison,
    };

    return { ok: true, data };
  } catch (e) {
    console.error("getProfitLossStatement", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: getDbErrorKey(e) };
  }
}

/** Last 12 months with English month labels. Collected = sum of `payments` by `payment_date`; invoiced = sum of `invoices.total` by `created_at`. */
export async function getMonthlyRevenue(dateRange: DateRangeKey): Promise<MonthlyRevenuePoint[]> {
  const now = new Date();

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
  const rangeEndExclusive = startOfMonth(addMonths(parseISO(`${lastMonth}-01`), 1));
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndExclusiveStr = format(rangeEndExclusive, "yyyy-MM-dd");

  const collectedRaw = await db.execute(sql`
    SELECT to_char(${payments.paymentDate}, 'YYYY-MM') AS month_key,
           sum(${payments.amount})::numeric AS total
    FROM ${payments}
    WHERE ${payments.paymentDate} >= ${rangeStartStr}::date
      AND ${payments.paymentDate} < ${rangeEndExclusiveStr}::date
    GROUP BY to_char(${payments.paymentDate}, 'YYYY-MM')
  `);
  const collectedRows = Array.isArray(collectedRaw)
    ? collectedRaw
    : (collectedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
  const collectedMap = new Map<string, number>();
  for (const row of collectedRows) {
    const r = row as { month_key: string; total: string };
    collectedMap.set(r.month_key, Number(r.total));
  }

  const invoicedRaw = await db.execute(sql`
    SELECT to_char(${invoices.createdAt}, 'YYYY-MM') AS month_key,
           sum(${invoices.total})::numeric AS total
    FROM ${invoices}
    WHERE ${invoices.createdAt} >= ${rangeStart}
      AND ${invoices.createdAt} < ${rangeEndExclusive}
    GROUP BY to_char(${invoices.createdAt}, 'YYYY-MM')
  `);
  const invoicedRows = Array.isArray(invoicedRaw)
    ? invoicedRaw
    : (invoicedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
  const invoicedMap = new Map<string, number>();
  for (const row of invoicedRows) {
    const r = row as { month_key: string; total: string };
    invoicedMap.set(r.month_key, Number(r.total));
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
    const monthLabel = format(parseISO(`${monthKey}-01`), "MMMM", { locale: enUS });
    return {
      monthKey,
      monthLabel,
      profits: Math.round((collectedMap.get(monthKey) ?? 0) * 100) / 100,
      expenses: Math.round((expensesMap.get(monthKey) ?? 0) * 100) / 100,
      invoiced: Math.round((invoicedMap.get(monthKey) ?? 0) * 100) / 100,
    };
  });
}

/** Last six calendar months: collected payments, expenses, and profit per month (English short month labels). */
export type MonthlyComparisonPoint = {
  monthKey: string;
  /** Short English month name (Jan, Feb, …). */
  month: string;
  year: number;
  /** Sum of `payments.amount` with `payment_date` in this calendar month. */
  revenue: number;
  /** Sum of `expenses.amount` with `date` in this calendar month. */
  expenses: number;
  /** `revenue - expenses`. */
  profit: number;
};

export async function getMonthlyComparison(): Promise<MonthlyComparisonPoint[]> {
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(format(subMonths(now, i), "yyyy-MM"));
  }

  const firstMonth = monthKeys[0]!;
  const lastMonth = monthKeys[monthKeys.length - 1]!;
  const rangeStart = parseISO(`${firstMonth}-01`);
  const rangeEndExclusive = startOfMonth(addMonths(parseISO(`${lastMonth}-01`), 1));
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndExclusiveStr = format(rangeEndExclusive, "yyyy-MM-dd");

  const collectedRaw = await db.execute(sql`
    SELECT to_char(${payments.paymentDate}, 'YYYY-MM') AS month_key,
           sum(${payments.amount})::numeric AS total
    FROM ${payments}
    WHERE ${payments.paymentDate} >= ${rangeStartStr}::date
      AND ${payments.paymentDate} < ${rangeEndExclusiveStr}::date
    GROUP BY to_char(${payments.paymentDate}, 'YYYY-MM')
  `);
  const collectedRows = Array.isArray(collectedRaw)
    ? collectedRaw
    : (collectedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
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
    const d = parseISO(`${monthKey}-01`);
    const revenue = Math.round((collectedMap.get(monthKey) ?? 0) * 100) / 100;
    const expensesAmt = Math.round((expensesMap.get(monthKey) ?? 0) * 100) / 100;
    const profit = Math.round((revenue - expensesAmt) * 100) / 100;
    return {
      monthKey,
      month: format(d, "MMM", { locale: enUS }),
      year: getYear(d),
      revenue,
      expenses: expensesAmt,
      profit,
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

/**
 * Default date range for the revenue area chart: earliest payment or expense month through today.
 * Falls back to start of current year when there is no data.
 */
export async function getMonthlyAreaDefaultBounds(): Promise<{
  start: string;
  end: string;
}> {
  const end = format(endOfDay(new Date()), "yyyy-MM-dd");

  const [pRow] = await db
    .select({ min: sql<string | null>`min(${payments.paymentDate})` })
    .from(payments);
  const [eRow] = await db
    .select({ min: sql<string | null>`min(${expenses.date})` })
    .from(expenses);

  let earliest: Date | null = null;
  for (const raw of [pRow?.min, eRow?.min]) {
    if (raw == null) continue;
    const d = parseISO(String(raw));
    if (Number.isNaN(d.getTime())) continue;
    if (!earliest || d < earliest) earliest = d;
  }

  const start = earliest
    ? format(startOfMonth(earliest), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");

  return { start, end };
}

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
  const rangeStartStrArea = format(rangeStartSql, "yyyy-MM-dd");
  const rangeEndExclusiveStrArea = format(rangeEndSql, "yyyy-MM-dd");

  const collectedRaw = await db.execute(sql`
    SELECT to_char(${payments.paymentDate}, 'YYYY-MM') AS month_key,
           sum(${payments.amount})::numeric AS total
    FROM ${payments}
    WHERE ${payments.paymentDate} >= ${rangeStartStrArea}::date
      AND ${payments.paymentDate} < ${rangeEndExclusiveStrArea}::date
    GROUP BY to_char(${payments.paymentDate}, 'YYYY-MM')
  `);
  const collectedRows = Array.isArray(collectedRaw)
    ? collectedRaw
    : (collectedRaw as unknown as { rows?: { month_key: string; total: string }[] }).rows ?? [];
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
    const monthLabel = format(parseISO(`${monthKey}-01`), "MMMM yyyy", { locale: enUS });
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

/** Invoices with remaining balance (total − payments &gt; 0), with client/project and days since issue. */
export async function getOutstandingInvoices(): Promise<OutstandingInvoiceRow[]> {
  const paidSums = await db
    .select({
      invoiceId: payments.invoiceId,
      paid: sum(payments.amount),
    })
    .from(payments)
    .groupBy(payments.invoiceId);

  const paidMap = new Map(paidSums.map((r) => [r.invoiceId, Number(r.paid ?? 0)]));

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
    .orderBy(desc(invoices.issueDate));

  const today = new Date();
  const result: OutstandingInvoiceRow[] = [];
  for (const r of rows) {
    const totalNum = Number(r.total);
    const paid = paidMap.get(r.id) ?? 0;
    const amountDue = Math.round((totalNum - paid) * 100) / 100;
    if (amountDue <= 0.0001) continue;

    const issueDate = String(r.issueDate);
    const issue = parseISO(issueDate);
    const daysSinceIssue = differenceInDays(today, issue);
    result.push({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      clientId: r.clientId,
      clientName: r.clientName,
      clientLogoUrl: r.clientLogoUrl,
      projectName: r.projectName,
      total: String(r.total),
      amountDue: amountDue.toFixed(2),
      issueDate,
      daysSinceIssue,
    });
  }
  return result;
}

export async function getClientSpendByService(): Promise<ClientServiceSpendRow[]> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.companyName,
      serviceId: services.id,
      serviceName: services.name,
      invoiceTotal: invoices.total,
      invoiceId: invoices.id,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(projectServices, eq(projectServices.projectId, projects.id))
    .innerJoin(services, eq(projectServices.serviceId, services.id))
    .leftJoin(
      clientServices,
      and(eq(clientServices.clientId, clients.id), eq(clientServices.serviceId, services.id))
    )
    .where(eq(invoices.status, "paid"));

  const map = new Map<string, ClientServiceSpendRow>();
  for (const row of rows) {
    const key = `${row.clientId}:${row.serviceId}`;
    const existing = map.get(key);
    const total = Number(row.invoiceTotal);
    if (!existing) {
      map.set(key, {
        clientId: row.clientId,
        clientName: row.clientName ?? "—",
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        totalPaid: total,
        invoiceCount: 1,
      });
    } else {
      existing.totalPaid += total;
      existing.invoiceCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
}

export async function getServicesProfitability(): Promise<ServiceProfitabilityRow[]> {
  const rows = await db
    .select({
      serviceId: services.id,
      serviceName: services.name,
      clientId: invoices.clientId,
      invoiceTotal: invoices.total,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(projectServices, eq(projectServices.projectId, projects.id))
    .innerJoin(services, eq(projectServices.serviceId, services.id))
    .where(eq(invoices.status, "paid"));

  const revenueByService = new Map<string, { serviceName: string; totalRevenue: number; clients: Set<string> }>();
  for (const row of rows) {
    const existing = revenueByService.get(row.serviceId);
    const revenue = Number(row.invoiceTotal);
    if (!existing) {
      revenueByService.set(row.serviceId, {
        serviceName: row.serviceName,
        totalRevenue: revenue,
        clients: new Set([row.clientId]),
      });
    } else {
      existing.totalRevenue += revenue;
      existing.clients.add(row.clientId);
    }
  }

  const totalRevenue = Array.from(revenueByService.values()).reduce((sum, r) => sum + r.totalRevenue, 0);
  return Array.from(revenueByService.entries())
    .map(([serviceId, row]) => ({
      serviceId,
      serviceName: row.serviceName,
      totalRevenue: row.totalRevenue,
      revenueSharePercent: totalRevenue > 0 ? Math.round((row.totalRevenue / totalRevenue) * 10000) / 100 : 0,
      clientCount: row.clients.size,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Revenue = sum of payments on that client's invoices.
 * Expenses = direct `expenses.client_id` OR `expenses.project_id` → non-deleted project for that client (each expense once per client).
 */
export async function getClientProfitability(
  range?: ProfitabilityDateRange
): Promise<
  { ok: true; data: ClientProfitabilityRow[] } | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const dateFrom = range?.dateFrom;
    const dateTo = range?.dateTo;

    const clientRows = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        logoUrl: clients.logoUrl,
        status: clients.status,
      })
      .from(clients)
      .where(isNull(clients.deletedAt));

    const payConds: SQL[] = [];
    if (dateFrom) payConds.push(gte(payments.paymentDate, dateFrom));
    if (dateTo) payConds.push(lte(payments.paymentDate, dateTo));

    let revenueQ = db
      .select({
        clientId: invoices.clientId,
        totalRevenue: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id));
    if (payConds.length) {
      revenueQ = revenueQ.where(and(...payConds)) as typeof revenueQ;
    }
    const revenueRows = await revenueQ.groupBy(invoices.clientId);

    const revenueMap = new Map<string, number>();
    for (const r of revenueRows) {
      revenueMap.set(r.clientId, Number(r.totalRevenue));
    }

    const expenseDateSql =
      dateFrom || dateTo
        ? sql` AND ${dateFrom ? sql`${expenses.date} >= ${dateFrom}::date` : sql`TRUE`} AND ${dateTo ? sql`${expenses.date} <= ${dateTo}::date` : sql`TRUE`}`
        : sql``;

    const expenseRaw = await db.execute(sql`
      SELECT ${clients.id}::text AS client_id,
        COALESCE(SUM(${expenses.amount}::numeric), 0)::text AS total_expenses,
        COUNT(DISTINCT ${expenses.id})::int AS expense_count
      FROM ${clients}
      LEFT JOIN ${expenses} ON (
        (
          ${expenses.clientId} = ${clients.id}
          OR EXISTS (
            SELECT 1 FROM ${projects}
            WHERE ${projects.id} = ${expenses.projectId}
              AND ${projects.clientId} = ${clients.id}
              AND ${projects.deletedAt} IS NULL
          )
        )
        ${expenseDateSql}
      )
      WHERE ${clients.deletedAt} IS NULL
      GROUP BY ${clients.id}
    `);

    const expenseRowsParsed = Array.isArray(expenseRaw)
      ? expenseRaw
      : (expenseRaw as unknown as { rows?: { client_id: string; total_expenses: string; expense_count: number }[] })
          .rows ?? [];

    const expenseTotalMap = new Map<string, number>();
    const expenseCountMap = new Map<string, number>();
    for (const row of expenseRowsParsed) {
      const r = row as { client_id: string; total_expenses: string; expense_count: number };
      expenseTotalMap.set(r.client_id, Number(r.total_expenses));
      expenseCountMap.set(r.client_id, Number(r.expense_count ?? 0));
    }

    const projectCountRows = await db
      .select({
        clientId: projects.clientId,
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .groupBy(projects.clientId);

    const projectCountMap = new Map<string, number>();
    for (const r of projectCountRows) {
      projectCountMap.set(r.clientId, r.count);
    }

    const invoiceCountRows = await db
      .select({
        clientId: invoices.clientId,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .groupBy(invoices.clientId);

    const invoiceCountMap = new Map<string, number>();
    for (const r of invoiceCountRows) {
      invoiceCountMap.set(r.clientId, r.count);
    }

    const data: ClientProfitabilityRow[] = clientRows.map((c) => {
      const totalRevenue = Math.round((revenueMap.get(c.id) ?? 0) * 100) / 100;
      const totalExpenses = Math.round((expenseTotalMap.get(c.id) ?? 0) * 100) / 100;
      const profit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
      const profitMargin =
        totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

      return {
        clientId: c.id,
        companyName: c.companyName,
        logoUrl: c.logoUrl,
        status: c.status,
        totalRevenue,
        totalExpenses,
        profit,
        profitMargin,
        projectCount: projectCountMap.get(c.id) ?? 0,
        invoiceCount: invoiceCountMap.get(c.id) ?? 0,
        expenseCount: expenseCountMap.get(c.id) ?? 0,
      };
    });

    data.sort((a, b) => b.profit - a.profit);

    return { ok: true as const, data };
  } catch (e) {
    console.error("getClientProfitability", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export type CashFlowCurrentPosition = {
  collected: number;
  expenses: number;
  net: number;
};

export type CashFlowForecastMonth = {
  month: number;
  year: number;
  monthLabel: string;
  expectedIncome: number;
  expectedExpenses: number;
  projectedNet: number;
  runningBalance: number;
};

export type CashFlowForecastTotals = {
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
};

export type CashFlowForecastData = {
  currentPosition: CashFlowCurrentPosition;
  forecast: CashFlowForecastMonth[];
  totals: CashFlowForecastTotals;
};

function parseDateDayForCashFlow(s: string): Date {
  const str = String(s);
  return startOfDay(parseISO(str.length === 10 ? `${str}T12:00:00` : str));
}

function effectiveInvoiceDueDateForForecast(
  issueDateStr: string,
  dueDateStr: string | null | undefined,
  defaultPaymentTermsDays: number
): Date {
  if (dueDateStr) {
    return parseDateDayForCashFlow(String(dueDateStr));
  }
  const issue = parseDateDayForCashFlow(issueDateStr);
  return startOfDay(addDays(issue, defaultPaymentTermsDays));
}

function advanceRecurringDueDate(d: Date, frequency: string): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(d, 1);
    case "monthly":
      return addMonths(d, 1);
    case "quarterly":
      return addMonths(d, 3);
    case "yearly":
      return addYears(d, 1);
    default:
      return addMonths(d, 1);
  }
}

/**
 * Current cash position (all payments collected minus all recorded expenses) and a 3-month outlook:
 * expected income from outstanding invoice balances by effective due date, expected expenses from recurring schedules
 * plus average monthly non-recurring spend from the six completed months before the current month.
 */
export async function getCashFlowForecast(): Promise<
  { ok: true; data: CashFlowForecastData } | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const now = new Date();
    const m0 = startOfMonth(now);
    const monthStarts = [m0, startOfMonth(addMonths(now, 1)), startOfMonth(addMonths(now, 2))] as const;
    const horizonEnd = endOfMonth(monthStarts[2]);
    const m0Key = format(monthStarts[0], "yyyy-MM");
    const m2Key = format(monthStarts[2], "yyyy-MM");

    const [settingsRow] = await db
      .select({ defaultPaymentTerms: settings.defaultPaymentTerms })
      .from(settings)
      .where(eq(settings.id, 1));
    const defaultTerms = settingsRow?.defaultPaymentTerms ?? 30;

    const [paymentsTotalRow] = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)` })
      .from(payments);

    const [expensesTotalRow] = await db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)` })
      .from(expenses);

    const collected = roundMoney(Number(paymentsTotalRow?.total ?? 0));
    const expensesToDate = roundMoney(Number(expensesTotalRow?.total ?? 0));
    const currentNet = roundMoney(collected - expensesToDate);

    const histStartStr = format(startOfMonth(subMonths(now, 6)), "yyyy-MM-dd");
    const histEndExclusiveStr = format(startOfMonth(now), "yyyy-MM-dd");

    const [histNonRecurringRow] = await db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}::numeric), 0)` })
      .from(expenses)
      .where(and(gte(expenses.date, histStartStr), lt(expenses.date, histEndExclusiveStr)));

    const avgMonthlyNonRecurring = roundMoney(Number(histNonRecurringRow?.total ?? 0) / 6);

    const paidSums = await db
      .select({
        invoiceId: payments.invoiceId,
        paid: sum(payments.amount),
      })
      .from(payments)
      .groupBy(payments.invoiceId);

    const paidMap = new Map(paidSums.map((r) => [r.invoiceId, Number(r.paid ?? 0)]));

    const invoiceRows = await db
      .select({
        id: invoices.id,
        total: invoices.total,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
      })
      .from(invoices);

    const incomeByMonth = [0, 0, 0] as [number, number, number];

    for (const inv of invoiceRows) {
      const totalNum = Number(inv.total);
      const paid = paidMap.get(inv.id) ?? 0;
      const amountDue = roundMoney(totalNum - paid);
      if (amountDue <= 0.0001) continue;

      const eff = effectiveInvoiceDueDateForForecast(String(inv.issueDate), inv.dueDate, defaultTerms);
      const dKey = format(eff, "yyyy-MM");

      if (dKey < m0Key) {
        incomeByMonth[0] += amountDue;
        continue;
      }
      if (dKey > m2Key) continue;

      const idx = monthStarts.findIndex((ms) => format(ms, "yyyy-MM") === dKey);
      if (idx >= 0) {
        incomeByMonth[idx] += amountDue;
      }
    }

    const recurringRows = await db
      .select({
        amount: recurringExpenses.amount,
        frequency: recurringExpenses.frequency,
        nextDueDate: recurringExpenses.nextDueDate,
      })
      .from(recurringExpenses)
      .where(eq(recurringExpenses.isActive, true));

    const recurringByMonth = [0, 0, 0] as [number, number, number];

    for (const rec of recurringRows) {
      const amt = roundMoney(Number(rec.amount));
      let d = parseDateDayForCashFlow(String(rec.nextDueDate));

      let safety = 0;
      while (safety < 520 && isBefore(d, monthStarts[0])) {
        d = advanceRecurringDueDate(d, rec.frequency);
        safety += 1;
      }

      safety = 0;
      while (safety < 520 && !isAfter(d, horizonEnd)) {
        const dKeyR = format(d, "yyyy-MM");
        if (dKeyR >= m0Key && dKeyR <= m2Key) {
          const idx = monthStarts.findIndex((ms) => format(ms, "yyyy-MM") === dKeyR);
          if (idx >= 0) {
            recurringByMonth[idx] += amt;
          }
        }
        d = advanceRecurringDueDate(d, rec.frequency);
        safety += 1;
      }
    }

    for (let i = 0; i < 3; i++) {
      incomeByMonth[i] = roundMoney(incomeByMonth[i]!);
      recurringByMonth[i] = roundMoney(recurringByMonth[i]!);
    }

    const forecast: CashFlowForecastMonth[] = [];
    let running = currentNet;
    let totalExpectedIncome = 0;
    let totalExpectedExpenses = 0;

    for (let i = 0; i < 3; i++) {
      const ms = monthStarts[i]!;
      const expectedIncome = incomeByMonth[i]!;
      const expectedExpenses = roundMoney(recurringByMonth[i]! + avgMonthlyNonRecurring);
      const projectedNet = roundMoney(expectedIncome - expectedExpenses);
      running = roundMoney(running + projectedNet);
      totalExpectedIncome += expectedIncome;
      totalExpectedExpenses += expectedExpenses;

      forecast.push({
        month: getMonth(ms) + 1,
        year: getYear(ms),
        monthLabel: format(ms, "MMMM yyyy", { locale: enUS }),
        expectedIncome,
        expectedExpenses,
        projectedNet,
        runningBalance: running,
      });
    }

    const data: CashFlowForecastData = {
      currentPosition: {
        collected,
        expenses: expensesToDate,
        net: currentNet,
      },
      forecast,
      totals: {
        totalExpectedIncome: roundMoney(totalExpectedIncome),
        totalExpectedExpenses: roundMoney(totalExpectedExpenses),
      },
    };

    return { ok: true as const, data };
  } catch (e) {
    console.error("getCashFlowForecast", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

/**
 * Profitability per project: revenue = sum of payments on invoices linked via `invoices.project_id` or `invoice_projects`,
 * allocated evenly per linked project when an invoice ties to multiple projects. Expenses = sum of `expenses` for that project.
 * With `dateFrom` / `dateTo`, revenue uses only payments in that range; expenses use `expenses.date` in range.
 */
export async function getProjectProfitability(
  range?: ProfitabilityDateRange
): Promise<
  { ok: true; data: ProjectProfitabilityRow[] } | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const dateFrom = range?.dateFrom;
    const dateTo = range?.dateTo;
    const useRange = Boolean(dateFrom || dateTo);
    const payF = sqlPaymentDateFilterPayments(dateFrom, dateTo);
    const expF = sqlExpenseDateFilterAliasE(dateFrom, dateTo);

    const raw = useRange
      ? await db.execute(sql`
      WITH invoice_project_links AS (
        SELECT ip.invoice_id, ip.project_id
        FROM invoice_projects ip
        UNION ALL
        SELECT i.id AS invoice_id, i.project_id
        FROM invoices i
        WHERE i.project_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM invoice_projects ip2 WHERE ip2.invoice_id = i.id)
      ),
      filtered_payments AS (
        SELECT invoice_id, SUM(amount)::numeric AS paid_in_range
        FROM payments
        WHERE 1 = 1
          ${payF}
        GROUP BY invoice_id
      ),
      invoice_collected AS (
        SELECT
          i.id AS invoice_id,
          COALESCE(fp.paid_in_range, 0)::numeric AS collected
        FROM invoices i
        LEFT JOIN filtered_payments fp ON fp.invoice_id = i.id
      ),
      link_counts AS (
        SELECT invoice_id, COUNT(*)::numeric AS cnt
        FROM invoice_project_links
        GROUP BY invoice_id
      ),
      project_revenue AS (
        SELECT
          pl.project_id,
          SUM(ic.collected / NULLIF(lc.cnt, 0))::numeric AS total_revenue,
          COUNT(DISTINCT pl.invoice_id)::int AS invoice_count
        FROM invoice_project_links pl
        INNER JOIN invoice_collected ic ON ic.invoice_id = pl.invoice_id
        INNER JOIN link_counts lc ON lc.invoice_id = pl.invoice_id
        WHERE ic.collected > 0
        GROUP BY pl.project_id
      ),
      project_expenses AS (
        SELECT
          e.project_id,
          COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
          COUNT(*)::int AS expense_count
        FROM expenses e
        WHERE e.project_id IS NOT NULL
          ${expF}
        GROUP BY e.project_id
      )
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.client_id AS client_id,
        c.company_name AS client_name,
        c.logo_url AS client_logo_url,
        p.status AS status,
        p.budget AS budget,
        COALESCE(pr.total_revenue, 0)::numeric AS total_revenue,
        COALESCE(pe.total_expenses, 0)::numeric AS total_expenses,
        COALESCE(pr.invoice_count, 0)::int AS invoice_count,
        COALESCE(pe.expense_count, 0)::int AS expense_count
      FROM projects p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_revenue pr ON pr.project_id = p.id
      LEFT JOIN project_expenses pe ON pe.project_id = p.id
      WHERE p.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY (COALESCE(pr.total_revenue, 0) - COALESCE(pe.total_expenses, 0)) DESC
    `)
      : await db.execute(sql`
      WITH invoice_project_links AS (
        SELECT ip.invoice_id, ip.project_id
        FROM invoice_projects ip
        UNION ALL
        SELECT i.id AS invoice_id, i.project_id
        FROM invoices i
        WHERE i.project_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM invoice_projects ip2 WHERE ip2.invoice_id = i.id)
      ),
      invoice_collected AS (
        SELECT
          i.id AS invoice_id,
          CASE
            WHEN COALESCE(pt.paid_total, 0) > 0 THEN pt.paid_total
            WHEN i.status = 'paid' THEN i.total::numeric
            ELSE 0::numeric
          END AS collected
        FROM invoices i
        LEFT JOIN (
          SELECT invoice_id, SUM(amount)::numeric AS paid_total
          FROM payments
          GROUP BY invoice_id
        ) pt ON pt.invoice_id = i.id
      ),
      link_counts AS (
        SELECT invoice_id, COUNT(*)::numeric AS cnt
        FROM invoice_project_links
        GROUP BY invoice_id
      ),
      project_revenue AS (
        SELECT
          pl.project_id,
          SUM(ic.collected / NULLIF(lc.cnt, 0))::numeric AS total_revenue,
          COUNT(DISTINCT pl.invoice_id)::int AS invoice_count
        FROM invoice_project_links pl
        INNER JOIN invoice_collected ic ON ic.invoice_id = pl.invoice_id
        INNER JOIN link_counts lc ON lc.invoice_id = pl.invoice_id
        WHERE ic.collected > 0
        GROUP BY pl.project_id
      ),
      project_expenses AS (
        SELECT
          project_id,
          COALESCE(SUM(amount), 0)::numeric AS total_expenses,
          COUNT(*)::int AS expense_count
        FROM expenses
        WHERE project_id IS NOT NULL
        GROUP BY project_id
      )
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.client_id AS client_id,
        c.company_name AS client_name,
        c.logo_url AS client_logo_url,
        p.status AS status,
        p.budget AS budget,
        COALESCE(pr.total_revenue, 0)::numeric AS total_revenue,
        COALESCE(pe.total_expenses, 0)::numeric AS total_expenses,
        COALESCE(pr.invoice_count, 0)::int AS invoice_count,
        COALESCE(pe.expense_count, 0)::int AS expense_count
      FROM projects p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_revenue pr ON pr.project_id = p.id
      LEFT JOIN project_expenses pe ON pe.project_id = p.id
      WHERE p.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY (COALESCE(pr.total_revenue, 0) - COALESCE(pe.total_expenses, 0)) DESC
    `);

    const rows = Array.isArray(raw)
      ? raw
      : (raw as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];

    const data: ProjectProfitabilityRow[] = rows.map((row) => {
      const totalRevenue = Number(row.total_revenue ?? 0) || 0;
      const totalExpenses = Number(row.total_expenses ?? 0) || 0;
      const profit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
      const profitMargin =
        totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : null;
      const budgetNum = row.budget != null ? Number(row.budget) : null;
      const budgetVariance =
        budgetNum != null && !Number.isNaN(budgetNum)
          ? Math.round((totalRevenue - budgetNum) * 100) / 100
          : null;

      return {
        projectId: String(row.project_id),
        projectName: String(row.project_name ?? ""),
        clientId: String(row.client_id),
        clientName: String(row.client_name ?? "—"),
        clientLogoUrl: row.client_logo_url != null ? String(row.client_logo_url) : null,
        status: String(row.status ?? ""),
        budget: row.budget != null ? String(row.budget) : null,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        profit,
        profitMargin,
        budgetVariance,
        invoiceCount: Number(row.invoice_count ?? 0) || 0,
        expenseCount: Number(row.expense_count ?? 0) || 0,
      };
    });

    return { ok: true, data };
  } catch (e) {
    console.error("getProjectProfitability", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: getDbErrorKey(e) };
  }
}

/**
 * Allocates each project's revenue and expenses (same rules as {@link getProjectProfitability}) evenly across
 * services linked via `project_services`. Projects with no services are omitted.
 */
export async function getServiceProfitability(
  range?: ProfitabilityDateRange
): Promise<
  | { ok: true; data: ServiceProfitabilityAnalyticsRow[] }
  | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const projRes = await getProjectProfitability(range);
    if (!projRes.ok) return projRes;

    const linkRows = await db
      .select({
        projectId: projectServices.projectId,
        serviceId: services.id,
        serviceName: services.name,
      })
      .from(projectServices)
      .innerJoin(services, eq(projectServices.serviceId, services.id))
      .innerJoin(projects, eq(projectServices.projectId, projects.id))
      .where(isNull(projects.deletedAt));

    const servicesByProject = new Map<string, { id: string; name: string }[]>();
    for (const row of linkRows) {
      const list = servicesByProject.get(row.projectId) ?? [];
      if (!list.some((s) => s.id === row.serviceId)) {
        list.push({ id: row.serviceId, name: row.serviceName });
      }
      servicesByProject.set(row.projectId, list);
    }

    const byService = new Map<
      string,
      { name: string; rev: number; exp: number; projects: Set<string> }
    >();

    for (const p of projRes.data) {
      const svcs = servicesByProject.get(p.projectId) ?? [];
      const n = svcs.length;
      if (n === 0) continue;
      const revShare = p.totalRevenue / n;
      const expShare = p.totalExpenses / n;
      for (const s of svcs) {
        const cur = byService.get(s.id) ?? {
          name: s.name,
          rev: 0,
          exp: 0,
          projects: new Set<string>(),
        };
        cur.rev += revShare;
        cur.exp += expShare;
        cur.projects.add(p.projectId);
        byService.set(s.id, cur);
      }
    }

    const data: ServiceProfitabilityAnalyticsRow[] = Array.from(byService.entries()).map(
      ([serviceId, v]) => {
        const totalRevenue = Math.round(v.rev * 100) / 100;
        const totalExpenses = Math.round(v.exp * 100) / 100;
        const profit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
        const profitMargin =
          totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;
        return {
          serviceId,
          serviceName: v.name,
          totalRevenue,
          totalExpenses,
          profit,
          profitMargin,
          projectCount: v.projects.size,
        };
      }
    );
    data.sort((a, b) => b.profit - a.profit);

    return { ok: true as const, data };
  } catch (e) {
    console.error("getServiceProfitability", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

// --- Aging (AR) report ---

export type AgingBucketTotals = { count: number; total: number };

export type AgingReportInvoiceRow = {
  invoice: typeof invoices.$inferSelect;
  client: { id: string; companyName: string | null; logoUrl: string | null };
  dueDate: string;
  daysOverdue: number;
  amountDue: number;
};

export type AgingReportData = {
  current: AgingBucketTotals;
  days1to30: AgingBucketTotals;
  days31to60: AgingBucketTotals;
  days61to90: AgingBucketTotals;
  days90plus: AgingBucketTotals;
  invoices: AgingReportInvoiceRow[];
};

const emptyAgingBuckets = (): Omit<AgingReportData, "invoices"> => ({
  current: { count: 0, total: 0 },
  days1to30: { count: 0, total: 0 },
  days31to60: { count: 0, total: 0 },
  days61to90: { count: 0, total: 0 },
  days90plus: { count: 0, total: 0 },
});

function bucketForDaysOverdue(days: number): keyof Omit<AgingReportData, "invoices"> {
  if (days <= 0) return "current";
  if (days <= 30) return "days1to30";
  if (days <= 60) return "days31to60";
  if (days <= 90) return "days61to90";
  return "days90plus";
}

/** Outstanding balances by aging bucket; only invoices with amount due &gt; 0. */
export async function getAgingReport(): Promise<
  { ok: true; data: AgingReportData } | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const today = startOfDay(new Date());

    const paidSums = await db
      .select({
        invoiceId: payments.invoiceId,
        paid: sum(payments.amount),
      })
      .from(payments)
      .groupBy(payments.invoiceId);

    const paidMap = new Map(
      paidSums.map((r) => [r.invoiceId, Number(r.paid ?? 0)])
    );

    const rows = await db
      .select({
        invoice: invoices,
        clientId: clients.id,
        companyName: clients.companyName,
        logoUrl: clients.logoUrl,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id));

    const buckets = emptyAgingBuckets();
    const list: AgingReportInvoiceRow[] = [];

    for (const row of rows) {
      const inv = row.invoice;
      const totalNum = Number(inv.total);
      const paid = paidMap.get(inv.id) ?? 0;
      const amountDue = Math.round((totalNum - paid) * 100) / 100;
      if (amountDue <= 0) continue;

      const dueRaw = inv.dueDate ?? inv.issueDate;
      const dueStr = String(dueRaw);
      const dueDay = startOfDay(parseISO(dueStr.length === 10 ? `${dueStr}T12:00:00` : dueStr));
      const daysOverdue = Math.max(0, differenceInDays(today, dueDay));

      const key = bucketForDaysOverdue(daysOverdue);
      buckets[key].count += 1;
      buckets[key].total += amountDue;

      list.push({
        invoice: inv,
        client: {
          id: row.clientId,
          companyName: row.companyName,
          logoUrl: row.logoUrl,
        },
        dueDate: dueStr,
        daysOverdue,
        amountDue,
      });
    }

    list.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return {
      ok: true,
      data: {
        ...buckets,
        invoices: list,
      },
    };
  } catch (e) {
    console.error("getAgingReport", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: getDbErrorKey(e) };
  }
}
