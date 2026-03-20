"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers, projectMembers, projects, clients, expenses } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const statusValues = ["active", "inactive"] as const;

const createTeamMemberSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  role: z.string().optional(),
  email: z.string().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  status: z.enum(statusValues).default("active"),
  notes: z.string().optional().nullable(),
});

const updateTeamMemberSchema = createTeamMemberSchema.partial().extend({
  id: z.string().uuid(),
});

const assignMemberSchema = z.object({
  projectId: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  roleOnProject: z.string().optional().nullable(),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

export type TeamMemberRow = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: (typeof statusValues)[number];
  notes: string | null;
  createdAt: Date;
};

export type TeamMemberWithProjectCount = TeamMemberRow & { projectCount: number };

export async function getTeamMembers(): Promise<
  { ok: true; data: TeamMemberWithProjectCount[] } | { ok: false; error: string }
> {
  try {
    const rows = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        role: teamMembers.role,
        email: teamMembers.email,
        phone: teamMembers.phone,
        avatarUrl: teamMembers.avatarUrl,
        status: teamMembers.status,
        notes: teamMembers.notes,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .orderBy(desc(teamMembers.createdAt));

    const counts = await db
      .select({
        teamMemberId: projectMembers.teamMemberId,
        count: sql<number>`count(*)::int`,
      })
      .from(projectMembers)
      .groupBy(projectMembers.teamMemberId);

    const countMap = new Map(counts.map((c) => [c.teamMemberId, c.count]));

    const data: TeamMemberWithProjectCount[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      email: r.email,
      phone: r.phone,
      avatarUrl: r.avatarUrl,
      status: r.status as (typeof statusValues)[number],
      notes: r.notes,
      createdAt: r.createdAt,
      projectCount: countMap.get(r.id) ?? 0,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getTeamMembers", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load team members" };
  }
}

export async function getTeamMemberById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    const [row] = await db.select().from(teamMembers).where(eq(teamMembers.id, parsed.data));
    if (!row) return { ok: false as const, error: "Team member not found" };
    return {
      ok: true as const,
      data: {
        id: row.id,
        name: row.name,
        role: row.role,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatarUrl,
        status: row.status as (typeof statusValues)[number],
        notes: row.notes,
        createdAt: row.createdAt,
      },
    };
  } catch (e) {
    console.error("getTeamMemberById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load team member" };
  }
}

export async function createTeamMember(input: CreateTeamMemberInput) {
  const parsed = createTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(teamMembers)
      .values({
        name: data.name,
        role: data.role ?? null,
        email: data.email && data.email !== "" ? data.email : null,
        phone: data.phone ?? null,
        avatarUrl: data.avatarUrl && data.avatarUrl !== "" ? data.avatarUrl : null,
        status: data.status ?? "active",
        notes: data.notes ?? null,
      })
      .returning();
    if (!row) return { ok: false as const, error: "Failed to create" };
    revalidatePath("/dashboard/team");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createTeamMember", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to create team member" };
  }
}

export async function updateTeamMember(input: UpdateTeamMemberInput) {
  const parsed = updateTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.role !== undefined) payload.role = data.role ?? null;
  if (data.email !== undefined) payload.email = data.email && data.email !== "" ? data.email : null;
  if (data.phone !== undefined) payload.phone = data.phone ?? null;
  if (data.avatarUrl !== undefined) payload.avatarUrl = data.avatarUrl && data.avatarUrl !== "" ? data.avatarUrl : null;
  if (data.status !== undefined) payload.status = data.status;
  if (data.notes !== undefined) payload.notes = data.notes ?? null;
  if (Object.keys(payload).length === 0) {
    return { ok: false as const, error: "No fields to update" };
  }
  try {
    const [row] = await db
      .update(teamMembers)
      .set(payload as typeof teamMembers.$inferInsert)
      .where(eq(teamMembers.id, id))
      .returning();
    if (!row) return { ok: false as const, error: "Team member not found" };
    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${id}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateTeamMember", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update" };
  }
}

export async function deleteTeamMember(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    const [row] = await db.delete(teamMembers).where(eq(teamMembers.id, parsed.data)).returning();
    if (!row) return { ok: false as const, error: "Team member not found" };
    revalidatePath("/dashboard/team");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteTeamMember", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete" };
  }
}

export async function assignMemberToProject(
  projectId: string,
  teamMemberId: string,
  roleOnProject?: string | null
) {
  const parsed = assignMemberSchema.safeParse({ projectId, teamMemberId, roleOnProject });
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  try {
    const existing = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.teamMemberId, parsed.data.teamMemberId)
        )
      );
    if (existing.length > 0) {
      await db
        .update(projectMembers)
        .set({ roleOnProject: parsed.data.roleOnProject ?? null })
        .where(eq(projectMembers.id, existing[0].id));
    } else {
      await db.insert(projectMembers).values({
        projectId: parsed.data.projectId,
        teamMemberId: parsed.data.teamMemberId,
        roleOnProject: parsed.data.roleOnProject ?? null,
      });
    }
    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${parsed.data.teamMemberId}`);
    revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
    return { ok: true as const };
  } catch (e) {
    console.error("assignMemberToProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to assign" };
  }
}

export async function removeMemberFromProject(projectId: string, teamMemberId: string) {
  const parsed = z.object({ projectId: z.string().uuid(), teamMemberId: z.string().uuid() }).safeParse({
    projectId,
    teamMemberId,
  });
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  try {
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.teamMemberId, parsed.data.teamMemberId)
        )
      );
    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${parsed.data.teamMemberId}`);
    revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
    return { ok: true as const };
  } catch (e) {
    console.error("removeMemberFromProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to remove" };
  }
}

export type ProjectMemberRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCoverImageUrl: string | null;
  endDate: string | null;
  budget: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  projectStatus: string;
  roleOnProject: string | null;
  assignedAt: Date;
};

export async function getProjectMembers(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  try {
    const rows = await db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        projectName: projects.name,
        projectCoverImageUrl: projects.coverImageUrl,
        endDate: projects.endDate,
        budget: projects.budget,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
        projectStatus: projects.status,
        roleOnProject: projectMembers.roleOnProject,
        assignedAt: projectMembers.assignedAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projectMembers.projectId, parsed.data));

    const data: ProjectMemberRow[] = rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      projectCoverImageUrl: r.projectCoverImageUrl,
      endDate: r.endDate,
      budget: r.budget,
      clientName: r.clientName,
      clientLogoUrl: r.clientLogoUrl,
      projectStatus: r.projectStatus,
      roleOnProject: r.roleOnProject,
      assignedAt: r.assignedAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getProjectMembers", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load project members" };
  }
}

export async function getMemberProjects(teamMemberId: string) {
  const parsed = z.string().uuid().safeParse(teamMemberId);
  if (!parsed.success) return { ok: false as const, error: "Invalid team member id" };
  try {
    const rows = await db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        projectName: projects.name,
        projectCoverImageUrl: projects.coverImageUrl,
        endDate: projects.endDate,
        budget: projects.budget,
        clientName: clients.companyName,
        clientLogoUrl: clients.logoUrl,
        projectStatus: projects.status,
        roleOnProject: projectMembers.roleOnProject,
        assignedAt: projectMembers.assignedAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projectMembers.teamMemberId, parsed.data))
      .orderBy(desc(projectMembers.assignedAt));

    const data: ProjectMemberRow[] = rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      projectCoverImageUrl: r.projectCoverImageUrl,
      endDate: r.endDate,
      budget: r.budget,
      clientName: r.clientName,
      clientLogoUrl: r.clientLogoUrl,
      projectStatus: r.projectStatus,
      roleOnProject: r.roleOnProject,
      assignedAt: r.assignedAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getMemberProjects", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load projects" };
  }
}
