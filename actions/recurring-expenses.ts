"use server";

import { db, recurringExpenses, expenses, projects, clients, teamMembers } from "@/lib/db";
import { eq, and, lte, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDbConnectionError, getDbErrorKey } from "@/lib/db-errors";
import { addWeeks, addMonths, addQuarters, addYears, format } from "date-fns";

const categoryValues = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
] as const;

const frequencyValues = ["weekly", "monthly", "quarterly", "yearly"] as const;

const createRecurringExpenseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum(categoryValues),
  frequency: z.enum(frequencyValues),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  notes: z.string().optional(),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  teamMemberId: z.string().uuid().optional().nullable(),
  isBillable: z.boolean().optional().default(false),
  vendorLogoUrl: z.string().url().optional().nullable(),
});

const updateRecurringExpenseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  category: z.enum(categoryValues).optional(),
  frequency: z.enum(frequencyValues).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  teamMemberId: z.string().uuid().optional().nullable(),
  isBillable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  vendorLogoUrl: z.string().url().optional().nullable(),
});

function normalizedVendorLogoUrl(
  category: (typeof categoryValues)[number],
  url: string | null | undefined
): string | null {
  if (category !== "software") return null;
  const t = url?.trim();
  return t ? t : null;
}

export async function getRecurringExpenses() {
  try {
    const results = await db
      .select({
        id: recurringExpenses.id,
        title: recurringExpenses.title,
        amount: recurringExpenses.amount,
        category: recurringExpenses.category,
        frequency: recurringExpenses.frequency,
        nextDueDate: recurringExpenses.nextDueDate,
        notes: recurringExpenses.notes,
        projectId: recurringExpenses.projectId,
        projectName: projects.name,
        clientId: recurringExpenses.clientId,
        clientName: clients.companyName,
        teamMemberId: recurringExpenses.teamMemberId,
        teamMemberName: teamMembers.name,
        isBillable: recurringExpenses.isBillable,
        isActive: recurringExpenses.isActive,
        vendorLogoUrl: recurringExpenses.vendorLogoUrl,
        createdAt: recurringExpenses.createdAt,
      })
      .from(recurringExpenses)
      .leftJoin(projects, eq(recurringExpenses.projectId, projects.id))
      .leftJoin(clients, eq(recurringExpenses.clientId, clients.id))
      .leftJoin(teamMembers, eq(recurringExpenses.teamMemberId, teamMembers.id))
      .orderBy(desc(recurringExpenses.createdAt));

    return { ok: true as const, data: results };
  } catch (error) {
    console.error("Error fetching recurring expenses:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function createRecurringExpense(input: z.infer<typeof createRecurringExpenseSchema>) {
  try {
    const validated = createRecurringExpenseSchema.parse(input);

    const [newRecurring] = await db
      .insert(recurringExpenses)
      .values({
        title: validated.title,
        amount: validated.amount.toString(),
        category: validated.category,
        frequency: validated.frequency,
        nextDueDate: validated.nextDueDate,
        notes: validated.notes ?? null,
        projectId: validated.projectId ?? null,
        clientId: validated.clientId ?? null,
        teamMemberId: validated.teamMemberId ?? null,
        isBillable: validated.isBillable ?? false,
        vendorLogoUrl: normalizedVendorLogoUrl(validated.category, validated.vendorLogoUrl),
      })
      .returning();

    if (!newRecurring) {
      return { ok: false as const, error: "Failed to create recurring expense" };
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/expenses/recurring");

    return { ok: true as const, data: newRecurring };
  } catch (error) {
    console.error("Error creating recurring expense:", error);
    if (error instanceof z.ZodError) {
      return { ok: false as const, error: error.flatten().fieldErrors };
    }
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function updateRecurringExpense(input: z.infer<typeof updateRecurringExpenseSchema>) {
  try {
    const validated = updateRecurringExpenseSchema.parse(input);
    const { id, ...updateData } = validated;

    const [existing] = await db
      .select({ category: recurringExpenses.category })
      .from(recurringExpenses)
      .where(eq(recurringExpenses.id, id));

    if (!existing) {
      return { ok: false as const, error: "Recurring expense not found" };
    }

    const effectiveCategory = (updateData.category ?? existing.category) as (typeof categoryValues)[number];

    const updateValues: Record<string, unknown> = {};

    if (updateData.title !== undefined) updateValues.title = updateData.title;
    if (updateData.amount !== undefined) updateValues.amount = updateData.amount.toString();
    if (updateData.category !== undefined) updateValues.category = updateData.category;
    if (updateData.frequency !== undefined) updateValues.frequency = updateData.frequency;
    if (updateData.nextDueDate !== undefined) updateValues.nextDueDate = updateData.nextDueDate;
    if (updateData.notes !== undefined) updateValues.notes = updateData.notes;
    if (updateData.projectId !== undefined) updateValues.projectId = updateData.projectId;
    if (updateData.clientId !== undefined) updateValues.clientId = updateData.clientId;
    if (updateData.teamMemberId !== undefined) updateValues.teamMemberId = updateData.teamMemberId;
    if (updateData.isBillable !== undefined) updateValues.isBillable = updateData.isBillable;
    if (updateData.isActive !== undefined) updateValues.isActive = updateData.isActive;

    if (effectiveCategory !== "software") {
      updateValues.vendorLogoUrl = null;
    } else if (updateData.vendorLogoUrl !== undefined) {
      updateValues.vendorLogoUrl = normalizedVendorLogoUrl("software", updateData.vendorLogoUrl);
    }

    updateValues.updatedAt = new Date();

    const [updated] = await db
      .update(recurringExpenses)
      .set(updateValues)
      .where(eq(recurringExpenses.id, id))
      .returning();

    if (!updated) {
      return { ok: false as const, error: "Recurring expense not found after update" };
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/expenses/recurring");

    return { ok: true as const, data: updated };
  } catch (error) {
    console.error("Error updating recurring expense:", error);
    if (error instanceof z.ZodError) {
      return { ok: false as const, error: error.flatten().fieldErrors };
    }
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function deleteRecurringExpense(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid id" };
  }
  try {
    const [removed] = await db.delete(recurringExpenses).where(eq(recurringExpenses.id, parsed.data)).returning();
    if (!removed) {
      return { ok: false as const, error: "Recurring expense not found" };
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/expenses/recurring");

    return { ok: true as const };
  } catch (error) {
    console.error("Error deleting recurring expense:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function toggleRecurringExpenseActive(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid id" };
  }
  try {
    const [current] = await db
      .select({ isActive: recurringExpenses.isActive })
      .from(recurringExpenses)
      .where(eq(recurringExpenses.id, parsed.data));

    if (!current) {
      return { ok: false as const, error: "Recurring expense not found" };
    }

    const [updated] = await db
      .update(recurringExpenses)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(recurringExpenses.id, parsed.data))
      .returning();

    if (!updated) {
      return { ok: false as const, error: "Recurring expense not found" };
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/expenses/recurring");

    return { ok: true as const, data: updated };
  } catch (error) {
    console.error("Error toggling recurring expense:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

function calculateNextDueDate(currentDate: string, frequency: (typeof frequencyValues)[number]): string {
  const date = new Date(currentDate + "T12:00:00");
  let next: Date;
  switch (frequency) {
    case "weekly":
      next = addWeeks(date, 1);
      break;
    case "monthly":
      next = addMonths(date, 1);
      break;
    case "quarterly":
      next = addQuarters(date, 1);
      break;
    case "yearly":
      next = addYears(date, 1);
      break;
    default:
      next = addMonths(date, 1);
  }
  return format(next, "yyyy-MM-dd");
}

export async function processRecurringExpenses() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const dueExpenses = await db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.isActive, true), lte(recurringExpenses.nextDueDate, today)));

    const created: string[] = [];

    for (const recurring of dueExpenses) {
      await db.insert(expenses).values({
        title: recurring.title,
        amount: String(recurring.amount),
        category: recurring.category,
        date: recurring.nextDueDate,
        notes: recurring.notes ?? null,
        projectId: recurring.projectId,
        clientId: recurring.clientId,
        teamMemberId: recurring.teamMemberId,
        isBillable: recurring.isBillable,
      });

      const nextDate = calculateNextDueDate(
        String(recurring.nextDueDate),
        recurring.frequency as (typeof frequencyValues)[number]
      );
      await db
        .update(recurringExpenses)
        .set({ nextDueDate: nextDate, updatedAt: new Date() })
        .where(eq(recurringExpenses.id, recurring.id));

      created.push(recurring.id);
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/expenses/recurring");
    revalidatePath("/dashboard/reports");

    return { ok: true as const, data: { processed: created.length, ids: created } };
  } catch (error) {
    console.error("Error processing recurring expenses:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}

export async function getDueRecurringExpenses() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const results = await db
      .select({
        id: recurringExpenses.id,
        title: recurringExpenses.title,
        amount: recurringExpenses.amount,
        category: recurringExpenses.category,
        frequency: recurringExpenses.frequency,
        nextDueDate: recurringExpenses.nextDueDate,
      })
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.isActive, true), lte(recurringExpenses.nextDueDate, today)))
      .orderBy(asc(recurringExpenses.nextDueDate));

    return { ok: true as const, data: results };
  } catch (error) {
    console.error("Error fetching due recurring expenses:", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "unknown" };
  }
}
