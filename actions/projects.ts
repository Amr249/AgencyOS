"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, and, sql, asc, desc, inArray } from "drizzle-orm";
import { db, projects, clients, phases, tasks, projectMembers } from "@/lib/db";
import { isDbConnectionError, DB_CONNECTION_ERROR_MESSAGE } from "@/lib/db-errors";

const DEFAULT_PHASES = [
  { name: "Discovery", order: 0 },
  { name: "Design", order: 1 },
  { name: "Development", order: 2 },
  { name: "Review", order: 3 },
  { name: "Launch", order: 4 },
];

const projectStatusValues = [
  "lead",
  "active",
  "on_hold",
  "review",
  "completed",
  "cancelled",
] as const;

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().uuid("Select a client"),
  status: z.enum(projectStatusValues).default("lead"),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export async function createProject(input: CreateProjectInput) {
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
    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${row.id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [DB_CONNECTION_ERROR_MESSAGE] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateProject(input: UpdateProjectInput) {
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
    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [DB_CONNECTION_ERROR_MESSAGE] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateProjectNotes(projectId: string, notes: string | null) {
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
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to save notes" };
  }
}

export async function deleteProject(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid project id" };
  }
  try {
    await db.delete(projects).where(eq(projects.id, parsed.data));
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to delete project",
    };
  }
}

export async function getProjects(filters?: {
  status?: string;
  clientId?: string;
  search?: string;
}) {
  try {
    const conditions = [isNull(projects.deletedAt)];
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
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
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
      .where(and(eq(projects.clientId, parsed.data), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getProjectsByClientId", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
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
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE, data: {} };
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
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to load project" };
  }
}

const phaseStatusValues = ["pending", "active", "completed"] as const;

export async function updatePhaseStatus(
  phaseId: string,
  status: (typeof phaseStatusValues)[number]
) {
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
      return { ok: false as const, error: DB_CONNECTION_ERROR_MESSAGE };
    }
    return { ok: false as const, error: "Failed to update phase" };
  }
}
