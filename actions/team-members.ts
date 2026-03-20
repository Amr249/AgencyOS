"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers, projectMembers } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

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
      .where(eq(teamMembers.status, "active"))
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
      .where(eq(projectMembers.projectId, parsed.data));
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
    const rows = await db
      .select({
        projectId: projectMembers.projectId,
        id: teamMembers.id,
        name: teamMembers.name,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(teamMembers, eq(projectMembers.teamMemberId, teamMembers.id))
      .where(inArray(projectMembers.projectId, projectIds));
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
  const pParsed = z.string().uuid().safeParse(projectId);
  const mParsed = z.string().uuid().safeParse(teamMemberId);
  if (!pParsed.success || !mParsed.success) return { ok: false, error: "Invalid id" };
  try {
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
  const pParsed = z.string().uuid().safeParse(projectId);
  const pmParsed = z.string().uuid().safeParse(projectMemberId);
  if (!pParsed.success || !pmParsed.success) return { ok: false, error: "Invalid id" };
  try {
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
