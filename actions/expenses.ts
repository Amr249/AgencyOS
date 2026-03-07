"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, teamMembers } from "@/lib/db/schema";

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
});

const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
});

const getExpensesFiltersSchema = z.object({
  category: z.enum(categoryValues).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  createdAt: Date;
};

export async function getExpenses(filters?: z.infer<typeof getExpensesFiltersSchema>) {
  const parsed = filters ? getExpensesFiltersSchema.safeParse(filters) : { success: true as const, data: {} };
  const f = parsed.success ? parsed.data : {};

  const conditions = [];
  if (f.category) conditions.push(eq(expenses.category, f.category));
  if (f.dateFrom) conditions.push(gte(expenses.date, f.dateFrom));
  if (f.dateTo) conditions.push(lte(expenses.date, f.dateTo));

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
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  const data: ExpenseRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    amount: String(r.amount),
    category: r.category as ExpenseCategory,
    date: String(r.date),
    notes: r.notes,
    receiptUrl: r.receiptUrl,
    teamMemberId: r.teamMemberId,
    teamMemberName: r.teamMemberName ?? null,
    createdAt: r.createdAt,
  }));

  return { ok: true as const, data };
}

/** Total expenses this month, this year, and top category name + total. */
export async function getExpensesSummary(): Promise<{
  totalThisMonth: number;
  totalThisYear: number;
  topCategory: { category: ExpenseCategory; total: number } | null;
}> {
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

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

export async function createExpense(input: z.infer<typeof createExpenseSchema>) {
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
      })
      .returning();
    if (!row) return { ok: false as const, error: "Failed to create" };
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/reports");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createExpense", e);
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
  if (Object.keys(payload).length === 0) {
    return { ok: false as const, error: "No fields to update" };
  }
  try {
    const [row] = await db.update(expenses).set(payload).where(eq(expenses.id, id)).returning();
    if (!row) return { ok: false as const, error: "Expense not found" };
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/reports");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateExpense", e);
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
    revalidatePath("/dashboard/reports");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteExpense", e);
    return { ok: false as const, error: "Failed to delete" };
  }
}

/** Team cost breakdown this month: each team member with total salary expenses paid to them. */
export async function getTeamCostBreakdownThisMonth(): Promise<
  { ok: true; data: { teamMemberId: string; name: string; role: string | null; totalSalary: number }[] } | { ok: false; error: string }
> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
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
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .where(eq(expenses.teamMemberId, parsed.data))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));

    const data: ExpenseRow[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      amount: String(r.amount),
      category: r.category as ExpenseCategory,
      date: String(r.date),
      notes: r.notes,
      receiptUrl: r.receiptUrl,
      teamMemberId: r.teamMemberId,
      teamMemberName: r.teamMemberName ?? null,
      createdAt: r.createdAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getExpensesByTeamMemberId", e);
    return { ok: false as const, error: "Failed to load expenses" };
  }
}
