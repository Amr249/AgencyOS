"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, asc, eq, gte, inArray, isNull, lte, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getTeamMemberIdsForSessionUser, memberHasProjectAccess } from "@/lib/member-context";
import {
  milestones,
  projects,
  tasks,
  milestoneTeamMembers,
  projectMembers,
  teamMembers,
} from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";

const milestoneStatusValues = ["pending", "in_progress", "completed", "cancelled"] as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const createMilestoneSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    startDate: dateStr,
    dueDate: dateStr,
    teamMemberIds: z.array(z.string().uuid()).optional().default([]),
    status: z.enum(milestoneStatusValues).optional().default("pending"),
  })
  .refine((d) => d.startDate <= d.dueDate, {
    message: "End date must be on or after start date",
    path: ["dueDate"],
  });

const updateMilestoneSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    startDate: dateStr.optional(),
    dueDate: dateStr.optional(),
    teamMemberIds: z.array(z.string().uuid()).optional(),
    status: z.enum(milestoneStatusValues).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.dueDate) return d.startDate <= d.dueDate;
      return true;
    },
    { message: "End date must be on or after start date", path: ["dueDate"] }
  );

const upcomingDaysSchema = z.number().int().min(1).max(365).optional().default(14);

function endDateAfterDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function revalidateMilestonePaths(projectId: string) {
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard");
}

function uniqueTeamMemberIds(ids: string[]) {
  return [...new Set(ids)];
}

async function validateTeamMembersForProject(projectId: string, teamMemberIds: string[]) {
  const unique = uniqueTeamMemberIds(teamMemberIds);
  if (unique.length === 0) return { ok: true as const };
  const rows = await db
    .select({ id: projectMembers.teamMemberId })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), inArray(projectMembers.teamMemberId, unique))
    );
  const set = new Set(rows.map((r) => r.id));
  for (const id of unique) {
    if (!set.has(id)) return { ok: false as const, error: "Each assignee must be on the project team." };
  }
  return { ok: true as const };
}

async function replaceMilestoneTeamMembers(milestoneId: string, teamMemberIds: string[]) {
  const unique = uniqueTeamMemberIds(teamMemberIds);
  await db.delete(milestoneTeamMembers).where(eq(milestoneTeamMembers.milestoneId, milestoneId));
  if (unique.length === 0) return;
  await db.insert(milestoneTeamMembers).values(
    unique.map((teamMemberId) => ({
      milestoneId,
      teamMemberId,
    }))
  );
}

export async function createMilestone(input: z.input<typeof createMilestoneSchema>) {
  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const [projectExists] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1);
    if (!projectExists) {
      return { ok: false as const, error: "Project not found" };
    }

    const teamIds = uniqueTeamMemberIds(parsed.data.teamMemberIds);
    const v = await validateTeamMembersForProject(parsed.data.projectId, teamIds);
    if (!v.ok) return { ok: false as const, error: v.error };

    const [row] = await db
      .insert(milestones)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        startDate: parsed.data.startDate,
        dueDate: parsed.data.dueDate,
        status: parsed.data.status,
        completedAt: parsed.data.status === "completed" ? new Date() : null,
      })
      .returning();

    if (!row) return { ok: false as const, error: "Failed to create milestone" };

    await replaceMilestoneTeamMembers(row.id, teamIds);

    await logActivityWithActor({
      entityType: "milestone",
      entityId: row.id,
      action: "created",
      metadata: {
        name: row.name,
        projectId: row.projectId,
        startDate: row.startDate,
        dueDate: row.dueDate,
      },
    });
    await revalidateMilestonePaths(row.projectId);
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to create milestone" };
  }
}

export async function updateMilestone(input: z.input<typeof updateMilestoneSchema>) {
  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const { id, teamMemberIds, ...rest } = parsed.data;
  const payload: Record<string, unknown> = {};
  if (rest.name !== undefined) payload.name = rest.name;
  if (rest.description !== undefined) payload.description = rest.description ?? null;
  if (rest.startDate !== undefined) payload.startDate = rest.startDate;
  if (rest.dueDate !== undefined) payload.dueDate = rest.dueDate;
  if (rest.status !== undefined) payload.status = rest.status;
  if (rest.sortOrder !== undefined) payload.sortOrder = rest.sortOrder;

  if (Object.keys(payload).length === 0 && teamMemberIds === undefined) {
    return { ok: false as const, error: "No fields to update" };
  }

  try {
    const [existing] = await db
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, id))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Milestone not found" };

    if (teamMemberIds !== undefined) {
      const v = await validateTeamMembersForProject(existing.projectId, teamMemberIds);
      if (!v.ok) return { ok: false as const, error: v.error };
    }

    if (rest.status === "completed") {
      payload.completedAt = new Date();
    } else if (rest.status !== undefined) {
      payload.completedAt = null;
    }

    let row: typeof milestones.$inferSelect | undefined;
    if (Object.keys(payload).length > 0) {
      const [updated] = await db.update(milestones).set(payload).where(eq(milestones.id, id)).returning();
      row = updated;
    } else {
      const [r] = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1);
      row = r;
    }

    if (!row) return { ok: false as const, error: "Milestone not found" };

    if (teamMemberIds !== undefined) {
      await replaceMilestoneTeamMembers(id, teamMemberIds);
    }

    await revalidateMilestonePaths(row.projectId);
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update milestone" };
  }
}

export async function deleteMilestone(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid milestone id" };

  try {
    const [row] = await db.delete(milestones).where(eq(milestones.id, parsed.data)).returning();
    if (!row) return { ok: false as const, error: "Milestone not found" };

    await revalidateMilestonePaths(row.projectId);
    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete milestone" };
  }
}

export type MilestoneAssigneeRow = { teamMemberId: string; name: string; avatarUrl: string | null };

type MilestoneCoreRow = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: string;
  dueDate: string;
  status: (typeof milestoneStatusValues)[number];
  completedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
};

async function attachMilestoneProgress(rows: MilestoneCoreRow[]) {
  const ids = rows.map((r) => r.id);
  const progressById: Record<string, { total: number; completed: number; percent: number }> = {};
  const assigneesById: Record<string, MilestoneAssigneeRow[]> = {};

  if (ids.length > 0) {
    const [progressRows, assigneeRows] = await Promise.all([
      db
        .select({
          milestoneId: tasks.milestoneId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        })
        .from(tasks)
        .where(
          and(inArray(tasks.milestoneId, ids), isNull(tasks.parentTaskId), isNull(tasks.deletedAt))
        )
        .groupBy(tasks.milestoneId),
      db
        .select({
          milestoneId: milestoneTeamMembers.milestoneId,
          teamMemberId: milestoneTeamMembers.teamMemberId,
          name: teamMembers.name,
          avatarUrl: teamMembers.avatarUrl,
        })
        .from(milestoneTeamMembers)
        .innerJoin(teamMembers, eq(milestoneTeamMembers.teamMemberId, teamMembers.id))
        .where(inArray(milestoneTeamMembers.milestoneId, ids)),
    ]);

    for (const pr of progressRows) {
      if (!pr.milestoneId) continue;
      const total = Number(pr.total) || 0;
      const completed = Number(pr.completed) || 0;
      progressById[pr.milestoneId] = {
        total,
        completed,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    }

    for (const id of ids) assigneesById[id] = [];
    for (const a of assigneeRows) {
      assigneesById[a.milestoneId]!.push({
        teamMemberId: a.teamMemberId,
        name: a.name,
        avatarUrl: a.avatarUrl,
      });
    }
  }

  return rows.map((m) => ({
    ...m,
    taskProgress: progressById[m.id] ?? { total: 0, completed: 0, percent: 0 },
    assignees: assigneesById[m.id] ?? [],
  }));
}

export async function getMilestonesByProjectId(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };

  try {
    const rows = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        name: milestones.name,
        description: milestones.description,
        startDate: milestones.startDate,
        dueDate: milestones.dueDate,
        status: milestones.status,
        completedAt: milestones.completedAt,
        sortOrder: milestones.sortOrder,
        createdAt: milestones.createdAt,
      })
      .from(milestones)
      .where(eq(milestones.projectId, parsed.data))
      .orderBy(asc(milestones.startDate), asc(milestones.sortOrder), asc(milestones.createdAt));

    const data = await attachMilestoneProgress(rows);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load milestones" };
  }
}

/** Milestones on this project where the given team member is in `milestone_team_members`. Member session only. */
export async function getMilestonesByProjectIdForAssignee(projectId: string, teamMemberId: string) {
  const parsed = z
    .object({ projectId: z.string().uuid(), teamMemberId: z.string().uuid() })
    .safeParse({ projectId, teamMemberId });
  if (!parsed.success) return { ok: false as const, error: "Invalid ids" };

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId || sessionUserRole(session) !== "member") {
      return { ok: false as const, error: "Forbidden" };
    }
    const allowed = await memberHasProjectAccess(userId, parsed.data.projectId);
    if (!allowed) return { ok: false as const, error: "Forbidden" };

    const memberIds = await getTeamMemberIdsForSessionUser(userId);
    if (!memberIds.includes(parsed.data.teamMemberId)) {
      return { ok: false as const, error: "Forbidden" };
    }

    const rows = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        name: milestones.name,
        description: milestones.description,
        startDate: milestones.startDate,
        dueDate: milestones.dueDate,
        status: milestones.status,
        completedAt: milestones.completedAt,
        sortOrder: milestones.sortOrder,
        createdAt: milestones.createdAt,
      })
      .from(milestones)
      .innerJoin(
        milestoneTeamMembers,
        and(
          eq(milestoneTeamMembers.milestoneId, milestones.id),
          eq(milestoneTeamMembers.teamMemberId, parsed.data.teamMemberId)
        )
      )
      .where(eq(milestones.projectId, parsed.data.projectId))
      .orderBy(asc(milestones.startDate), asc(milestones.sortOrder), asc(milestones.createdAt));

    const data = await attachMilestoneProgress(rows);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load milestones" };
  }
}

export async function getProjectMilestones(projectId: string) {
  return getMilestonesByProjectId(projectId);
}

export async function getMilestoneProgress(milestoneId: string) {
  const parsed = z.string().uuid().safeParse(milestoneId);
  if (!parsed.success) return { ok: false as const, error: "Invalid milestone id" };

  try {
    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.milestoneId, parsed.data),
          isNull(tasks.parentTaskId),
          isNull(tasks.deletedAt)
        )
      );

    const total = Number(row?.total ?? 0);
    const completed = Number(row?.completed ?? 0);
    return {
      ok: true as const,
      data: {
        total,
        completed,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      },
    };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load milestone progress" };
  }
}

export async function completeMilestone(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid milestone id" };

  try {
    const [row] = await db
      .update(milestones)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(milestones.id, parsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Milestone not found" };

    await logActivityWithActor({
      entityType: "milestone",
      entityId: row.id,
      action: "completed",
      metadata: {
        name: row.name,
        projectId: row.projectId,
      },
    });
    await revalidateMilestonePaths(row.projectId);
    return { ok: true as const, data: row };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to complete milestone" };
  }
}

/** @deprecated Linked invoices removed — always returns null */
export async function getMilestoneByLinkedInvoiceId(_invoiceId: string) {
  return { ok: true as const, data: null };
}

export async function markMilestoneComplete(id: string) {
  return completeMilestone(id);
}

export async function getUpcomingMilestones(days?: number) {
  const parsed = upcomingDaysSchema.safeParse(days);
  if (!parsed.success) return { ok: false as const, error: "Invalid days value" };

  const today = new Date().toISOString().slice(0, 10);
  const until = endDateAfterDays(parsed.data);

  try {
    const data = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        projectName: projects.name,
        name: milestones.name,
        description: milestones.description,
        startDate: milestones.startDate,
        dueDate: milestones.dueDate,
        status: milestones.status,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(
        and(
          isNull(projects.deletedAt),
          inArray(milestones.status, ["pending", "in_progress"]),
          or(
            lt(milestones.dueDate, today),
            and(gte(milestones.dueDate, today), lte(milestones.dueDate, until))
          )
        )
      )
      .orderBy(asc(milestones.dueDate), asc(milestones.sortOrder))
      .limit(20);

    return { ok: true as const, data };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load upcoming milestones" };
  }
}
