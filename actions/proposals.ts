"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, gte, lte, ilike, desc } from "drizzle-orm";
import { db, proposals } from "@/lib/db";
import { createClient } from "@/actions/clients";
import { createProject } from "@/actions/projects";

const proposalStatusValues = [
  "applied",
  "viewed",
  "shortlisted",
  "won",
  "lost",
  "cancelled",
] as const;

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
      end.setDate(0);
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

const createProposalSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  url: z.string().url().optional().or(z.literal("")),
  platform: z.string().default("mostaql"),
  budgetMin: z.coerce.number().min(0).optional().nullable(),
  budgetMax: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().default("SAR"),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  myBid: z.coerce.number().min(0, "عرضي مطلوب"),
  status: z.enum(proposalStatusValues).default("applied"),
  appliedAt: z.string().min(1, "تاريخ التقديم مطلوب"),
  notes: z.string().optional().nullable(),
});

const updateProposalSchema = createProposalSchema.partial().extend({
  id: z.string().uuid(),
});

const updateProposalStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(proposalStatusValues),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;

export type ProposalFilters = {
  status?: string;
  dateRange?: string;
  search?: string;
};

export async function getProposals(filters?: ProposalFilters) {
  try {
    const conditions = [];
    if (filters?.status && filters.status !== "all") {
      conditions.push(
        eq(proposals.status, filters.status as (typeof proposals.$inferSelect)["status"])
      );
    }
    if (filters?.dateRange) {
      const range = getDateRange(filters.dateRange);
      if (range) {
        conditions.push(
          gte(proposals.appliedAt, range.start.toISOString().slice(0, 10))
        );
        conditions.push(
          lte(proposals.appliedAt, range.end.toISOString().slice(0, 10))
        );
      }
    }
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(ilike(proposals.title, term));
    }
    const rows = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        url: proposals.url,
        platform: proposals.platform,
        budgetMin: proposals.budgetMin,
        budgetMax: proposals.budgetMax,
        currency: proposals.currency,
        category: proposals.category,
        description: proposals.description,
        myBid: proposals.myBid,
        status: proposals.status,
        appliedAt: proposals.appliedAt,
        notes: proposals.notes,
        clientId: proposals.clientId,
        projectId: proposals.projectId,
        createdAt: proposals.createdAt,
      })
      .from(proposals)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(proposals.appliedAt), desc(proposals.createdAt));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getProposals", e);
    return { ok: false as const, error: "Failed to load proposals" };
  }
}

export async function getProposalStats() {
  try {
    const rows = await db.select().from(proposals);
    const total = rows.length;
    const won = rows.filter((r) => r.status === "won").length;
    const wonPercent = total > 0 ? Math.round((won / total) * 100) : 0;
    const pending = rows.filter((r) =>
      ["applied", "viewed", "shortlisted"].includes(r.status)
    ).length;
    const totalWonValue = rows
      .filter((r) => r.status === "won" && r.myBid != null)
      .reduce((sum, r) => sum + Number(r.myBid), 0);
    return {
      ok: true as const,
      data: {
        total,
        won,
        wonPercent,
        pending,
        totalWonValue,
      },
    };
  } catch (e) {
    console.error("getProposalStats", e);
    return { ok: false as const, error: "Failed to load stats" };
  }
}

/** Last 6 months: { monthKey, monthLabel, won, total, ratio }. Status distribution: { status, count }[]. */
export async function getProposalStatsForCharts() {
  try {
    const rows = await db
      .select({ appliedAt: proposals.appliedAt, status: proposals.status })
      .from(proposals)
      .orderBy(desc(proposals.appliedAt));
    const now = new Date();
    const months: { monthKey: string; monthLabel: string; won: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("ar-SA", { month: "short", year: "numeric" });
      const start = monthKey + "-01";
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const end =
        monthKey +
        "-" +
        String(lastDay.getDate()).padStart(2, "0");
      const inMonth = rows.filter((r) => {
        const at = r.appliedAt ?? "";
        return at >= start && at <= end;
      });
      months.push({
        monthKey,
        monthLabel,
        won: inMonth.filter((x) => x.status === "won").length,
        total: inMonth.length,
      });
    }
    const statusCounts: Record<string, number> = {};
    for (const r of rows) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    }
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
    return {
      ok: true as const,
      data: {
        byMonth: months.map((m) => ({
          ...m,
          ratio: m.total > 0 ? Math.round((m.won / m.total) * 100) : 0,
        })),
        statusDistribution,
      },
    };
  } catch (e) {
    console.error("getProposalStatsForCharts", e);
    return { ok: false as const, error: "Failed to load chart data" };
  }
}

export async function createProposal(input: CreateProposalInput) {
  const parsed = createProposalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(proposals)
      .values({
        title: data.title,
        url: data.url || null,
        platform: data.platform,
        budgetMin: data.budgetMin != null ? String(data.budgetMin) : null,
        budgetMax: data.budgetMax != null ? String(data.budgetMax) : null,
        currency: data.currency,
        category: data.category ?? null,
        description: data.description ?? null,
        myBid: data.myBid != null ? String(data.myBid) : null,
        status: data.status,
        appliedAt: data.appliedAt,
        notes: data.notes ?? null,
      })
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Failed to create proposal"] } };
    }
    revalidatePath("/dashboard/proposals");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createProposal", e);
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Failed to create proposal"] },
    };
  }
}

export async function updateProposal(input: UpdateProposalInput) {
  const parsed = updateProposalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  try {
    const updatePayload: Record<string, unknown> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.url !== undefined) updatePayload.url = data.url || null;
    if (data.platform !== undefined) updatePayload.platform = data.platform;
    if (data.budgetMin !== undefined)
      updatePayload.budgetMin = data.budgetMin != null ? String(data.budgetMin) : null;
    if (data.budgetMax !== undefined)
      updatePayload.budgetMax = data.budgetMax != null ? String(data.budgetMax) : null;
    if (data.currency !== undefined) updatePayload.currency = data.currency;
    if (data.category !== undefined) updatePayload.category = data.category ?? null;
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.myBid !== undefined)
      updatePayload.myBid = data.myBid != null ? String(data.myBid) : null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.appliedAt !== undefined) updatePayload.appliedAt = data.appliedAt;
    if (data.notes !== undefined) updatePayload.notes = data.notes ?? null;
    await db.update(proposals).set(updatePayload).where(eq(proposals.id, id));
    revalidatePath("/dashboard/proposals");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("updateProposal", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to update proposal",
    };
  }
}

export async function updateProposalStatus(
  id: string,
  status: (typeof proposalStatusValues)[number]
) {
  const parsed = updateProposalStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid id or status" };
  }
  try {
    await db
      .update(proposals)
      .set({ status: parsed.data.status })
      .where(eq(proposals.id, parsed.data.id));
    revalidatePath("/dashboard/proposals");
    return { ok: true as const };
  } catch (e) {
    console.error("updateProposalStatus", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to update status",
    };
  }
}

export async function deleteProposal(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid proposal id" };
  }
  try {
    await db.delete(proposals).where(eq(proposals.id, parsed.data));
    revalidatePath("/dashboard/proposals");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProposal", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete proposal",
    };
  }
}

/** Create client + project from a won proposal; update proposal with client_id, project_id, status=won. Returns new client id for redirect. */
export async function convertToClient(proposalId: string) {
  const parsed = z.string().uuid().safeParse(proposalId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid proposal id" };
  }
  try {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, parsed.data));
    if (!proposal) {
      return { ok: false as const, error: "Proposal not found" };
    }
    const clientName = proposal.title?.trim() || "عميل من عرض";
    const createClientResult = await createClient({
      companyName: clientName,
      status: "lead",
      contactPhone: "—",
    });
    if (!createClientResult.ok) {
      return { ok: false as const, error: "Failed to create client" };
    }
    const newClient = createClientResult.data!;
    const projectName = proposal.title?.trim() || "مشروع من عرض";
    const budget =
      proposal.myBid != null ? Number(proposal.myBid) : undefined;
    const createProjectResult = await createProject({
      name: projectName,
      clientId: newClient.id,
      status: "lead",
      budget,
    });
    if (!createProjectResult.ok) {
      return { ok: false as const, error: "Failed to create project" };
    }
    const newProject = createProjectResult.data!;
    await db
      .update(proposals)
      .set({
        clientId: newClient.id,
        projectId: newProject.id,
        status: "won",
      })
      .where(eq(proposals.id, parsed.data));
    revalidatePath("/dashboard/proposals");
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${newClient.id}`);
    revalidatePath("/dashboard/projects");
    return { ok: true as const, data: { clientId: newClient.id } };
  } catch (e) {
    console.error("convertToClient", e);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to convert to client",
    };
  }
}
