"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, gte, lte, or, ilike, desc } from "drizzle-orm";
import { db, invoices, invoiceItems, settings, clients, projects } from "@/lib/db";
import { isDbConnectionError, DB_CONNECTION_ERROR_MESSAGE } from "@/lib/db-errors";

const invoiceStatusValues = ["pending", "paid"] as const;
const paymentMethodValues = ["bank_transfer", "cash", "credit_card", "other"] as const;

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().min(1),
  issueDate: z.string().min(1),
  currency: z.string().length(3).default("SAR"),
  notes: z.string().optional().nullable(),
  status: z.enum(invoiceStatusValues).default("pending"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  id: z.string().uuid(),
  lineItems: z.array(lineItemSchema).optional(),
});

const markAsPaidSchema = z.object({
  id: z.string().uuid(),
  paidAt: z.string().min(1, "Payment date required"),
  paymentMethod: z.enum(paymentMethodValues).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

function getDateRange(range: string): { start: Date; end: Date } | null {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  switch (range) {
    case "this_month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case "last_month":
      start.setMonth(now.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // last day of previous month
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case "this_year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    default:
      return null;
  }
}

export async function getInvoices(filters?: {
  status?: string;
  dateRange?: string;
  search?: string;
  projectId?: string;
  clientId?: string;
}) {
  try {
    const conditions = [];
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(invoices.status, filters.status as (typeof invoices.$inferSelect)["status"]));
    }
    if (filters?.projectId) {
      conditions.push(eq(invoices.projectId, filters.projectId));
    }
    if (filters?.clientId) {
      conditions.push(eq(invoices.clientId, filters.clientId));
    }
    if (filters?.dateRange) {
      const range = getDateRange(filters.dateRange);
      if (range) {
        conditions.push(gte(invoices.issueDate, range.start.toISOString().slice(0, 10)));
        conditions.push(lte(invoices.issueDate, range.end.toISOString().slice(0, 10)));
      }
    }
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(ilike(invoices.invoiceNumber, term), ilike(clients.companyName, term))!
      );
    }
    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        projectId: invoices.projectId,
        status: invoices.status,
        issueDate: invoices.issueDate,
        paidAt: invoices.paidAt,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        total: invoices.total,
        currency: invoices.currency,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
        projectName: projects.name,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issueDate), invoices.invoiceNumber);
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getInvoices", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to load invoices" };
  }
}

export async function getInvoicesByProjectId(projectId: string) {
  return getInvoices({ projectId });
}

export async function getInvoicesByClientId(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) return { ok: false as const, error: "Invalid client id" };
  try {
    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        projectId: invoices.projectId,
        status: invoices.status,
        issueDate: invoices.issueDate,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        total: invoices.total,
        currency: invoices.currency,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
        projectName: projects.name,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(invoices.clientId, parsed.data))
      .orderBy(desc(invoices.createdAt), invoices.invoiceNumber);
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getInvoicesByClientId", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to load invoices" };
  }
}

export async function getInvoiceStats() {
  try {
    const rows = await db.select().from(invoices);
    let totalInvoiced = 0;
    let collected = 0;
    let outstanding = 0;
    for (const inv of rows) {
      const total = Number(inv.total);
      totalInvoiced += total;
      if (inv.status === "paid") collected += total;
      else outstanding += total; // pending
    }
    return {
      ok: true as const,
      data: { totalInvoiced, collected, outstanding },
    };
  } catch (e) {
    console.error("getInvoiceStats", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to load stats" };
  }
}

export async function getInvoiceById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice id" };
  try {
    const [row] = await db
      .select({
        invoice: invoices,
        clientName: clients.companyName,
        clientAddress: clients.address,
        clientPhone: clients.contactPhone,
        projectName: projects.name,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(invoices.id, parsed.data));
    if (!row) return { ok: false as const, error: "Invoice not found" };
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, parsed.data))
      .orderBy(invoiceItems.order);
    return {
      ok: true as const,
      data: {
        ...row.invoice,
        clientName: row.clientName,
        clientAddress: row.clientAddress,
        clientPhone: row.clientPhone,
        projectName: row.projectName,
        items,
      },
    };
  } catch (e) {
    console.error("getInvoiceById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to load invoice" };
  }
}

function computeLineAmount(qty: number, unitPrice: number, taxRate: number) {
  const subtotal = qty * unitPrice;
  const tax = (subtotal * taxRate) / 100;
  return { amount: subtotal + tax, subtotal, tax };
}

export async function createInvoice(input: CreateInvoiceInput) {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  let subtotalTotal = 0;
  let taxTotal = 0;
  const itemsWithAmounts = data.lineItems.map((item) => {
    const { amount, subtotal, tax } = computeLineAmount(
      item.quantity,
      item.unitPrice,
      item.taxRate
    );
    subtotalTotal += subtotal;
    taxTotal += tax;
    return { ...item, amount };
  });
  const grandTotal = subtotalTotal + taxTotal;
  try {
    const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 1));
    const nextNum = settingsRow?.invoiceNextNumber ?? 1;
    if (data.invoiceNumber === `${settingsRow?.invoicePrefix ?? "فاتورة"}-${String(nextNum).padStart(3, "0")}`) {
      await db.update(settings).set({ invoiceNextNumber: nextNum + 1 }).where(eq(settings.id, 1));
    }
    const [inv] = await db
      .insert(invoices)
      .values({
        invoiceNumber: data.invoiceNumber,
        clientId: data.clientId,
        projectId: data.projectId ?? null,
        status: "pending",
        issueDate: data.issueDate,
        subtotal: String(subtotalTotal.toFixed(2)),
        taxAmount: String(taxTotal.toFixed(2)),
        total: String(grandTotal.toFixed(2)),
        currency: "SAR",
        notes: data.notes ?? null,
      })
      .returning();
    if (!inv) return { ok: false as const, error: { _form: ["Failed to create invoice"] } };
    await db.insert(invoiceItems).values(
      itemsWithAmounts.map((item, i) => ({
        invoiceId: inv.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        taxRate: String(item.taxRate),
        amount: String(item.amount.toFixed(2)),
        order: i,
      }))
    );
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${inv.id}`);
    return { ok: true as const, data: inv };
  } catch (e) {
    console.error("createInvoice", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [DB_CONNECTION_ERROR_MESSAGE] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateInvoice(input: UpdateInvoiceInput) {
  const parsed = updateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, lineItems, ...data } = parsed.data;
  try {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) return { ok: false as const, error: { _form: ["Invoice not found"] } };
    if (existing.status !== "pending") {
      return { ok: false as const, error: { _form: ["Only pending invoices can be edited"] } };
    }
    const updatePayload: Record<string, unknown> = {};
    if (data.clientId !== undefined) updatePayload.clientId = data.clientId;
    if (data.projectId !== undefined) updatePayload.projectId = data.projectId ?? null;
    if (data.invoiceNumber !== undefined) updatePayload.invoiceNumber = data.invoiceNumber;
    if (data.issueDate !== undefined) updatePayload.issueDate = data.issueDate;
    if (data.currency !== undefined) updatePayload.currency = data.currency;
    if (data.notes !== undefined) updatePayload.notes = data.notes ?? null;
    if (lineItems && lineItems.length > 0) {
      let subtotalTotal = 0;
      let taxTotal = 0;
      const itemsWithAmounts = lineItems.map((item) => {
        const { amount, subtotal, tax } = computeLineAmount(
          item.quantity,
          item.unitPrice,
          item.taxRate
        );
        subtotalTotal += subtotal;
        taxTotal += tax;
        return { ...item, amount };
      });
      updatePayload.subtotal = String(subtotalTotal.toFixed(2));
      updatePayload.taxAmount = String(taxTotal.toFixed(2));
      updatePayload.total = String((subtotalTotal + taxTotal).toFixed(2));
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await db.insert(invoiceItems).values(
        itemsWithAmounts.map((item, i) => ({
          invoiceId: id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          taxRate: String(item.taxRate),
          amount: String(item.amount.toFixed(2)),
          order: i,
        }))
      );
    }
    const [row] = await db
      .update(invoices)
      .set(updatePayload as typeof invoices.$inferInsert)
      .where(eq(invoices.id, id))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Update failed"] } };
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath(`/dashboard/invoices/${id}/edit`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateInvoice", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [DB_CONNECTION_ERROR_MESSAGE] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

const updateInvoiceStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(invoiceStatusValues),
});

export async function updateInvoiceStatus(
  id: string,
  status: (typeof invoiceStatusValues)[number]
) {
  const parsed = updateInvoiceStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  try {
    const payload =
      status === "paid"
        ? { status: "paid" as const, paidAt: new Date(), paymentMethod: "other" as const }
        : { status: "pending" as const, paidAt: null, paymentMethod: null };
    const [row] = await db
      .update(invoices)
      .set(payload)
      .where(eq(invoices.id, parsed.data.id))
      .returning();
    if (!row) return { ok: false as const, error: "Invoice not found" };
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateInvoiceStatus", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to update status" };
  }
}

export async function markAsPaid(input: z.infer<typeof markAsPaidSchema>) {
  const parsed = markAsPaidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, paidAt, paymentMethod } = parsed.data;
  const paidAtDate = paidAt.length === 10 ? `${paidAt}T12:00:00.000Z` : paidAt;
  try {
    const [row] = await db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: new Date(paidAtDate),
        paymentMethod: paymentMethod ?? null,
      })
      .where(eq(invoices.id, id))
      .returning();
    if (!row) return { ok: false as const, error: "Invoice not found" };
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath("/dashboard/reports");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("markAsPaid", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to update" };
  }
}

export async function duplicateInvoice(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice id" };
  const res = await getInvoiceById(parsed.data);
  if (!res.ok || !res.data) return { ok: false as const, error: res.error ?? "Invoice not found" };
  const inv = res.data;
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, parsed.data))
    .orderBy(invoiceItems.order);
  const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 1));
  const nextNum = settingsRow?.invoiceNextNumber ?? 1;
  const prefix = settingsRow?.invoicePrefix ?? "فاتورة";
  const newNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;
  const createRes = await createInvoice({
    clientId: inv.clientId,
    projectId: inv.projectId ?? undefined,
    invoiceNumber: newNumber,
    issueDate: new Date().toISOString().slice(0, 10),
    currency: "SAR",
    notes: inv.notes ?? undefined,
    status: "pending",
    lineItems: items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      taxRate: Number(i.taxRate),
    })),
  });
  if (!createRes.ok) return createRes;
  await db.update(settings).set({ invoiceNextNumber: nextNum + 1 }).where(eq(settings.id, 1));
  revalidatePath("/dashboard/invoices");
  return { ok: true as const, data: createRes.data };
}

export async function deleteInvoice(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid invoice id" };
  }
  try {
    const [inv] = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, parsed.data));
    if (!inv) return { ok: false as const, error: "Invoice not found" };
    await db.delete(invoices).where(eq(invoices.id, parsed.data));
    revalidatePath("/dashboard/invoices");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteInvoice", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete invoice",
    };
  }
}

export async function getNextInvoiceNumber() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    const prefix = row?.invoicePrefix ?? "فاتورة";
    const next = row?.invoiceNextNumber ?? 1;
    return { ok: true as const, data: `${prefix}-${String(next).padStart(3, "0")}` };
  } catch (e) {
    console.error("getNextInvoiceNumber", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to get next number" };
  }
}

/** One-time migration: set all invoices to فاتورة-001, فاتورة-002, ... and settings to prefix فاتورة. */
export async function migrateInvoicesToNewFormat() {
  try {
    const all = await db
      .select({ id: invoices.id })
      .from(invoices)
      .orderBy(invoices.createdAt);
    if (all.length === 0) {
      await db
        .update(settings)
        .set({ invoicePrefix: "فاتورة", invoiceNextNumber: 1 })
        .where(eq(settings.id, 1));
      revalidatePath("/dashboard/invoices");
      return { ok: true as const, data: { updated: 0 } };
    }
    for (let i = 0; i < all.length; i++) {
      const newNum = `${i + 1}`.padStart(3, "0");
      const newInvoiceNumber = `فاتورة-${newNum}`;
      await db
        .update(invoices)
        .set({ invoiceNumber: `MIG-${all[i].id}` })
        .where(eq(invoices.id, all[i].id));
    }
    for (let i = 0; i < all.length; i++) {
      const newNum = `${i + 1}`.padStart(3, "0");
      await db
        .update(invoices)
        .set({ invoiceNumber: `فاتورة-${newNum}` })
        .where(eq(invoices.id, all[i].id));
    }
    await db
      .update(settings)
      .set({ invoicePrefix: "فاتورة", invoiceNextNumber: all.length + 1 })
      .where(eq(settings.id, 1));
    revalidatePath("/dashboard/invoices");
    return { ok: true as const, data: { updated: all.length } };
  } catch (e) {
    console.error("migrateInvoicesToNewFormat", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to migrate invoice numbers" };
  }
}
