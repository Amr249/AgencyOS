"use server";

import { revalidatePath } from "next/cache";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { eq, isNull, and, sql, asc, desc, inArray, gt } from "drizzle-orm";
import { db, projects, clients, phases, tasks, projectMembers, expenses, timeLogs } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { authOptions } from "@/lib/auth";
import { assertAdminSession, sessionUserRole } from "@/lib/auth-helpers";
import { getMemberProjectIdsForUser, memberHasProjectAccess } from "@/lib/member-context";
import { syncProjectServices } from "@/actions/project-services";
import { logActivityWithActor } from "@/actions/activity-log";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/project-schemas";

export type { CreateProjectInput, UpdateProjectInput } from "@/lib/project-schemas";

const DEFAULT_PHASES = [
  { name: "Discovery", order: 0 },
  { name: "Design", order: 1 },
  { name: "Development", order: 2 },
  { name: "Review", order: 3 },
  { name: "Launch", order: 4 },
];

export async function createProject(input: CreateProjectInput) {
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return { ok: false as const, error: { _form: ["Forbidden"] } };
  }
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(projects)
      .values({
        name: data.name,
        clientId: data.clientId,
        status: data.status,
        coverImageUrl: data.coverImageUrl || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        budget: data.budget != null ? String(data.budget) : null,
        description: data.description ?? null,
      })
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Failed to create project"] } };
    }
    await db.insert(phases).values(
      DEFAULT_PHASES.map((p) => ({
        projectId: row.id,
        name: p.name,
        order: p.order,
      }))
    );
    if (data.teamMemberIds?.length) {
      await db.insert(projectMembers).values(
        data.teamMemberIds.map((teamMemberId) => ({
          projectId: row.id,
          teamMemberId,
        }))
      );
    }
    const syncCreate = await syncProjectServices(row.id, data.serviceIds ?? []);
    if (!syncCreate.ok) {
      return { ok: false as const, error: { _form: [syncCreate.error] } };
    }
    await logActivityWithActor({
      entityType: "project",
      entityId: row.id,
      action: "created",
      metadata: { name: row.name, clientId: row.clientId },
    });
    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${row.id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateProject(input: UpdateProjectInput) {
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return { ok: false as const, error: { _form: ["Forbidden"] } };
  }
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  try {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.clientId !== undefined) updatePayload.clientId = data.clientId;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.startDate !== undefined) updatePayload.startDate = data.startDate || null;
    if (data.endDate !== undefined) updatePayload.endDate = data.endDate || null;
    if (data.budget !== undefined)
      updatePayload.budget = data.budget != null ? String(data.budget) : null;
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.coverImageUrl !== undefined) updatePayload.coverImageUrl = data.coverImageUrl || null;

    const [row] = await db
      .update(projects)
      .set(updatePayload as typeof projects.$inferInsert)
      .where(eq(projects.id, id))
      .returning();
    if (!row) {
      return { ok: false as const, error: { _form: ["Project not found"] } };
    }
    const syncUpdate = await syncProjectServices(id, data.serviceIds);
    if (!syncUpdate.ok) {
      return { ok: false as const, error: { _form: [syncUpdate.error] } };
    }
    await logActivityWithActor({
      entityType: "project",
      entityId: id,
      action: "updated",
      metadata: { name: row.name, status: row.status, clientId: row.clientId },
    });
    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateProjectNotes(projectId: string, notes: string | null) {
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return { ok: false as const, error: "Forbidden" };
  }
  const idParsed = z.string().uuid().safeParse(projectId);
  if (!idParsed.success) {
    return { ok: false as const, error: "Invalid project id" };
  }
  try {
    const [row] = await db
      .update(projects)
      .set({ notes: notes ?? null })
      .where(eq(projects.id, idParsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Project not found" };
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateProjectNotes", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to save notes" };
  }
}

export async function deleteProject(id: string) {
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return { ok: false as const, error: "Forbidden" };
  }
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid project id" };
  }
  try {
    const [existing] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, parsed.data))
      .limit(1);
    if (!existing) {
      return { ok: false as const, error: "Project not found" };
    }
    await db.delete(projects).where(eq(projects.id, parsed.data));
    await logActivityWithActor({
      entityType: "project",
      entityId: parsed.data,
      action: "deleted",
      metadata: { name: existing.name },
    });
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete project",
    };
  }
}

export async function deleteProjects(ids: string[]) {
  const gate = await assertAdminSession();
  if (!gate.ok) {
    return { ok: false as const, error: "Forbidden" };
  }
  const parsed = z.array(z.string().uuid()).safeParse(ids);
  if (!parsed.success || ids.length === 0) {
    return { ok: false as const, error: "Invalid project ids" };
  }
  try {
    await db.delete(projects).where(inArray(projects.id, parsed.data));
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProjects", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete projects",
    };
  }
}

export async function getProjects(filters?: {
  status?: string;
  clientId?: string;
  search?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = sessionUserRole(session);
    if (!userId) return { ok: false as const, error: "Unauthorized" };
    if (role !== "admin" && role !== "member") {
      return { ok: false as const, error: "Forbidden" };
    }

    const conditions = [isNull(projects.deletedAt)];
    if (role === "member") {
      const memberIds = await getMemberProjectIdsForUser(userId);
      if (memberIds.length === 0) {
        return { ok: true as const, data: [] };
      }
      conditions.push(inArray(projects.id, memberIds));
    }
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(projects.status, filters.status as (typeof projects.$inferSelect)["status"]));
    }
    if (filters?.clientId) {
      conditions.push(eq(projects.clientId, filters.clientId));
    }
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(${projects.name} ilike ${term} OR ${clients.companyName} ilike ${term})`
      );
    }
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        status: projects.status,
        coverImageUrl: projects.coverImageUrl,
        startDate: projects.startDate,
        endDate: projects.endDate,
        budget: projects.budget,
        description: projects.description,
        notes: projects.notes,
        createdAt: projects.createdAt,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(asc(projects.endDate), asc(projects.name));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getProjects", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load projects" };
  }
}

export async function getProjectsByClientId(clientId: string) {
  const parsed = z.string().uuid().safeParse(clientId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid client id" };
  }
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = sessionUserRole(session);
    if (!userId) return { ok: false as const, error: "Unauthorized" };
    if (role !== "admin" && role !== "member") {
      return { ok: false as const, error: "Forbidden" };
    }

    const memberProjectIds =
      role === "member" ? await getMemberProjectIdsForUser(userId) : null;
    if (role === "member" && (!memberProjectIds || memberProjectIds.length === 0)) {
      return { ok: true as const, data: [] };
    }

    const byClientConditions = [
      eq(projects.clientId, parsed.data),
      isNull(projects.deletedAt),
    ];
    if (memberProjectIds && memberProjectIds.length > 0) {
      byClientConditions.push(inArray(projects.id, memberProjectIds));
    }

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        status: projects.status,
        coverImageUrl: projects.coverImageUrl,
        startDate: projects.startDate,
        endDate: projects.endDate,
        budget: projects.budget,
        description: projects.description,
        notes: projects.notes,
        createdAt: projects.createdAt,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...byClientConditions))
      .orderBy(desc(projects.createdAt));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getProjectsByClientId", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load projects" };
  }
}

export async function getProjectTaskCounts(projectIds: string[]) {
  if (projectIds.length === 0) return { ok: true as const, data: {} as Record<string, { total: number; done: number }> };
  try {
    const result = await db
      .select({
        projectId: tasks.projectId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)))
      .groupBy(tasks.projectId);
    const map: Record<string, { total: number; done: number }> = {};
    for (const id of projectIds) map[id] = { total: 0, done: 0 };
    for (const row of result) {
      if (row.projectId) map[row.projectId] = { total: row.total, done: row.done };
    }
    return { ok: true as const, data: map };
  } catch (e) {
    console.error("getProjectTaskCounts", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: {} };
    }
    return { ok: false as const, error: "Failed to load task counts", data: {} };
  }
}

export async function getProjectById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid project id" };
  }
  try {
    const [row] = await db
      .select({
        project: projects,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, parsed.data));
    if (!row || row.project.deletedAt) {
      return { ok: false as const, error: "Project not found" };
    }

    const session = await getServerSession(authOptions);
    const uid = session?.user?.id;
    if (sessionUserRole(session) === "member" && uid) {
      const allowed = await memberHasProjectAccess(uid, parsed.data);
      if (!allowed) {
        return { ok: false as const, error: "Forbidden" };
      }
    } else if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const projectPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.projectId, parsed.data))
      .orderBy(phases.order);
    return {
      ok: true as const,
      data: {
        ...row.project,
        clientName: row.clientName,
        clientLogoUrl: row.clientLogoUrl,
        phases: projectPhases,
      },
    };
  } catch (e) {
    console.error("getProjectById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load project" };
  }
}

/** Green: ratio under 0.9. Yellow: 0.9–1.1. Red: above 1.1 (projected ÷ budget). */
export type BudgetBurnProjectionTone = "positive" | "caution" | "critical";

export type ProjectBudgetBurnRate = {
  /** Total spent ÷ days elapsed since start (min 1 day). */
  dailyBurnSar: number;
  daysElapsed: number;
  /** Inclusive calendar days from start → end; null if dates missing. */
  projectDurationDays: number | null;
  /** dailyBurn × project duration; null without end date. */
  projectedTotalSar: number | null;
  /** max(0, projected − budget); null if no projection or under budget. */
  projectedOverspendSar: number | null;
  /** Remaining ÷ daily burn (floored whole days); null if burn is 0 and still under budget. */
  daysUntilBudgetRunsOut: number | null;
  projectionTone: BudgetBurnProjectionTone | null;
};

export type ProjectBudgetSummaryData = {
  budget: number;
  expensesTotal: number;
  timeCost: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  /** Null when project has no start date, or start is in the future. */
  burnRate: ProjectBudgetBurnRate | null;
};

function parsePositiveBudget(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseProjectDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isNaN(t) ? null : startOfDay(raw);
  }
  const s = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

function deriveBurnProjectionTone(
  projectedTotal: number | null,
  budget: number
): BudgetBurnProjectionTone | null {
  if (projectedTotal == null || budget <= 0) return null;
  const ratio = projectedTotal / budget;
  if (ratio > 1.1) return "critical";
  if (ratio >= 0.9) return "caution";
  return "positive";
}

/**
 * Budget health: expenses on the project + time cost (hours × hourly_rate per log, or
 * DEFAULT_INTERNAL_HOURLY_RATE_SAR when a log has no rate).
 * Returns `data: null` when the project has no positive budget (widget hidden).
 */
export async function getProjectBudgetSummary(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  try {
    const session = await getServerSession(authOptions);
    if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    const [proj] = await db
      .select({
        budget: projects.budget,
        startDate: projects.startDate,
        endDate: projects.endDate,
      })
      .from(projects)
      .where(eq(projects.id, parsed.data))
      .limit(1);
    if (!proj) return { ok: false as const, error: "Project not found" };

    const budgetNum = parsePositiveBudget(proj.budget ?? undefined);
    if (budgetNum == null) {
      return { ok: true as const, data: null };
    }

    const [expRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(eq(expenses.projectId, parsed.data));
    const expensesTotal = Math.round(parseFloat(expRow?.total || "0") * 100) / 100;

    const logs = await db
      .select({ hours: timeLogs.hours, hourlyRate: timeLogs.hourlyRate })
      .from(timeLogs)
      .where(and(eq(timeLogs.projectId, parsed.data), gt(timeLogs.hours, "0")));

    const envRaw = process.env.DEFAULT_INTERNAL_HOURLY_RATE_SAR;
    const parsedDefault =
      envRaw != null && envRaw !== "" ? Number(envRaw) : NaN;
    const defaultHourly =
      Number.isFinite(parsedDefault) && parsedDefault >= 0 ? parsedDefault : 0;

    let timeCost = 0;
    for (const row of logs) {
      const h = Number(row.hours) || 0;
      const rateRaw = row.hourlyRate;
      const hasRate = rateRaw != null && String(rateRaw).trim() !== "";
      const r = hasRate ? Number(rateRaw) : defaultHourly;
      const effective = Number.isFinite(r) ? r : 0;
      timeCost += h * effective;
    }
    timeCost = Math.round(timeCost * 100) / 100;

    const totalSpent = Math.round((expensesTotal + timeCost) * 100) / 100;
    const remaining = Math.round((budgetNum - totalSpent) * 100) / 100;
    const percentUsed =
      budgetNum > 0 ? Math.round((totalSpent / budgetNum) * 1000) / 10 : 0;

    const today = startOfDay(new Date());
    const startD = parseProjectDate(proj.startDate);
    const endD = parseProjectDate(proj.endDate);

    let burnRate: ProjectBudgetBurnRate | null = null;
    if (startD && startD <= today) {
      const daysElapsed = Math.max(1, differenceInCalendarDays(today, startD) + 1);
      const dailyBurnRaw = totalSpent / daysElapsed;
      const dailyBurnSar = Math.round(dailyBurnRaw * 100) / 100;

      let projectDurationDays: number | null = null;
      if (endD && startD && endD >= startD) {
        projectDurationDays = Math.max(1, differenceInCalendarDays(endD, startD) + 1);
      }

      const projectedTotalSar =
        projectDurationDays != null
          ? Math.round(dailyBurnRaw * projectDurationDays * 100) / 100
          : null;

      const projectionTone = deriveBurnProjectionTone(projectedTotalSar, budgetNum);

      let projectedOverspendSar: number | null = null;
      if (projectedTotalSar != null && projectedTotalSar > budgetNum) {
        projectedOverspendSar = Math.round((projectedTotalSar - budgetNum) * 100) / 100;
      }

      let daysUntilBudgetRunsOut: number | null = null;
      if (dailyBurnRaw > 0) {
        daysUntilBudgetRunsOut = Math.max(0, Math.floor(remaining / dailyBurnRaw));
      } else if (remaining > 0) {
        daysUntilBudgetRunsOut = null;
      } else {
        daysUntilBudgetRunsOut = 0;
      }

      burnRate = {
        dailyBurnSar,
        daysElapsed,
        projectDurationDays,
        projectedTotalSar,
        projectedOverspendSar,
        daysUntilBudgetRunsOut,
        projectionTone,
      };
    }

    const data: ProjectBudgetSummaryData = {
      budget: budgetNum,
      expensesTotal,
      timeCost,
      totalSpent,
      remaining,
      percentUsed,
      burnRate,
    };
    return { ok: true as const, data };
  } catch (e) {
    console.error("getProjectBudgetSummary", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load budget summary" };
  }
}

const phaseStatusValues = ["pending", "active", "completed"] as const;

export async function updatePhaseStatus(
  phaseId: string,
  status: (typeof phaseStatusValues)[number]
) {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false as const, error: "Forbidden" };
  const idParsed = z.string().uuid().safeParse(phaseId);
  if (!idParsed.success) return { ok: false as const, error: "Invalid phase id" };
  try {
    const [row] = await db
      .update(phases)
      .set({ status })
      .where(eq(phases.id, idParsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Phase not found" };
    revalidatePath(`/dashboard/projects/${row.projectId}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updatePhaseStatus", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update phase" };
  }
}
