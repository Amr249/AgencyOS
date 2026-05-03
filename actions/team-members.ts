"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers, projectMembers, projects } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { authOptions } from "@/lib/auth";
import { assertAdminSession, sessionUserRole } from "@/lib/auth-helpers";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";
import { getMemberProjectIdsForUser, memberHasProjectAccess } from "@/lib/member-context";
import { requireAgencyOrganization } from "@/lib/org-session";

export type TeamMemberRow = {
  id: string;
  name: string;
  role: string | null;
  avatarUrl: string | null;
  email: string | null;
  status: string;
};

export type ProjectMemberRow = {
  id: string;
  projectId: string;
  teamMemberId: string;
  roleOnProject: string | null;
  memberName: string;
  memberRole: string | null;
  memberAvatarUrl: string | null;
};

/** Active team members only (for dropdowns and assignment). */
export async function getTeamMembers(): Promise<
  { ok: true; data: TeamMemberRow[] } | { ok: false; error: string }
> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = sessionUserRole(session);
    if (!userId) return { ok: false, error: "Unauthorized" };

    if (role === "admin") {
      const ctx = await requireAgencyOrganization();
      const rows = await db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          role: teamMembers.role,
          avatarUrl: teamMembers.avatarUrl,
          email: teamMembers.email,
          status: teamMembers.status,
        })
        .from(teamMembers)
        .where(
          and(eq(teamMembers.status, "active"), eq(teamMembers.organizationId, ctx.organizationId))
        )
        .orderBy(asc(teamMembers.name));
      return {
        ok: true,
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          avatarUrl: r.avatarUrl,
          email: r.email,
          status: r.status,
        })),
      };
    }

    if (role === "member") {
      const ctx = await requireAgencyOrganization();
      const projectIds = await getMemberProjectIdsForUser(userId);
      if (projectIds.length === 0) {
        return { ok: true, data: [] };
      }
      const rows = await db
        .selectDistinct({
          id: teamMembers.id,
          name: teamMembers.name,
          role: teamMembers.role,
          avatarUrl: teamMembers.avatarUrl,
          email: teamMembers.email,
          status: teamMembers.status,
        })
        .from(projectMembers)
        .innerJoin(teamMembers, eq(projectMembers.teamMemberId, teamMembers.id))
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .where(
          and(
            inArray(projectMembers.projectId, projectIds),
            eq(teamMembers.status, "active"),
            eq(teamMembers.organizationId, ctx.organizationId),
            eq(projects.organizationId, ctx.organizationId)
          )
        )
        .orderBy(asc(teamMembers.name));
      return {
        ok: true,
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          avatarUrl: r.avatarUrl,
          email: r.email,
          status: r.status,
        })),
      };
    }

    return { ok: false, error: "Forbidden" };
  } catch (e) {
    console.error("getTeamMembers", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to load team members" };
  }
}

/** Members assigned to a project (for الفريق tab and avatar stack). */
export async function getProjectMembers(projectId: string): Promise<
  { ok: true; data: ProjectMemberRow[] } | { ok: false; error: string }
> {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Invalid project id" };
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = sessionUserRole(session);
    if (!userId) return { ok: false, error: "Unauthorized" };
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    if (role === "member") {
      const allowed = await memberHasProjectAccess(userId, parsed.data);
      if (!allowed) return { ok: false, error: "Forbidden" };
    } else if (role !== "admin") {
      return { ok: false, error: "Forbidden" };
    }

    const rows = await db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        teamMemberId: projectMembers.teamMemberId,
        roleOnProject: projectMembers.roleOnProject,
        memberName: teamMembers.name,
        memberRole: teamMembers.role,
        memberAvatarUrl: teamMembers.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(teamMembers, eq(projectMembers.teamMemberId, teamMembers.id))
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(eq(projectMembers.projectId, parsed.data), eq(projects.organizationId, orgId))
      );
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        teamMemberId: r.teamMemberId,
        roleOnProject: r.roleOnProject,
        memberName: r.memberName,
        memberRole: r.memberRole,
        memberAvatarUrl: r.memberAvatarUrl,
      })),
    };
  } catch (e) {
    console.error("getProjectMembers", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to load project members" };
  }
}

/** Get assigned member ids per project (for list/gallery avatar stack). */
export async function getProjectMemberIdsByProjectIds(
  projectIds: string[]
): Promise<{ ok: true; data: Record<string, { id: string; name: string; avatarUrl: string | null }[]> } | { ok: false; error: string }> {
  if (projectIds.length === 0) return { ok: true, data: {} };
  try {
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    const rows = await db
      .select({
        projectId: projectMembers.projectId,
        id: teamMembers.id,
        name: teamMembers.name,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(teamMembers, eq(projectMembers.teamMemberId, teamMembers.id))
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(inArray(projectMembers.projectId, projectIds), eq(projects.organizationId, orgId))
      );
    const data: Record<string, { id: string; name: string; avatarUrl: string | null }[]> = {};
    for (const id of projectIds) data[id] = [];
    for (const r of rows) {
      if (r.projectId) {
        if (!data[r.projectId]) data[r.projectId] = [];
        data[r.projectId].push({
          id: r.id,
          name: r.name,
          avatarUrl: r.avatarUrl,
        });
      }
    }
    return { ok: true, data };
  } catch (e) {
    console.error("getProjectMemberIdsByProjectIds", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to load project members" };
  }
}

export async function assignMemberToProject(
  projectId: string,
  teamMemberId: string,
  roleOnProject?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: "Forbidden" };
  const pParsed = z.string().uuid().safeParse(projectId);
  const mParsed = z.string().uuid().safeParse(teamMemberId);
  if (!pParsed.success || !mParsed.success) return { ok: false, error: "Invalid id" };
  try {
    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    const [projOk] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, pParsed.data), eq(projects.organizationId, orgId)))
      .limit(1);
    const [memberOk] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, mParsed.data), eq(teamMembers.organizationId, orgId)))
      .limit(1);
    if (!projOk || !memberOk) return { ok: false, error: "Invalid project or team member" };

    await db.insert(projectMembers).values({
      projectId: pParsed.data,
      teamMemberId: mParsed.data,
      roleOnProject: roleOnProject ?? null,
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath("/dashboard/projects");
    return { ok: true };
  } catch (e) {
    console.error("assignMemberToProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to assign member" };
  }
}

export async function removeMemberFromProject(
  projectId: string,
  projectMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await assertAdminSession();
  if (!gate.ok) return { ok: false, error: "Forbidden" };
  const pParsed = z.string().uuid().safeParse(projectId);
  const pmParsed = z.string().uuid().safeParse(projectMemberId);
  if (!pParsed.success || !pmParsed.success) return { ok: false, error: "Invalid id" };
  try {
    const wa = await requireWriteAccess();
    if (!wa.ok) return trialExpiredPlain();
    const ctx = await requireAgencyOrganization();
    const orgId = ctx.organizationId;
    const [projOk] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, pParsed.data), eq(projects.organizationId, orgId)))
      .limit(1);
    if (!projOk) return { ok: false, error: "Invalid project" };

    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.id, pmParsed.data),
          eq(projectMembers.projectId, pParsed.data)
        )
      );
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath("/dashboard/projects");
    return { ok: true };
  } catch (e) {
    console.error("removeMemberFromProject", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e) };
    }
    return { ok: false, error: "Failed to remove member" };
  }
}
