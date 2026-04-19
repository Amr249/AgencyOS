import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  projectMembers,
  projectUserMembers,
  taskAssignments,
  tasks,
  teamMembers,
  users,
} from "@/lib/db/schema";

function normEmail(e: string | null | undefined): string | null {
  const s = (e ?? "").trim().toLowerCase();
  return s.length ? s : null;
}

/**
 * Reverse of `getTeamMemberIdsForSessionUser`: given a `team_members.id`, find the
 * matching `users.id` so we can address them in tables keyed on the auth user
 * (e.g. `notifications.user_id`).
 *
 * Resolution order:
 * 1) explicit `team_members.user_id` FK
 * 2) legacy: `team_members.email` equals some `users.email` (case/whitespace insensitive)
 *
 * Returns `null` if the team member has no linkable login (e.g. a contractor
 * who was added to the roster but never invited).
 */
export async function resolveUserIdForTeamMember(teamMemberId: string): Promise<string | null> {
  const [member] = await db
    .select({ userId: teamMembers.userId, email: teamMembers.email })
    .from(teamMembers)
    .where(eq(teamMembers.id, teamMemberId))
    .limit(1);
  if (!member) return null;
  if (member.userId) return member.userId;

  const em = normEmail(member.email);
  if (!em) return null;

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(trim(coalesce(${users.email}, ''))) = ${em}`)
    .limit(1);
  return userRow?.id ?? null;
}

/**
 * Resolves `team_members.id` rows for a logged-in `users.id`:
 * 1) explicit `team_members.user_id` FK
 * 2) legacy: same email as `users.email`
 */
export async function getTeamMemberIdsForSessionUser(userId: string): Promise<string[]> {
  const byUserId = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  if (byUserId.length > 0) {
    return [...new Set(byUserId.map((r) => r.id))];
  }

  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const em = normEmail(userRow?.email);
  if (!em) return [];

  const byEmail = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(sql`lower(trim(coalesce(${teamMembers.email}, ''))) = ${em}`);

  return [...new Set(byEmail.map((r) => r.id))];
}

/** Team member profile rows for pickers (member dashboard — no full roster leak). */
export async function getTeamMemberRowsForSessionUser(userId: string) {
  const ids = await getTeamMemberIdsForSessionUser(userId);
  if (ids.length === 0) return [];
  return await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      email: teamMembers.email,
      avatarUrl: teamMembers.avatarUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(inArray(teamMembers.id, ids))
    .orderBy(asc(teamMembers.name));
}

/** All `projects.id` values the user may access (roster and/or `project_user_members`). */
export async function getMemberProjectIdsForUser(userId: string): Promise<string[]> {
  const memberIds = await getTeamMemberIdsForSessionUser(userId);
  const projectIdSet = new Set<string>();
  if (memberIds.length > 0) {
    const fromTeam = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(inArray(projectMembers.teamMemberId, memberIds));
    for (const r of fromTeam) projectIdSet.add(r.projectId);
  }
  const fromUser = await db
    .select({ projectId: projectUserMembers.projectId })
    .from(projectUserMembers)
    .where(eq(projectUserMembers.userId, userId));
  for (const r of fromUser) projectIdSet.add(r.projectId);
  return [...projectIdSet];
}

/** Project visible to a user via `project_members` or `project_user_members`. */
export async function memberHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const ids = await getMemberProjectIdsForUser(userId);
  return ids.includes(projectId);
}

/** Whether a member role may read/mutate this task: any task on a project they can access. */
export async function memberCanAccessTask(taskId: string, userId: string): Promise<boolean> {
  const [taskRow] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!taskRow?.projectId) return false;
  return memberHasProjectAccess(userId, taskRow.projectId);
}

/**
 * Whether this task is assigned to the user (primary assignee or `task_assignments`).
 * For subtasks with no assignee and no junction rows, walks `parent_task_id` until a definitive assignment.
 * Used to restrict edit/delete to own work only (not teammates' tasks on the same project).
 */
export async function memberIsAssignedToTask(taskId: string, userId: string): Promise<boolean> {
  const memberIds = await getTeamMemberIdsForSessionUser(userId);
  if (memberIds.length === 0) return false;

  let currentId: string | null = taskId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const [t] = await db
      .select({
        assigneeId: tasks.assigneeId,
        parentTaskId: tasks.parentTaskId,
      })
      .from(tasks)
      .where(eq(tasks.id, currentId))
      .limit(1);
    if (!t) return false;

    if (t.assigneeId != null) {
      return memberIds.includes(t.assigneeId);
    }

    const myRow = await db
      .select({ id: taskAssignments.id })
      .from(taskAssignments)
      .where(and(eq(taskAssignments.taskId, currentId), inArray(taskAssignments.teamMemberId, memberIds)))
      .limit(1);
    if (myRow.length > 0) return true;

    const anyRow = await db
      .select({ id: taskAssignments.id })
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, currentId))
      .limit(1);
    if (anyRow.length > 0) {
      return false;
    }

    currentId = t.parentTaskId;
  }

  return false;
}

/** Walk `parent_task_id` until the root task (for any depth). */
export async function findRootTaskId(taskId: string): Promise<string | null> {
  let current: string | null = taskId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const [row] = await db
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(eq(tasks.id, current))
      .limit(1);
    if (!row) return null;
    if (row.parentTaskId == null) return current;
    current = row.parentTaskId;
  }
  return null;
}

/**
 * True if this user is assigned to the root or any descendant subtask (same rules as
 * `memberIsAssignedToTask` per node).
 */
export async function memberIsAssignedInTaskTree(rootTaskId: string, userId: string): Promise<boolean> {
  if (await memberIsAssignedToTask(rootTaskId, userId)) return true;
  let frontier = [rootTaskId];
  const seen = new Set<string>([rootTaskId]);
  while (frontier.length > 0) {
    const children = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(inArray(tasks.parentTaskId, frontier), isNull(tasks.deletedAt)));
    frontier = [];
    for (const c of children) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if (await memberIsAssignedToTask(c.id, userId)) return true;
      frontier.push(c.id);
    }
  }
  return false;
}

/** Member may open this task in the UI if they have an assignment anywhere in its root tree. */
export async function memberMayViewTaskById(taskId: string, userId: string): Promise<boolean> {
  const rootId = await findRootTaskId(taskId);
  if (!rootId) return false;
  return memberIsAssignedInTaskTree(rootId, userId);
}
