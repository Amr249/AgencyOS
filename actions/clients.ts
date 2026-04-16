"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { and, asc, count, eq, inArray, isNotNull, isNull, sum } from "drizzle-orm";
import {
  db,
  clientServices,
  clientTagAssignments,
  clientTags,
  clients,
  invoices,
  payments,
  projects,
  services,
} from "@/lib/db";
import { CLIENT_SOURCE_VALUES, type ClientSourceValue } from "@/lib/client-constants";
import {
  appendClientLossNoteBlock,
  CLIENT_LOSS_CATEGORY_LABEL_EN,
  CLIENT_LOSS_CATEGORIES,
} from "@/lib/client-loss";
import { rollupRevenueByClient } from "@/lib/client-revenue-stats";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";

export async function deleteClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    await db.delete(clients).where(eq(clients.id, parsed.data));
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete client",
    };
  }
}

export async function deleteClients(ids: string[]) {
  const uuidSchema = z.array(z.string().uuid());
  const parsed = uuidSchema.safeParse(ids);
  if (!parsed.success || ids.length === 0) {
    return { ok: false as const, error: "Invalid client ids" };
  }
  try {
    await db.delete(clients).where(inArray(clients.id, parsed.data));
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteClients", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete clients",
    };
  }
}

const clientSourceEnum = CLIENT_SOURCE_VALUES as unknown as [
  ClientSourceValue,
  ...ClientSourceValue[],
];

const optionalSourceSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.enum(clientSourceEnum).nullable().optional()
);

const optionalSourceDetailsSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().nullable().optional()
);

const clientLossCategorySchema = z.enum(CLIENT_LOSS_CATEGORIES);

const createClientBaseSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  status: z.enum(["lead", "active", "on_hold", "completed", "closed"]).default("lead"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Phone is required"),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  source: optionalSourceSchema,
  sourceDetails: optionalSourceDetailsSchema,
  serviceIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  lossCategory: clientLossCategorySchema.optional(),
  lossNotes: z.string().max(5000).optional(),
});

const createClientSchema = createClientBaseSchema.superRefine((data, ctx) => {
  if (data.status === "closed") {
    if (!data.lossCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Loss category is required",
        path: ["lossCategory"],
      });
    }
    if (!data.lossNotes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required",
        path: ["lossNotes"],
      });
    }
  }
});

const updateClientSchema = createClientBaseSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

async function syncClientTags(clientId: string, tagIds: string[]) {
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length > 0) {
    const existing = await db
      .select({ id: clientTags.id })
      .from(clientTags)
      .where(inArray(clientTags.id, uniqueIds));
    if (existing.length !== uniqueIds.length) {
      throw new Error("Invalid tag id");
    }
  }
  await db.delete(clientTagAssignments).where(eq(clientTagAssignments.clientId, clientId));
  if (uniqueIds.length > 0) {
    await db.insert(clientTagAssignments).values(
      uniqueIds.map((tagId) => ({ clientId, tagId }))
    );
  }
}

export async function createClient(input: CreateClientInput) {
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const isLost = data.status === "closed";
    const categoryLabel =
      isLost && data.lossCategory
        ? CLIENT_LOSS_CATEGORY_LABEL_EN[data.lossCategory]
        : null;
    const notesValue =
      isLost && data.lossCategory && data.lossNotes?.trim()
        ? appendClientLossNoteBlock({
            existingNotes: data.notes ?? "",
            categoryLabel: categoryLabel!,
            why: data.lossNotes.trim(),
            lostDateIso: today,
          })
        : (data.notes ?? null);

    const [row] = await db
      .insert(clients)
      .values({
        companyName: data.companyName,
        status: data.status,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone ?? null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
        notes: notesValue,
        source: data.source ?? null,
        sourceDetails: data.sourceDetails?.trim() ? data.sourceDetails.trim() : null,
        ...(isLost && categoryLabel
          ? {
              wonLostReason: categoryLabel,
              wonLostDate: today,
              dealValue: null,
            }
          : {}),
      })
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Failed to create client"] } };
    }
    if (data.serviceIds?.length) {
      await db.insert(clientServices).values(
        data.serviceIds.map((serviceId) => ({
          clientId: row.id,
          serviceId,
        }))
      );
    }
    if (data.tagIds !== undefined) {
      await syncClientTags(row.id, data.tagIds);
    }
    await logActivityWithActor({
      entityType: "client",
      entityId: row.id,
      action: "created",
      metadata: { companyName: row.companyName },
    });
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateClient(input: UpdateClientInput) {
  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  try {
    const [prev] = await db
      .select({ status: clients.status, notes: clients.notes })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    if (!prev) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }

    const transitioningToClosed =
      data.status === "closed" && prev.status !== "closed";

    if (transitioningToClosed) {
      const fieldErrors: Record<string, string[]> = {};
      if (!data.lossCategory) {
        fieldErrors.lossCategory = ["Loss category is required"];
      }
      if (!data.lossNotes?.trim()) {
        fieldErrors.lossNotes = ["Notes are required"];
      }
      if (Object.keys(fieldErrors).length > 0) {
        return { ok: false as const, error: fieldErrors };
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (data.companyName !== undefined) updatePayload.companyName = data.companyName;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.contactName !== undefined) updatePayload.contactName = data.contactName;
    if (data.contactEmail !== undefined)
      updatePayload.contactEmail = data.contactEmail || null;
    if (data.contactPhone !== undefined) updatePayload.contactPhone = data.contactPhone;
    if (data.website !== undefined) updatePayload.website = data.website || null;
    if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl || null;
    if (transitioningToClosed) {
      const today = new Date().toISOString().slice(0, 10);
      const categoryLabel = CLIENT_LOSS_CATEGORY_LABEL_EN[data.lossCategory!];
      const notesBase =
        data.notes !== undefined ? (data.notes ?? "") : (prev.notes ?? "");
      updatePayload.notes = appendClientLossNoteBlock({
        existingNotes: notesBase,
        categoryLabel,
        why: data.lossNotes!.trim(),
        lostDateIso: today,
      });
      updatePayload.wonLostReason = categoryLabel;
      updatePayload.wonLostDate = today;
      updatePayload.dealValue = null;
    } else if (data.notes !== undefined) {
      updatePayload.notes = data.notes;
    }
    if (data.source !== undefined) updatePayload.source = data.source;
    if (data.sourceDetails !== undefined) {
      updatePayload.sourceDetails =
        data.sourceDetails && data.sourceDetails.trim() !== "" ? data.sourceDetails.trim() : null;
    }
    const serviceIds = data.serviceIds;
    const tagIds = data.tagIds;

    const [row] = await db
      .update(clients)
      .set(updatePayload as typeof clients.$inferInsert)
      .where(eq(clients.id, id))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }

    if (data.status !== undefined && data.status !== prev.status) {
      await logActivityWithActor({
        entityType: "client",
        entityId: id,
        action: "status_changed",
        metadata: { fromStatus: prev.status, toStatus: data.status },
      });
    }
    {
      const prevNotesNorm = prev.notes ?? "";
      const nextNotesNorm = row.notes ?? "";
      if (prevNotesNorm !== nextNotesNorm) {
        await logActivityWithActor({
          entityType: "client",
          entityId: id,
          action: "notes_updated",
          metadata: {},
        });
      }
    }
    if (serviceIds !== undefined) {
      await db.delete(clientServices).where(eq(clientServices.clientId, id));
      if (serviceIds.length) {
        await db.insert(clientServices).values(
          serviceIds.map((serviceId) => ({
            clientId: id,
            serviceId,
          }))
        );
      }
    }
    if (tagIds !== undefined) {
      await syncClientTags(id, tagIds);
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function archiveClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const [row] = await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(eq(clients.id, parsed.data))
      .returning();
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("archiveClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to archive client",
    };
  }
}

async function loadPaymentSumByInvoiceIds(
  invoiceIds: string[]
): Promise<Map<string, number>> {
  if (invoiceIds.length === 0) return new Map();
  const rows = await db
    .select({
      invoiceId: payments.invoiceId,
      paid: sum(payments.amount),
    })
    .from(payments)
    .where(inArray(payments.invoiceId, invoiceIds))
    .groupBy(payments.invoiceId);
  return new Map(rows.map((r) => [r.invoiceId, Number(r.paid ?? 0)]));
}

async function mergeProjectCounts<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { projectCount: number }>> {
  if (rows.length === 0) return [];
  const countRows = await db
    .select({
      clientId: projects.clientId,
      n: count(),
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.clientId);
  const countMap = new Map(countRows.map((r) => [r.clientId, Number(r.n)]));
  return rows.map((c) => ({
    ...c,
    projectCount: countMap.get(c.id) ?? 0,
  }));
}

export type ClientRevenueStats = {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  projectCount: number;
  avgProjectValue: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  lifetimeValue: number;
};

export async function getClientRevenueStats(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const id = parsed.data;
    const [projectRow] = await db
      .select({ n: count() })
      .from(projects)
      .where(and(eq(projects.clientId, id), isNull(projects.deletedAt)));
    const projectCount = Number(projectRow?.n ?? 0);

    const invRows = await db
      .select({
        id: invoices.id,
        clientId: invoices.clientId,
        total: invoices.total,
        status: invoices.status,
        issueDate: invoices.issueDate,
      })
      .from(invoices)
      .where(eq(invoices.clientId, id));

    const payMap = await loadPaymentSumByInvoiceIds(invRows.map((r) => r.id));
    const rollup = rollupRevenueByClient(invRows, payMap).get(id);

    const totalInvoiced = rollup?.totalInvoiced ?? 0;
    const totalPaid = rollup?.totalPaid ?? 0;
    const totalOutstanding = rollup?.totalOutstanding ?? 0;
    const firstInvoiceDate = rollup?.firstInvoiceDate ?? null;
    const lastInvoiceDate = rollup?.lastInvoiceDate ?? null;
    const avgProjectValue =
      projectCount > 0 ? Math.round((totalInvoiced / projectCount) * 100) / 100 : 0;

    return {
      ok: true as const,
      data: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        projectCount,
        avgProjectValue,
        firstInvoiceDate,
        lastInvoiceDate,
        lifetimeValue: totalPaid,
      } satisfies ClientRevenueStats,
    };
  } catch (e) {
    console.error("getClientRevenueStats", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client revenue stats" };
  }
}

export type ClientTagSummary = { id: string; name: string; color: string };

export type ClientWithStatsRow = typeof clients.$inferSelect & {
  projectCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  lifetimeValue: number;
  avgProjectValue: number;
  tags: ClientTagSummary[];
};

async function attachRevenueStatsToClients<T extends { id: string }>(
  rows: T[]
): Promise<
  Array<
    T & {
      projectCount: number;
      totalInvoiced: number;
      totalPaid: number;
      totalOutstanding: number;
      lifetimeValue: number;
      avgProjectValue: number;
    }
  >
> {
  const withProjects = await mergeProjectCounts(rows);
  if (withProjects.length === 0) return [];

  const clientIds = withProjects.map((c) => c.id);
  const invRows = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      total: invoices.total,
      status: invoices.status,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .where(inArray(invoices.clientId, clientIds));

  const payMap = await loadPaymentSumByInvoiceIds(invRows.map((r) => r.id));
  const rollup = rollupRevenueByClient(invRows, payMap);

  return withProjects.map((c) => {
    const r = rollup.get(c.id);
    const totalInvoiced = r?.totalInvoiced ?? 0;
    const totalPaid = r?.totalPaid ?? 0;
    const totalOutstanding = r?.totalOutstanding ?? 0;
    const pc = c.projectCount;
    return {
      ...c,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      lifetimeValue: totalPaid,
      avgProjectValue: pc > 0 ? Math.round((totalInvoiced / pc) * 100) / 100 : 0,
    };
  });
}

export type ClientPipelineItem = typeof clients.$inferSelect & {
  projectCount: number;
  tags: ClientTagSummary[];
  potentialValue: string | null;
};

async function mergeClientTagSummaries<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { tags: ClientTagSummary[] }>> {
  if (rows.length === 0) return [];
  const clientIds = rows.map((r) => r.id);
  const tagRows = await db
    .select({
      clientId: clientTagAssignments.clientId,
      id: clientTags.id,
      name: clientTags.name,
      color: clientTags.color,
    })
    .from(clientTagAssignments)
    .innerJoin(clientTags, eq(clientTagAssignments.tagId, clientTags.id))
    .where(inArray(clientTagAssignments.clientId, clientIds))
    .orderBy(asc(clientTags.name));
  const map = new Map<string, ClientTagSummary[]>();
  for (const id of clientIds) map.set(id, []);
  for (const r of tagRows) {
    map.get(r.clientId)?.push({ id: r.id, name: r.name, color: r.color });
  }
  return rows.map((c) => ({
    ...c,
    tags: map.get(c.id) ?? [],
  }));
}

async function mergePipelinePotentialValue<T extends { id: string }>(
  rows: T[]
): Promise<Array<T & { potentialValue: string | null }>> {
  if (rows.length === 0) return [];
  const clientIds = rows.map((r) => r.id);
  const sumRows = await db
    .select({
      clientId: projects.clientId,
      total: sum(projects.budget),
    })
    .from(projects)
    .where(and(isNull(projects.deletedAt), inArray(projects.clientId, clientIds)))
    .groupBy(projects.clientId);
  const map = new Map<string, string | null>();
  for (const r of sumRows) {
    const raw = r.total;
    if (raw == null) {
      map.set(r.clientId, null);
      continue;
    }
    const s = String(raw);
    const n = Number(s);
    map.set(r.clientId, !Number.isNaN(n) && n > 0 ? s : null);
  }
  return rows.map((c) => ({
    ...c,
    potentialValue: map.get(c.id) ?? null,
  }));
}

/** Active and archived client rows with project counts and revenue rollups (payments + legacy paid). */
export async function getAllClientsWithStats() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const [activeList, archivedList] = await Promise.all([
      db
        .select()
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(clients.companyName),
      db
        .select()
        .from(clients)
        .where(isNotNull(clients.deletedAt))
        .orderBy(clients.companyName),
    ]);
    const [active, archived] = await Promise.all([
      attachRevenueStatsToClients(activeList),
      attachRevenueStatsToClients(archivedList),
    ]);
    const [activeWithTags, archivedWithTags] = await Promise.all([
      mergeClientTagSummaries(active),
      mergeClientTagSummaries(archived),
    ]);
    return { ok: true as const, data: { active: activeWithTags, archived: archivedWithTags } };
  } catch (e) {
    console.error("getAllClientsWithStats", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load clients with stats" };
  }
}

export async function getClientsList() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const list = await db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.companyName);
    const data = await mergeProjectCounts(list);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getClientsList", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load clients" };
  }
}

/** Active clients with project counts and assigned tags (for list / CRM views). */
export async function getClientsWithTags() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const list = await db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.companyName);
    const withCounts = await mergeProjectCounts(list);
    const data = await mergeClientTagSummaries(withCounts);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getClientsWithTags", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load clients" };
  }
}

/** All clients (active + archived) with tags and summed project budgets (pipeline potential value). */
export async function getClientsForPipeline() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const list = await db
      .select()
      .from(clients)
      .orderBy(clients.companyName);
    const withCounts = await mergeProjectCounts(list);
    const withTags = await mergeClientTagSummaries(withCounts);
    const data = await mergePipelinePotentialValue(withTags);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getClientsForPipeline", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load clients" };
  }
}

export async function getArchivedClientsList() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const list = await db
      .select()
      .from(clients)
      .where(isNotNull(clients.deletedAt))
      .orderBy(clients.companyName);
    const data = await mergeProjectCounts(list);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getArchivedClientsList", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load archived clients" };
  }
}

/** Archived clients with project counts and tags (for list UI). */
export async function getArchivedClientsWithTags() {
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const list = await db
      .select()
      .from(clients)
      .where(isNotNull(clients.deletedAt))
      .orderBy(clients.companyName);
    const withCounts = await mergeProjectCounts(list);
    const data = await mergeClientTagSummaries(withCounts);
    return { ok: true as const, data };
  } catch (e) {
    console.error("getArchivedClientsWithTags", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load archived clients" };
  }
}

export async function unarchiveClient(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const [row] = await db
      .update(clients)
      .set({ deletedAt: null })
      .where(eq(clients.id, parsed.data))
      .returning();
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard/crm/pipeline");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("unarchiveClient", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to restore client",
    };
  }
}

export async function getClientById(id: string) {
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const [row] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, parsed.data));
    if (!row) {
      return { ok: false as const, error: "Client not found" };
    }
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("getClientById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client" };
  }
}

export async function getClientServiceIds(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const rows = await db
      .select({ serviceId: clientServices.serviceId })
      .from(clientServices)
      .where(eq(clientServices.clientId, parsed.data));
    return { ok: true as const, data: rows.map((r) => r.serviceId) };
  } catch (e) {
    console.error("getClientServiceIds", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client services" };
  }
}

export async function getServiceIdsByClientIds(clientIds: string[]) {
  if (clientIds.length === 0) return { ok: true as const, data: {} as Record<string, { id: string; name: string; status: string }[]> };
  const parsed = z.array(z.string().uuid()).safeParse(clientIds);
  if (!parsed.success) return { ok: false as const, error: "Invalid client ids" };
  try {
    const rows = await db
      .select({
        clientId: clientServices.clientId,
        serviceId: services.id,
        serviceName: services.name,
        serviceStatus: services.status,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .where(inArray(clientServices.clientId, parsed.data));
    const data: Record<string, { id: string; name: string; status: string }[]> = {};
    for (const id of parsed.data) data[id] = [];
    for (const row of rows) {
      data[row.clientId]?.push({
        id: row.serviceId,
        name: row.serviceName,
        status: row.serviceStatus,
      });
    }
    return { ok: true as const, data };
  } catch (e) {
    console.error("getServiceIdsByClientIds", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load client services map" };
  }
}
