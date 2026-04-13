"use server";

import { db } from "@/lib/db";
import { taskAssignments, users, tasks, projects, teamMembers } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull, sql, asc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isDbConnectionError } from "@/lib/db-errors";

function normEmail(e: string | null | undefined): string | null {
  const s = (e ?? "").trim().toLowerCase();
  return s.length ? s : null;
}

/** App users who share an email with a team member (for “my tasks” when logged in). */
async function teamMemberIdsMatchingUser(userId: string): Promise<string[]> {
  const [sessionUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const em = normEmail(sessionUser?.email);
  if (!em) return [];
  const rows = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(sql`lower(trim(coalesce(${teamMembers.email}, ''))) = ${em}`);
  return rows.map((r) => r.id);
}

// ── Active team members (for assignee picker — no login required) ─────────────
export async function getTeamMembers() {
  try {
    const members = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .where(eq(teamMembers.status, "active"))
      .orderBy(asc(teamMembers.name));
    return { data: members, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: "Could not connect to the database. Please try again." };
    }
    return { data: null, error: "Could not load team members." };
  }
}

// ── Assign a task to a team member (junction row) ────────────────────────────
export async function assignTask(taskId: string, teamMemberId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Not authorized. Please sign in." };
    }

    const [member] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, teamMemberId), eq(teamMembers.status, "active")))
      .limit(1);
    if (!member) {
      return { success: false, error: "Invalid or inactive team member." };
    }

    const existing = await db
      .select()
      .from(taskAssignments)
      .where(
        and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.teamMemberId, teamMemberId))
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "This person is already assigned to this task." };
    }

    await db.insert(taskAssignments).values({
      taskId,
      teamMemberId,
      assignedBy: session.user.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/my-tasks");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/workspace/board");
    return { success: true, error: null };
  } catch (error) {
    console.error("assignTask", error);
    if (isDbConnectionError(error)) {
      return { success: false, error: "Could not connect to the database. Please try again." };
    }
    return { success: false, error: "Could not assign the task." };
  }
}

// ── Remove an assignment ─────────────────────────────────────────────────────
export async function unassignTask(taskId: string, teamMemberId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Not authorized. Please sign in." };
    }

    await db
      .delete(taskAssignments)
      .where(
        and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.teamMemberId, teamMemberId))
      );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/my-tasks");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/workspace/board");
    return { success: true, error: null };
  } catch (error) {
    console.error("unassignTask", error);
    if (isDbConnectionError(error)) {
      return { success: false, error: "Could not connect to the database. Please try again." };
    }
    return { success: false, error: "Could not remove the assignment." };
  }
}

// ── Get tasks assigned to the current user (junction + email match to team member) ──
export async function getMyTasks() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { data: null, error: "Not authorized. Please sign in." };
    }

    const memberIds = await teamMemberIdsMatchingUser(session.user.id);
    if (memberIds.length === 0) {
      return { data: [], error: null };
    }

    const myTasks = await db
      .select({
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        taskPriority: tasks.priority,
        taskDueDate: tasks.dueDate,
        assignedAt: taskAssignments.assignedAt,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(inArray(taskAssignments.teamMemberId, memberIds))
      .orderBy(taskAssignments.assignedAt);

    return { data: myTasks, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: "Could not connect to the database. Please try again." };
    }
    return { data: null, error: "Could not load your tasks." };
  }
}

// ── Get all assignees for a specific task (junction rows; userId = team_member id for UI compat) ──
export async function getTaskAssignees(taskId: string) {
  try {
    const assignees = await db
      .select({
        userId: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        assignedAt: taskAssignments.assignedAt,
      })
      .from(taskAssignments)
      .innerJoin(teamMembers, eq(taskAssignments.teamMemberId, teamMembers.id))
      .where(eq(taskAssignments.taskId, taskId))
      .orderBy(taskAssignments.assignedAt);

    const normalized = assignees.map((a) => ({
      ...a,
      email: a.email ?? "",
    }));

    return { data: normalized, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: null, error: "Could not connect to the database. Please try again." };
    }
    return { data: null, error: "Could not load assignees." };
  }
}

// ── Get assignees for multiple tasks (batch, for task cards) ──────────────────
export async function getAssigneesForTaskIds(taskIds: string[]) {
  type AssigneeRow = { userId: string; name: string; avatarUrl: string | null };
  const empty = {} as Record<string, AssigneeRow[]>;
  try {
    if (taskIds.length === 0) return { data: empty, error: null };

    const [assignmentRows, primaryRows] = await Promise.all([
      db
        .select({
          taskId: taskAssignments.taskId,
          memberId: teamMembers.id,
          name: teamMembers.name,
          avatarUrl: teamMembers.avatarUrl,
          email: teamMembers.email,
        })
        .from(taskAssignments)
        .innerJoin(teamMembers, eq(taskAssignments.teamMemberId, teamMembers.id))
        .where(inArray(taskAssignments.taskId, taskIds))
        .orderBy(taskAssignments.assignedAt),
      db
        .select({
          taskId: tasks.id,
          memberId: teamMembers.id,
          name: teamMembers.name,
          avatarUrl: teamMembers.avatarUrl,
          email: teamMembers.email,
        })
        .from(tasks)
        .innerJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
        .where(and(inArray(tasks.id, taskIds), isNotNull(tasks.assigneeId))),
    ]);

    const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

    const byTask: Record<string, AssigneeRow[]> = {};
    for (const tid of taskIds) byTask[tid] = [];

    for (const p of primaryRows) {
      byTask[p.taskId]!.push({
        userId: p.memberId,
        name: p.name,
        avatarUrl: p.avatarUrl?.trim() || null,
      });
    }

    const primaryEmailByTask = new Map<string, string>();
    for (const p of primaryRows) {
      const n = norm(p.email);
      if (n) primaryEmailByTask.set(p.taskId, n);
    }

    for (const r of assignmentRows) {
      const pe = primaryEmailByTask.get(r.taskId);
      if (pe && norm(r.email) === pe) continue;
      byTask[r.taskId]!.push({
        userId: r.memberId,
        name: r.name,
        avatarUrl: r.avatarUrl,
      });
    }

    return { data: byTask, error: null };
  } catch (error) {
    if (isDbConnectionError(error)) {
      return { data: empty, error: "Could not connect to the database. Please try again." };
    }
    return { data: empty, error: "Could not load assignees." };
  }
}
