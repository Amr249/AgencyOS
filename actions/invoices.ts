"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { runLegacyPaidInvoicePaymentMigration } from "@/lib/migrate-legacy-payments";
import { eq, and, gte, lte, or, ilike, desc, inArray, ne, asc, sql, sum } from "drizzle-orm";
import {
  db,
  invoices,
  invoiceItems,
  invoiceProjects,
  settings,
  clients,
  projects,
  payments,
} from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { invoiceCollectedAmount } from "@/lib/invoice-collected";
import { formatInvoiceSerial } from "@/lib/invoice-number";

const invoiceStatusValues = ["pending", "partial", "paid"] as const;
const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  /** @deprecated Use projectIds; still merged for compatibility */
  projectId: z.string().uuid().optional().nullable(),
  /** All projects this invoice applies to (same client). First becomes invoices.project_id */
  projectIds: z.array(z.string().uuid()).max(50).optional(),
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
  paidAt: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

function mergeProjectIds(
  projectId: string | null | undefined,
  projectIds: string[] | undefined
): string[] {
  return [...new Set([...(projectIds ?? []), ...(projectId ? [projectId] : [])])];
}

async function assertProjectsBelongToClient(clientId: string, projectIds: string[]) {
  if (projectIds.length === 0) return;
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), inArray(projects.id, projectIds)));
  if (rows.length !== projectIds.length) {
    throw new Error("INVALID_PROJECTS");
  }
}

async function syncInvoiceProjectLinks(invoiceId: string, projectIds: string[]) {
  const unique = [...new Set(projectIds)];
  await db.delete(invoiceProjects).where(eq(invoiceProjects.invoiceId, invoiceId));
  if (unique.length === 0) return;
  await db.insert(invoiceProjects).values(unique.map((projectId) => ({ invoiceId, projectId })));
}

async function enrichInvoiceRowsProjectNames<T extends { id: string; projectName: string | null }>(
  rows: T[]
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const linkRows = await db
    .select({
      invoiceId: invoiceProjects.invoiceId,
      name: projects.name,
    })
    .from(invoiceProjects)
    .innerJoin(projects, eq(invoiceProjects.projectId, projects.id))
    .where(inArray(invoiceProjects.invoiceId, ids))
    .orderBy(projects.name);
  const byInv = new Map<string, string[]>();
  for (const r of linkRows) {
    const arr = byInv.get(r.invoiceId) ?? [];
    arr.push(r.name);
    byInv.set(r.invoiceId, arr);
  }
  return rows.map((r) => {
    const linked = byInv.get(r.id);
    if (linked?.length) {
      return { ...r, projectName: linked.join(", ") } as T;
    }
    return r;
  });
}

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

function isValidInvoiceDateParam(s: string | undefined): s is string {
  if (!s || typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(Date.parse(`${s}T12:00:00`));
}

export async function getInvoices(filters?: {
  status?: string;
  dateRange?: string;
  /** Inclusive start (YYYY-MM-DD), issue date &gt;= dateFrom */
  dateFrom?: string;
  /** Inclusive end (YYYY-MM-DD), issue date &lt;= dateTo */
  dateTo?: string;
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
      const pid = filters.projectId;
      conditions.push(
        or(
          eq(invoices.projectId, pid),
          sql`exists (
            select 1 from invoice_projects ip
            where ip.invoice_id = ${invoices.id} and ip.project_id = ${pid}
          )`
        )!
      );
    }
    if (filters?.clientId) {
      conditions.push(eq(invoices.clientId, filters.clientId));
    }
    const customFrom = filters?.dateFrom && isValidInvoiceDateParam(filters.dateFrom) ? filters.dateFrom : undefined;
    const customTo = filters?.dateTo && isValidInvoiceDateParam(filters.dateTo) ? filters.dateTo : undefined;
    if (customFrom || customTo) {
      let from = customFrom;
      let to = customTo;
      if (from && to && from > to) {
        const t = from;
        from = to;
        to = t;
      }
      if (from) conditions.push(gte(invoices.issueDate, from));
      if (to) conditions.push(lte(invoices.issueDate, to));
    } else if (filters?.dateRange) {
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
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        paymentMethod: invoices.paymentMethod,
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
    const enriched = await enrichInvoiceRowsProjectNames(rows);
    return { ok: true as const, data: enriched };
  } catch (e) {
    console.error("getInvoices", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load invoices" };
  }
}

export async function getInvoicesWithPayments(filters?: {
  status?: string;
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  projectId?: string;
  clientId?: string;
}) {
  try {
    const baseResult = await getInvoices(filters);
    if (!baseResult.ok || !baseResult.data) {
      return baseResult;
    }
    const rows = baseResult.data;
    if (rows.length === 0) {
      return { ok: true as const, data: [] };
    }
    const ids = rows.map((r) => r.id);
    const paymentRows = await db
      .select({
        invoiceId: payments.invoiceId,
        total: sum(payments.amount),
      })
      .from(payments)
      .where(inArray(payments.invoiceId, ids))
      .groupBy(payments.invoiceId);

    const paidByInvoice = new Map<string, number>();
    for (const row of paymentRows) {
      paidByInvoice.set(row.invoiceId, parseFloat(String(row.total ?? "0")));
    }

    const enrichedInvoices = rows.map((invoice) => {
      const paymentSum = paidByInvoice.get(invoice.id) ?? 0;
      const invoiceTotal = parseFloat(String(invoice.total));
      const totalPaid = invoiceCollectedAmount(paymentSum, invoiceTotal, invoice.status);
      const amountDue = Math.max(0, invoiceTotal - totalPaid);
      return {
        ...invoice,
        totalPaid,
        amountDue,
      };
    });

    return { ok: true as const, data: enrichedInvoices };
  } catch (e) {
    console.error("getInvoicesWithPayments", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load invoices" };
  }
}

export type InvoicesExportFilters = {
  status?: string;
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  projectId?: string;
  clientId?: string;
};

/** One flat row for CSV / Excel export (amounts are numbers; dates are DD/MM/YYYY or empty). */
export type InvoiceExportRow = {
  invoiceNumber: string;
  clientName: string;
  projectName: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  paidAt: string;
  paymentMethod: string;
};

function formatInvoiceExportDate(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

function formatInvoiceExportPaidAt(paidAt: Date | string | null | undefined): string {
  if (paidAt == null) return "";
  if (paidAt instanceof Date) {
    if (Number.isNaN(paidAt.getTime())) return "";
    const y = paidAt.getFullYear();
    const m = String(paidAt.getMonth() + 1).padStart(2, "0");
    const d = String(paidAt.getDate()).padStart(2, "0");
    return `${d}/${m}/${y}`;
  }
  return formatInvoiceExportDate(String(paidAt));
}

function roundExportAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Same filters as {@link getInvoices} / {@link getInvoicesWithPayments}; returns rows ready for CSV/Excel.
 */
export async function getInvoicesExportData(filters?: InvoicesExportFilters): Promise<
  | { ok: true; data: InvoiceExportRow[] }
  | { ok: false; error: ReturnType<typeof getDbErrorKey> | string }
> {
  try {
    const result = await getInvoicesWithPayments(filters);
    if (!result.ok) {
      return result;
    }
    const data: InvoiceExportRow[] = result.data.map((inv) => {
      const totalNum = Number(inv.total);
      const paidAmount = roundExportAmount(inv.totalPaid ?? 0);
      const outstandingAmount = roundExportAmount(inv.amountDue ?? Math.max(0, totalNum - paidAmount));
      return {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName ?? "",
        projectName: inv.projectName ?? "",
        status: inv.status,
        issueDate: formatInvoiceExportDate(String(inv.issueDate)),
        dueDate: inv.dueDate ? formatInvoiceExportDate(String(inv.dueDate)) : "",
        subtotal: roundExportAmount(Number(inv.subtotal)),
        taxAmount: roundExportAmount(Number(inv.taxAmount)),
        total: roundExportAmount(totalNum),
        paidAmount,
        outstandingAmount,
        paidAt: formatInvoiceExportPaidAt(inv.paidAt),
        paymentMethod: (inv.paymentMethod ?? "").trim(),
      };
    });
    return { ok: true, data };
  } catch (e) {
    console.error("getInvoicesExportData", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to export invoices" };
  }
}

/**
 * Dashboard invoice stats: `collected` = sum of all `payments.amount` **plus** legacy amounts
 * (`invoice.total` where `status = 'paid'` and the invoice has no payment rows).
 * `outstanding` = `totalInvoiced - collected`.
 */
export async function getInvoiceStatsWithPayments() {
  try {
    const allInvoices = await db.select({ total: invoices.total }).from(invoices);
    if (allInvoices.length === 0) {
      return {
        ok: true as const,
        data: { totalInvoiced: 0, collected: 0, outstanding: 0 },
      };
    }

    let totalInvoiced = 0;
    for (const inv of allInvoices) {
      totalInvoiced += parseFloat(String(inv.total));
    }

    const [paymentAgg] = await db.select({ total: sum(payments.amount) }).from(payments);
    const sumPayments = parseFloat(String(paymentAgg?.total ?? "0"));

    const legacyRaw = await db.execute(sql`
      SELECT COALESCE(SUM(${invoices.total}::numeric), 0)::text AS total
      FROM ${invoices}
      WHERE ${invoices.status} = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM ${payments} WHERE ${payments.invoiceId} = ${invoices.id}
        )
    `);
    const legacyRows = Array.isArray(legacyRaw)
      ? legacyRaw
      : (legacyRaw as unknown as { rows?: { total: string }[] }).rows ?? [];
    const legacyCollected = parseFloat(String((legacyRows[0] as { total?: string })?.total ?? "0"));

    const collected = sumPayments + legacyCollected;
    const outstanding = Math.max(0, totalInvoiced - collected);

    return {
      ok: true as const,
      data: {
        totalInvoiced,
        collected,
        outstanding,
      },
    };
  } catch (e) {
    console.error("getInvoiceStatsWithPayments", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load stats" };
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
      return { ok: false as const, error: getDbErrorKey(e) };
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
      return { ok: false as const, error: getDbErrorKey(e) };
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

    const linkRows = await db
      .select({
        projectId: invoiceProjects.projectId,
        name: projects.name,
      })
      .from(invoiceProjects)
      .innerJoin(projects, eq(invoiceProjects.projectId, projects.id))
      .where(eq(invoiceProjects.invoiceId, parsed.data))
      .orderBy(projects.name);

    let linkedProjectIds = linkRows.map((l) => l.projectId);
    let projectNameDisplay = linkRows.map((l) => l.name).join(", ") || null;
    if (linkedProjectIds.length === 0 && row.invoice.projectId) {
      linkedProjectIds = [row.invoice.projectId];
      projectNameDisplay = row.projectName;
    }

    return {
      ok: true as const,
      data: {
        ...row.invoice,
        clientName: row.clientName,
        clientAddress: row.clientAddress,
        clientPhone: row.clientPhone,
        projectName: projectNameDisplay,
        linkedProjectIds,
        items,
      },
    };
  } catch (e) {
    console.error("getInvoiceById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load invoice" };
  }
}

export async function getInvoiceWithPayments(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice id" };
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, parsed.data),
      with: {
        client: true,
        project: true,
        invoiceProjects: {
          with: {
            project: true,
          },
        },
        items: {
          orderBy: (items, { asc }) => [asc(items.order)],
        },
        payments: {
          orderBy: (p, { desc }) => [desc(p.paymentDate)],
        },
      },
    });

    if (!invoice) {
      return { ok: false as const, error: "Invoice not found" };
    }

    const linkedProjects =
      invoice.invoiceProjects.length > 0
        ? invoice.invoiceProjects.map((ip) => ({
            id: ip.project.id,
            name: ip.project.name,
          }))
        : invoice.project
          ? [{ id: invoice.project.id, name: invoice.project.name }]
          : [];

    const paymentSum = invoice.payments.reduce(
      (acc, p) => acc + parseFloat(String(p.amount)),
      0
    );
    const invoiceTotal = parseFloat(invoice.total);
    const totalPaid = invoiceCollectedAmount(paymentSum, invoiceTotal, invoice.status);
    const amountDue = Math.max(0, invoiceTotal - totalPaid);

    return {
      ok: true as const,
      data: {
        ...invoice,
        linkedProjects,
        totalPaid,
        amountDue,
        paymentProgress: invoiceTotal > 0 ? (totalPaid / invoiceTotal) * 100 : 0,
      },
    };
  } catch (e) {
    console.error("getInvoiceWithPayments", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load invoice" };
  }
}

export async function getOverdueInvoices() {
  try {
    const today = new Date().toISOString().split("T")[0]!;

    const overdueInvoices = await db.query.invoices.findMany({
      where: and(
        ne(invoices.status, "paid"),
        sql`coalesce(${invoices.dueDate}, ${invoices.issueDate}) < ${today}`
      ),
      with: {
        client: true,
        project: true,
      },
      orderBy: [asc(invoices.issueDate)],
    });

    const withAmounts = await Promise.all(
      overdueInvoices.map(async (inv) => {
        const paidResult = await db
          .select({ total: sum(payments.amount) })
          .from(payments)
          .where(eq(payments.invoiceId, inv.id));

        const totalPaid = parseFloat(String(paidResult[0]?.total ?? "0"));
        const amountDue = parseFloat(inv.total) - totalPaid;
        const due = inv.dueDate ?? inv.issueDate;
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(`${due}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          ...inv,
          totalPaid,
          amountDue,
          daysOverdue,
        };
      })
    );

    return { ok: true as const, data: withAmounts };
  } catch (e) {
    console.error("getOverdueInvoices", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load overdue invoices" };
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
  // Sequential invoice number is assigned from settings; `data.invoiceNumber` is ignored (UI shows next preview).
  void data.invoiceNumber;
  const mergedProjectIds = mergeProjectIds(data.projectId ?? null, data.projectIds);
  try {
    await assertProjectsBelongToClient(data.clientId, mergedProjectIds);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_PROJECTS") {
      return { ok: false as const, error: { _form: ["Invalid project selection for this client"] } };
    }
    throw e;
  }
  const primaryProjectId = mergedProjectIds[0] ?? null;

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
    const seq = settingsRow?.invoiceNextNumber ?? 1;
    const prefix = (settingsRow?.invoicePrefix ?? "INV").trim() || "INV";
    const invoiceNumber = formatInvoiceSerial(prefix, seq);

    const [inv] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        clientId: data.clientId,
        projectId: primaryProjectId,
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

    await syncInvoiceProjectLinks(inv.id, mergedProjectIds);

    await db.update(settings).set({ invoiceNextNumber: seq + 1 }).where(eq(settings.id, 1));

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${inv.id}`);
    return { ok: true as const, data: inv };
  } catch (e) {
    console.error("createInvoice", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "An unexpected error occurred."] },
    };
  }
}

export async function updateInvoice(input: UpdateInvoiceInput) {
  const parsed = updateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, lineItems, projectIds, ...data } = parsed.data;
  try {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) return { ok: false as const, error: { _form: ["Invoice not found"] } };
    if (existing.status !== "pending") {
      return { ok: false as const, error: { _form: ["Only pending invoices can be edited"] } };
    }
    const updatePayload: Record<string, unknown> = {};
    if (data.clientId !== undefined) updatePayload.clientId = data.clientId;
    if (projectIds !== undefined) {
      const merged = mergeProjectIds(null, projectIds);
      try {
        await assertProjectsBelongToClient(existing.clientId, merged);
      } catch (e) {
        if (e instanceof Error && e.message === "INVALID_PROJECTS") {
          return { ok: false as const, error: { _form: ["Invalid project selection for this client"] } };
        }
        throw e;
      }
      await syncInvoiceProjectLinks(id, merged);
      updatePayload.projectId = merged[0] ?? null;
    } else if (data.projectId !== undefined) {
      const merged = mergeProjectIds(data.projectId, undefined);
      try {
        await assertProjectsBelongToClient(existing.clientId, merged);
      } catch (e) {
        if (e instanceof Error && e.message === "INVALID_PROJECTS") {
          return { ok: false as const, error: { _form: ["Invalid project selection for this client"] } };
        }
        throw e;
      }
      await syncInvoiceProjectLinks(id, merged);
      updatePayload.projectId = merged[0] ?? null;
    }
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
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "An unexpected error occurred."] },
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
        : { status, paidAt: null, paymentMethod: null };
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
      return { ok: false as const, error: getDbErrorKey(e) };
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
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });

    if (!invoice) {
      return { ok: false as const, error: "Invoice not found" };
    }

    const paidResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.invoiceId, id));

    const paymentSum = parseFloat(String(paidResult[0]?.total ?? "0"));
    const invoiceTotalNum = parseFloat(invoice.total);
    const effectivePaid = invoiceCollectedAmount(paymentSum, invoiceTotalNum, invoice.status);
    const remaining = invoiceTotalNum - effectivePaid;

    if (remaining <= 0) {
      return { ok: false as const, error: "Invoice is already fully paid" };
    }

    let paymentDateStr = new Date().toISOString().split("T")[0]!;
    if (paidAt) {
      if (paidAt.length === 10) paymentDateStr = paidAt;
      else {
        const d = new Date(paidAt);
        if (!Number.isNaN(d.getTime())) {
          paymentDateStr = d.toISOString().slice(0, 10);
        }
      }
    }

    const paidAtForInvoice = new Date(`${paymentDateStr}T12:00:00.000Z`);

    await db.insert(payments).values({
      invoiceId: id,
      amount: remaining.toString(),
      paymentDate: paymentDateStr,
      paymentMethod: paymentMethod ?? "other",
    });

    const [row] = await db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: paidAtForInvoice,
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
      return { ok: false as const, error: getDbErrorKey(e) };
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
  const linkedIds =
    inv.linkedProjectIds?.length ? inv.linkedProjectIds : inv.projectId ? [inv.projectId] : [];
  const createRes = await createInvoice({
    clientId: inv.clientId,
    projectIds: linkedIds,
    invoiceNumber: "INV-000",
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
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete invoice",
    };
  }
}

export async function deleteInvoices(ids: string[]) {
  const parsed = z.array(z.string().uuid()).min(1).safeParse(ids);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice ids" };
  try {
    const deleted = await db.delete(invoices).where(inArray(invoices.id, parsed.data)).returning({ id: invoices.id });
    if (deleted.length === 0) return { ok: false as const, error: "No invoices found" };
    revalidatePath("/dashboard/invoices");
    return { ok: true as const, count: deleted.length };
  } catch (e) {
    console.error("deleteInvoices", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete invoices" };
  }
}

export async function getNextInvoiceNumber() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    const next = row?.invoiceNextNumber ?? 1;
    const prefix = (row?.invoicePrefix ?? "INV").trim() || "INV";
    return { ok: true as const, data: formatInvoiceSerial(prefix, next) };
  } catch (e) {
    console.error("getNextInvoiceNumber", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to get next number" };
  }
}

/** One-time migration: renumber invoices to INV-001, INV-002, … by creation order and sync settings counter. */
export async function migrateInvoicesToNewFormat() {
  try {
    const all = await db
      .select({ id: invoices.id })
      .from(invoices)
      .orderBy(invoices.createdAt);
    if (all.length === 0) {
      await db
        .update(settings)
        .set({ invoicePrefix: "INV", invoiceNextNumber: 1 })
        .where(eq(settings.id, 1));
      revalidatePath("/dashboard/invoices");
      return { ok: true as const, data: { updated: 0 } };
    }
    const prefix = "INV";
    for (let i = 0; i < all.length; i++) {
      await db
        .update(invoices)
        .set({ invoiceNumber: formatInvoiceSerial(prefix, i + 1) })
        .where(eq(invoices.id, all[i].id));
    }
    await db
      .update(settings)
      .set({ invoicePrefix: prefix, invoiceNextNumber: all.length + 1 })
      .where(eq(settings.id, 1));
    revalidatePath("/dashboard/invoices");
    return { ok: true as const, data: { updated: all.length } };
  } catch (e) {
    console.error("migrateInvoicesToNewFormat", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to migrate invoice numbers" };
  }
}

/** Admin-only: backfill `payments` for old paid invoices (same logic as `scripts/migrate-paid-invoices.ts`). */
export async function migrateLegacyPaidInvoicePayments() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }
  if (session.user.role !== "admin") {
    return { ok: false as const, error: "Forbidden" };
  }
  try {
    const result = await runLegacyPaidInvoicePaymentMigration();
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/invoices");
    return {
      ok: true as const,
      migratedCount: result.migratedCount,
      candidateCount: result.candidateCount,
      details: result.details,
    };
  } catch (e) {
    console.error("migrateLegacyPaidInvoicePayments", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Migration failed" };
  }
}
