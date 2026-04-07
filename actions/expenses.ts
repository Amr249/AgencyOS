"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { clients, expenses, projects, teamMembers } from "@/lib/db/schema";

/** Expense-linked client vs. project's owning client (for cover → logo fallback). */
const expenseClient = alias(clients, "expense_client");
const projectOwnerClient = alias(clients, "project_owner_client");
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const categoryValues = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
] as const;

const createExpenseSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً"),
  category: z.enum(categoryValues),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  receiptUrl: z.string().url().optional().nullable(),
  teamMemberId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
});

const updateExpenseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "العنوان مطلوب").optional(),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً").optional(),
  category: z.enum(categoryValues).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  teamMemberId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  isBillable: z.boolean().optional(),
});

const getExpensesFiltersSchema = z.object({
  category: z.enum(categoryValues).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  isBillable: z.boolean().optional(),
});

export type ExpenseCategory = (typeof categoryValues)[number];
export type ExpenseRow = {
  id: string;
  title: string;
  amount: string;
  category: ExpenseCategory;
  date: string;
  notes: string | null;
  receiptUrl: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  /** Avatar for salary / team-linked rows */
  teamMemberAvatarUrl: string | null;
  projectId: string | null;
  projectName: string | null;
  /** Project cover image */
  projectCoverUrl: string | null;
  /** Logo of the client that owns the project (fallback when no cover) */
  projectClientLogoUrl: string | null;
  clientId: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  isBillable: boolean;
  createdAt: Date;
};

function expenseRowFromJoin(r: {
  id: string;
  title: string;
  amount: unknown;
  category: string;
  date: unknown;
  notes: string | null;
  receiptUrl: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  teamMemberAvatarUrl: string | null;
  projectId: string | null;
  projectName: string | null;
  projectCoverUrl: string | null;
  projectClientLogoUrl: string | null;
  clientId: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  isBillable: boolean;
  createdAt: Date;
}): ExpenseRow {
  return {
    id: r.id,
    title: r.title,
    amount: String(r.amount),
    category: r.category as ExpenseCategory,
    date: String(r.date),
    notes: r.notes,
    receiptUrl: r.receiptUrl,
    teamMemberId: r.teamMemberId,
    teamMemberName: r.teamMemberName ?? null,
    teamMemberAvatarUrl: r.teamMemberAvatarUrl ?? null,
    projectId: r.projectId ?? null,
    projectName: r.projectName ?? null,
    projectCoverUrl: r.projectCoverUrl ?? null,
    projectClientLogoUrl: r.projectClientLogoUrl ?? null,
    clientId: r.clientId ?? null,
    clientName: r.clientName ?? null,
    clientLogoUrl: r.clientLogoUrl ?? null,
    isBillable: r.isBillable,
    createdAt: r.createdAt,
  };
}

export async function getExpenses(filters?: z.infer<typeof getExpensesFiltersSchema>) {
  const parsed = filters ? getExpensesFiltersSchema.safeParse(filters) : { success: true as const, data: {} };
  const f = parsed.success ? parsed.data : {};

  const conditions = [];
  if (f.category) conditions.push(eq(expenses.category, f.category));
  if (f.dateFrom) conditions.push(gte(expenses.date, f.dateFrom));
  if (f.dateTo) conditions.push(lte(expenses.date, f.dateTo));
  if (f.projectId) conditions.push(eq(expenses.projectId, f.projectId));
  if (f.clientId) conditions.push(eq(expenses.clientId, f.clientId));
  if (f.isBillable !== undefined) conditions.push(eq(expenses.isBillable, f.isBillable));

  const rows = await db
    .select({
      id: expenses.id,
      title: expenses.title,
      amount: expenses.amount,
      category: expenses.category,
      date: expenses.date,
      notes: expenses.notes,
      receiptUrl: expenses.receiptUrl,
      teamMemberId: expenses.teamMemberId,
      teamMemberName: teamMembers.name,
      teamMemberAvatarUrl: teamMembers.avatarUrl,
      projectId: expenses.projectId,
      projectName: projects.name,
      projectCoverUrl: projects.coverImageUrl,
      projectClientLogoUrl: projectOwnerClient.logoUrl,
      clientId: expenses.clientId,
      clientName: expenseClient.companyName,
      clientLogoUrl: expenseClient.logoUrl,
      isBillable: expenses.isBillable,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
    .leftJoin(projects, eq(expenses.projectId, projects.id))
    .leftJoin(expenseClient, eq(expenses.clientId, expenseClient.id))
    .leftJoin(projectOwnerClient, eq(projects.clientId, projectOwnerClient.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  const data: ExpenseRow[] = rows.map((r) => expenseRowFromJoin(r));

  return { ok: true as const, data };
}

const EXPORT_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software: "Software",
  hosting: "Hosting",
  marketing: "Marketing",
  salaries: "Salaries",
  equipment: "Equipment",
  office: "Office",
  other: "Other",
};

export type ExpenseExportRow = {
  title: string;
  amount: number;
  category: string;
  date: string;
  projectName: string;
  clientName: string;
  teamMemberName: string;
  isBillable: string;
  notes: string;
};

function formatExpenseDateForExport(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

/** Flat rows for CSV/Excel; uses the same filters as `getExpenses`. */
export async function getExpensesExportData(
  filters?: z.input<typeof getExpensesFiltersSchema>
): Promise<
  { ok: true; data: ExpenseExportRow[] } | { ok: false; error: ReturnType<typeof getDbErrorKey> }
> {
  try {
    const parsed = filters ? getExpensesFiltersSchema.safeParse(filters) : { success: true as const, data: {} };
    const f = parsed.success ? parsed.data : {};
    const res = await getExpenses(f);
    const data: ExpenseExportRow[] = res.data.map((r) => ({
      title: r.title,
      amount: Math.round((Number(r.amount) || 0) * 100) / 100,
      category: EXPORT_CATEGORY_LABELS[r.category],
      date: formatExpenseDateForExport(String(r.date)),
      projectName: r.projectName ?? "",
      clientName: r.clientName ?? "",
      teamMemberName: r.teamMemberName ?? "",
      isBillable: r.isBillable ? "Yes" : "No",
      notes: (r.notes ?? "").replace(/\r\n/g, "\n"),
    }));
    return { ok: true as const, data };
  } catch (e) {
    console.error("getExpensesExportData", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export async function getExpenseById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid expense id" };
  try {
    const [row] = await db
      .select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
        notes: expenses.notes,
        receiptUrl: expenses.receiptUrl,
        teamMemberId: expenses.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberAvatarUrl: teamMembers.avatarUrl,
        projectId: expenses.projectId,
        projectName: projects.name,
        projectCoverUrl: projects.coverImageUrl,
        projectClientLogoUrl: projectOwnerClient.logoUrl,
        clientId: expenses.clientId,
        clientName: expenseClient.companyName,
        clientLogoUrl: expenseClient.logoUrl,
        isBillable: expenses.isBillable,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(expenseClient, eq(expenses.clientId, expenseClient.id))
      .leftJoin(projectOwnerClient, eq(projects.clientId, projectOwnerClient.id))
      .where(eq(expenses.id, parsed.data));

    if (!row) return { ok: false as const, error: "Expense not found" };

    const data: ExpenseRow = expenseRowFromJoin(row);

    return { ok: true as const, data };
  } catch (e) {
    console.error("getExpenseById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load expense" };
  }
}

/** Inclusive calendar month bounds as `YYYY-MM-DD` (handles 28/29/30-day months). */
function currentMonthRangeYmd(reference: Date = new Date()): { monthStart: string; monthEnd: string } {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd };
}

/** Total expenses this month, this year, and top category name + total. */
export async function getExpensesSummary(): Promise<{
  totalThisMonth: number;
  totalThisYear: number;
  topCategory: { category: ExpenseCategory; total: number } | null;
}> {
  const now = new Date();
  const y = now.getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const { monthStart, monthEnd } = currentMonthRangeYmd(now);

  const [monthRow, yearRow, categoryRows] = await Promise.all([
    db
      .select({ total: sql<number>`sum(${expenses.amount})` })
      .from(expenses)
      .where(and(gte(expenses.date, monthStart), lte(expenses.date, monthEnd))),
    db
      .select({ total: sql<number>`sum(${expenses.amount})` })
      .from(expenses)
      .where(and(gte(expenses.date, yearStart), lte(expenses.date, yearEnd))),
    db
      .select({
        category: expenses.category,
        total: sql<number>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .groupBy(expenses.category),
  ]);

  const totalThisMonth = Number(monthRow[0]?.total ?? 0) || 0;
  const totalThisYear = Number(yearRow[0]?.total ?? 0) || 0;
  const byCategory = (categoryRows as { category: string; total: number }[])
    .map((r) => ({ category: r.category as ExpenseCategory, total: r.total }))
    .sort((a, b) => b.total - a.total);
  const topCategory = byCategory[0] ?? null;

  return {
    totalThisMonth,
    totalThisYear,
    topCategory,
  };
}

export async function createExpense(input: z.input<typeof createExpenseSchema>) {
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  try {
    const [row] = await db
      .insert(expenses)
      .values({
        title: parsed.data.title,
        amount: String(parsed.data.amount),
        category: parsed.data.category,
        date: parsed.data.date,
        notes: parsed.data.notes ?? null,
        receiptUrl: parsed.data.receiptUrl ?? null,
        teamMemberId: parsed.data.teamMemberId ?? null,
        projectId: parsed.data.projectId ?? null,
        clientId: parsed.data.clientId ?? null,
        isBillable: parsed.data.isBillable ?? false,
      })
      .returning();
    if (!row) return { ok: false as const, error: "Failed to create" };
    revalidatePath("/dashboard/expenses");
    revalidatePath(`/dashboard/expenses/${row.id}`);
    revalidatePath("/dashboard/reports");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createExpense", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to create expense" };
  }
}

export async function updateExpense(input: z.infer<typeof updateExpenseSchema>) {
  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...rest } = parsed.data;
  const payload: Record<string, unknown> = {};
  if (rest.title != null) payload.title = rest.title;
  if (rest.amount != null) payload.amount = String(rest.amount);
  if (rest.category != null) payload.category = rest.category;
  if (rest.date != null) payload.date = rest.date;
  if (rest.notes !== undefined) payload.notes = rest.notes ?? null;
  if (rest.receiptUrl !== undefined) payload.receiptUrl = rest.receiptUrl ?? null;
  if (rest.teamMemberId !== undefined) payload.teamMemberId = rest.teamMemberId ?? null;
  if (rest.projectId !== undefined) payload.projectId = rest.projectId;
  if (rest.clientId !== undefined) payload.clientId = rest.clientId;
  if (rest.isBillable !== undefined) payload.isBillable = rest.isBillable;
  if (Object.keys(payload).length === 0) {
    return { ok: false as const, error: "No fields to update" };
  }
  try {
    const [row] = await db.update(expenses).set(payload).where(eq(expenses.id, id)).returning();
    if (!row) return { ok: false as const, error: "Expense not found" };
    revalidatePath("/dashboard/expenses");
    revalidatePath(`/dashboard/expenses/${id}`);
    revalidatePath("/dashboard/reports");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateExpense", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update" };
  }
}

export async function deleteExpense(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    const [row] = await db.delete(expenses).where(eq(expenses.id, parsed.data)).returning();
    if (!row) return { ok: false as const, error: "Expense not found" };
    revalidatePath("/dashboard/expenses");
    revalidatePath(`/dashboard/expenses/${parsed.data}`);
    revalidatePath("/dashboard/reports");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteExpense", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete" };
  }
}

export async function deleteExpenses(ids: string[]) {
  const parsed = z.array(z.string().uuid()).min(1).safeParse(ids);
  if (!parsed.success) return { ok: false as const, error: "Invalid ids" };
  try {
    const deleted = await db.delete(expenses).where(inArray(expenses.id, parsed.data)).returning({
      id: expenses.id,
    });
    if (deleted.length === 0) return { ok: false as const, error: "No expenses found" };
    revalidatePath("/dashboard/expenses");
    for (const r of deleted) {
      revalidatePath(`/dashboard/expenses/${r.id}`);
    }
    revalidatePath("/dashboard/reports");
    return { ok: true as const, count: deleted.length };
  } catch (e) {
    console.error("deleteExpenses", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete expenses" };
  }
}

/** Team cost breakdown this month: each team member with total salary expenses paid to them. */
export async function getTeamCostBreakdownThisMonth(): Promise<
  { ok: true; data: { teamMemberId: string; name: string; role: string | null; totalSalary: number }[] } | { ok: false; error: string }
> {
  const { monthStart, monthEnd } = currentMonthRangeYmd();
  try {
    const rows = await db
      .select({
        teamMemberId: expenses.teamMemberId,
        name: teamMembers.name,
        role: teamMembers.role,
        total: sql<number>`coalesce(sum(${expenses.amount})::numeric, 0)`,
      })
      .from(expenses)
      .innerJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .where(
        and(
          eq(expenses.category, "salaries"),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd)
        )
      )
      .groupBy(expenses.teamMemberId, teamMembers.name, teamMembers.role);

    const data = rows
      .filter((r) => r.teamMemberId != null)
      .map((r) => ({
        teamMemberId: r.teamMemberId!,
        name: r.name,
        role: r.role,
        totalSalary: Number(r.total) || 0,
      }));
    return { ok: true, data };
  } catch (e) {
    console.error("getTeamCostBreakdownThisMonth", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to load team cost breakdown" };
  }
}

/** Expenses linked to a team member (e.g. salary payments). Used by team member detail سجل الرواتب tab. */
export async function getExpensesByTeamMemberId(teamMemberId: string) {
  const parsed = z.string().uuid().safeParse(teamMemberId);
  if (!parsed.success) return { ok: false as const, error: "Invalid team member id" };
  try {
    const rows = await db
      .select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
        notes: expenses.notes,
        receiptUrl: expenses.receiptUrl,
        teamMemberId: expenses.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberAvatarUrl: teamMembers.avatarUrl,
        projectId: expenses.projectId,
        projectName: projects.name,
        projectCoverUrl: projects.coverImageUrl,
        projectClientLogoUrl: projectOwnerClient.logoUrl,
        clientId: expenses.clientId,
        clientName: expenseClient.companyName,
        clientLogoUrl: expenseClient.logoUrl,
        isBillable: expenses.isBillable,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(expenseClient, eq(expenses.clientId, expenseClient.id))
      .leftJoin(projectOwnerClient, eq(projects.clientId, projectOwnerClient.id))
      .where(eq(expenses.teamMemberId, parsed.data))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));

    const data: ExpenseRow[] = rows.map((r) => expenseRowFromJoin(r));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getExpensesByTeamMemberId", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load expenses" };
  }
}

export async function getExpensesByProjectId(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  try {
    const rows = await db
      .select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
        notes: expenses.notes,
        receiptUrl: expenses.receiptUrl,
        teamMemberId: expenses.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberAvatarUrl: teamMembers.avatarUrl,
        projectId: expenses.projectId,
        projectName: projects.name,
        projectCoverUrl: projects.coverImageUrl,
        projectClientLogoUrl: projectOwnerClient.logoUrl,
        clientId: expenses.clientId,
        clientName: expenseClient.companyName,
        clientLogoUrl: expenseClient.logoUrl,
        isBillable: expenses.isBillable,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(expenseClient, eq(expenses.clientId, expenseClient.id))
      .leftJoin(projectOwnerClient, eq(projects.clientId, projectOwnerClient.id))
      .where(eq(expenses.projectId, parsed.data))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));

    const data: ExpenseRow[] = rows.map((r) => expenseRowFromJoin(r));

    return { ok: true as const, data };
  } catch (error) {
    console.error("Error fetching expenses by project:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function getExpensesByClientId(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const rows = await db
      .select({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
        notes: expenses.notes,
        receiptUrl: expenses.receiptUrl,
        teamMemberId: expenses.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberAvatarUrl: teamMembers.avatarUrl,
        projectId: expenses.projectId,
        projectName: projects.name,
        projectCoverUrl: projects.coverImageUrl,
        projectClientLogoUrl: projectOwnerClient.logoUrl,
        clientId: expenses.clientId,
        clientName: expenseClient.companyName,
        clientLogoUrl: expenseClient.logoUrl,
        isBillable: expenses.isBillable,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(expenseClient, eq(expenses.clientId, expenseClient.id))
      .leftJoin(projectOwnerClient, eq(projects.clientId, projectOwnerClient.id))
      .where(eq(expenses.clientId, parsed.data))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));

    const data: ExpenseRow[] = rows.map((r) => expenseRowFromJoin(r));

    return { ok: true as const, data };
  } catch (error) {
    console.error("Error fetching expenses by client:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function getProjectCostSummary(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  try {
    const result = await db
      .select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        billableExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isBillable} THEN ${expenses.amount} ELSE 0 END), 0)`,
        nonBillableExpenses: sql<string>`COALESCE(SUM(CASE WHEN NOT ${expenses.isBillable} THEN ${expenses.amount} ELSE 0 END), 0)`,
        expenseCount: sql<number>`COUNT(*)::int`,
      })
      .from(expenses)
      .where(eq(expenses.projectId, parsed.data));

    return {
      ok: true as const,
      data: {
        totalExpenses: parseFloat(result[0]?.totalExpenses || "0"),
        billableExpenses: parseFloat(result[0]?.billableExpenses || "0"),
        nonBillableExpenses: parseFloat(result[0]?.nonBillableExpenses || "0"),
        expenseCount: result[0]?.expenseCount ?? 0,
      },
    };
  } catch (error) {
    console.error("Error fetching project cost summary:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function getClientCostSummary(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const result = await db
      .select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        billableExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.isBillable} THEN ${expenses.amount} ELSE 0 END), 0)`,
        nonBillableExpenses: sql<string>`COALESCE(SUM(CASE WHEN NOT ${expenses.isBillable} THEN ${expenses.amount} ELSE 0 END), 0)`,
        expenseCount: sql<number>`COUNT(*)::int`,
      })
      .from(expenses)
      .where(eq(expenses.clientId, parsed.data));

    return {
      ok: true as const,
      data: {
        totalExpenses: parseFloat(result[0]?.totalExpenses || "0"),
        billableExpenses: parseFloat(result[0]?.billableExpenses || "0"),
        nonBillableExpenses: parseFloat(result[0]?.nonBillableExpenses || "0"),
        expenseCount: result[0]?.expenseCount ?? 0,
      },
    };
  } catch (error) {
    console.error("Error fetching client cost summary:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}
