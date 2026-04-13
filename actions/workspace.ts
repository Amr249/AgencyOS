"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, asc, between, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  clients,
  projects,
  taskAssignments,
  taskComments,
  taskStatusEnum,
  tasks,
  teamMembers,
  timeLogs,
  users,
} from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { getAvailabilityDeductionsByMember } from "@/actions/team-availability";
import { revalidateTimeTrackingCaches } from "@/lib/revalidate-time-tracking-caches";
import { DEFAULT_WEEKLY_CAPACITY_HOURS } from "@/lib/workspace-constants";
import type { TaskWithProject } from "@/actions/tasks";

const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "blocked"] as const;

/** Board row: same card shape as Tasks Kanban, plus assignee fields for swimlane grouping. */
export type WorkspaceBoardTask = TaskWithProject & {
  assigneeId: string | null;
  assigneeName: string | null;
};

const sortOrderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    sortOrder: z.number(),
    status: z.enum(taskStatusEnum.enumValues),
  })
);

const logTimeSchema = z.object({
  taskId: z.string().uuid(),
  hours: z.coerce.number().positive().max(24),
  description: z.string().max(500).optional(),
  teamMemberId: z.string().uuid().optional(),
  loggedAt: z.string().datetime().optional(),
});

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function recalculateTaskActualHours(taskId: string) {
  const [total] = await db
    .select({ total: sql<string>`coalesce(sum(${timeLogs.hours}), 0)` })
    .from(timeLogs)
    .where(eq(timeLogs.taskId, taskId));

  await db.update(tasks).set({ actualHours: String(toNumber(total?.total)) }).where(eq(tasks.id, taskId));
}

export async function getWorkspaceBoard(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };

  try {
    const rows = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        projectName: projects.name,
        projectCoverImageUrl: projects.coverImageUrl,
        projectClientLogoUrl: clients.logoUrl,
        parentTaskId: tasks.parentTaskId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        sortOrder: tasks.sortOrder,
        startDate: tasks.startDate,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        notes: tasks.notes,
        actualHours: tasks.actualHours,
        createdAt: tasks.createdAt,
        milestoneId: tasks.milestoneId,
        assigneeId: tasks.assigneeId,
        assigneeName: teamMembers.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(
        and(
          eq(tasks.projectId, parsed.data),
          isNull(tasks.deletedAt),
          isNull(tasks.parentTaskId)
        )
      )
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

    const taskIds = rows.map((r) => r.id);
    let subtaskCountMap: Record<string, number> = {};
    if (taskIds.length > 0) {
      const subtaskRows = await db
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), inArray(tasks.parentTaskId, taskIds)));
      for (const r of subtaskRows) {
        if (r.parentTaskId) {
          subtaskCountMap[r.parentTaskId] = (subtaskCountMap[r.parentTaskId] ?? 0) + 1;
        }
      }
    }

    const boardTasks: WorkspaceBoardTask[] = rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      projectCoverImageUrl: r.projectCoverImageUrl?.trim() || null,
      projectClientLogoUrl: r.projectClientLogoUrl?.trim() || null,
      parentTaskId: r.parentTaskId,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      startDate: r.startDate,
      dueDate: r.dueDate,
      estimatedHours: r.estimatedHours,
      notes: r.notes,
      createdAt: r.createdAt,
      actualHours: r.actualHours,
      milestoneId: r.milestoneId ?? null,
      subtaskCount: subtaskCountMap[r.id],
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeName,
    }));

    const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as WorkspaceBoardTask[]])) as Record<
      (typeof TASK_STATUSES)[number],
      WorkspaceBoardTask[]
    >;

    for (const t of boardTasks) {
      grouped[t.status as (typeof TASK_STATUSES)[number]].push(t);
    }

    return {
      ok: true as const,
      data: {
        columns: TASK_STATUSES.map((status) => ({
          status,
          tasks: grouped[status],
        })),
      },
    };
  } catch (error) {
    console.error("getWorkspaceBoard", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

/** Kanban columns for tasks across multiple projects (same shape as `getWorkspaceBoard`). */
export async function getWorkspaceBoardForProjects(projectIds: string[]) {
  const parsed = z.array(z.string().uuid()).min(1).safeParse(projectIds);
  if (!parsed.success) {
    return {
      ok: true as const,
      data: {
        columns: TASK_STATUSES.map((status) => ({
          status,
          tasks: [] as WorkspaceBoardTask[],
        })),
      },
    };
  }
  try {
    const ids = parsed.data;
    const rows = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        projectName: projects.name,
        projectCoverImageUrl: projects.coverImageUrl,
        projectClientLogoUrl: clients.logoUrl,
        parentTaskId: tasks.parentTaskId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        sortOrder: tasks.sortOrder,
        startDate: tasks.startDate,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        notes: tasks.notes,
        actualHours: tasks.actualHours,
        createdAt: tasks.createdAt,
        milestoneId: tasks.milestoneId,
        assigneeId: tasks.assigneeId,
        assigneeName: teamMembers.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(and(inArray(tasks.projectId, ids), isNull(tasks.deletedAt), isNull(tasks.parentTaskId)))
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

    const taskIds = rows.map((r) => r.id);
    let subtaskCountMap: Record<string, number> = {};
    if (taskIds.length > 0) {
      const subtaskRows = await db
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), inArray(tasks.parentTaskId, taskIds)));
      for (const r of subtaskRows) {
        if (r.parentTaskId) {
          subtaskCountMap[r.parentTaskId] = (subtaskCountMap[r.parentTaskId] ?? 0) + 1;
        }
      }
    }

    const boardTasks: WorkspaceBoardTask[] = rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      projectCoverImageUrl: r.projectCoverImageUrl?.trim() || null,
      projectClientLogoUrl: r.projectClientLogoUrl?.trim() || null,
      parentTaskId: r.parentTaskId,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      startDate: r.startDate,
      dueDate: r.dueDate,
      estimatedHours: r.estimatedHours,
      notes: r.notes,
      createdAt: r.createdAt,
      actualHours: r.actualHours,
      milestoneId: r.milestoneId ?? null,
      subtaskCount: subtaskCountMap[r.id],
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeName,
    }));

    const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as WorkspaceBoardTask[]])) as Record<
      (typeof TASK_STATUSES)[number],
      WorkspaceBoardTask[]
    >;

    for (const t of boardTasks) {
      grouped[t.status as (typeof TASK_STATUSES)[number]].push(t);
    }

    return {
      ok: true as const,
      data: {
        columns: TASK_STATUSES.map((status) => ({
          status,
          tasks: grouped[status],
        })),
      },
    };
  } catch (error) {
    console.error("getWorkspaceBoardForProjects", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function getWorkspaceTimeline(projectId: string) {
  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false as const, error: "Invalid project id" };
  try {
    const data = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        startDate: projects.startDate,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        assigneeName: teamMembers.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(and(eq(tasks.projectId, parsed.data), isNull(tasks.deletedAt), sql`${tasks.dueDate} is not null`))
      .orderBy(sql`${projects.startDate} asc nulls last`, sql`${tasks.dueDate} asc nulls last`);

    return { ok: true as const, data };
  } catch (error) {
    console.error("getWorkspaceTimeline", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `d` (local calendar). */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/** Sunday at end of the week that contains `d`. */
function endOfWeekSunday(d: Date): Date {
  const start = startOfWeekMonday(d);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return end;
}

export async function getWorkspaceCalendar(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { ok: false as const, error: "Invalid month format (YYYY-MM)" };
  const year = Number(match[1]);
  const mo = Number(match[2]);
  const monthStart = new Date(year, mo - 1, 1);
  const monthEnd = new Date(year, mo, 0);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = endOfWeekSunday(monthEnd);
  const startDate = toIsoDateLocal(gridStart);
  const endDate = toIsoDateLocal(gridEnd);
  try {
    const data = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        actualHours: tasks.actualHours,
        description: tasks.description,
        assigneeId: tasks.assigneeId,
        assigneeName: teamMembers.name,
        projectName: projects.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(
        and(
          isNull(tasks.deletedAt),
          sql`${tasks.dueDate} is not null`,
          between(tasks.dueDate, startDate, endDate)
        )
      )
      .orderBy(asc(tasks.dueDate), asc(tasks.sortOrder));

    return { ok: true as const, data };
  } catch (error) {
    console.error("getWorkspaceCalendar", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export type WorkspaceMyTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  clientName: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
  assigneeId: string | null;
  actualHours: string | null;
  estimatedHours: string | null;
  description: string | null;
};

export type WorkspaceMyTaskGroups = {
  overdue: WorkspaceMyTaskRow[];
  today: WorkspaceMyTaskRow[];
  tomorrow: WorkspaceMyTaskRow[];
  this_week: WorkspaceMyTaskRow[];
  later: WorkspaceMyTaskRow[];
  no_date: WorkspaceMyTaskRow[];
};

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function categorizeMyTaskBucket(
  task: { dueDate: string | null; status: string },
  todayStr: string,
  tomorrowStr: string,
  weekLastStr: string
): keyof WorkspaceMyTaskGroups {
  const done = task.status === "done";
  if (!task.dueDate) return "no_date";
  const d = task.dueDate;
  if (!done && d < todayStr) return "overdue";
  if (d === todayStr) return "today";
  if (d === tomorrowStr) return "tomorrow";
  if (d > tomorrowStr && d <= weekLastStr) return "this_week";
  return "later";
}

const EMPTY_MY_TASK_GROUPS: WorkspaceMyTaskGroups = {
  overdue: [],
  today: [],
  tomorrow: [],
  this_week: [],
  later: [],
  no_date: [],
};

/** Tasks assigned to the logged-in user (via task_assignments), grouped by due date. */
export async function getWorkspaceMyTasks(): Promise<
  { ok: true; data: WorkspaceMyTaskGroups } | { ok: false; error: string }
> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { ok: true as const, data: { ...EMPTY_MY_TASK_GROUPS } };
    }

    const userId = session.user.id;

    const taskIdSet = new Set<string>();

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const em = userRow?.email?.trim().toLowerCase();
    if (em) {
      const membersWithEmail = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(sql`lower(trim(coalesce(${teamMembers.email}, ''))) = ${em}`);
      if (membersWithEmail.length > 0) {
        const memberIds = membersWithEmail.map((m) => m.id);
        const fromAssignments = await db
          .select({ taskId: taskAssignments.taskId })
          .from(taskAssignments)
          .where(inArray(taskAssignments.teamMemberId, memberIds));
        for (const r of fromAssignments) taskIdSet.add(r.taskId);

        const byAssignee = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(inArray(tasks.assigneeId, memberIds), isNull(tasks.deletedAt)));
        for (const t of byAssignee) taskIdSet.add(t.id);
      }
    }

    const taskIds = [...taskIdSet];
    if (taskIds.length === 0) {
      return { ok: true as const, data: { ...EMPTY_MY_TASK_GROUPS } };
    }

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        startDate: tasks.startDate,
        dueDate: tasks.dueDate,
        projectId: projects.id,
        projectName: projects.name,
        clientName: clients.companyName,
        assigneeName: teamMembers.name,
        assigneeAvatarUrl: teamMembers.avatarUrl,
        assigneeId: tasks.assigneeId,
        actualHours: tasks.actualHours,
        estimatedHours: tasks.estimatedHours,
        description: tasks.description,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = localYmd(todayStart);
    const tomorrowStr = localYmd(addDays(todayStart, 1));
    const weekLastStr = localYmd(addDays(todayStart, 6));

    const groups: WorkspaceMyTaskGroups = {
      overdue: [],
      today: [],
      tomorrow: [],
      this_week: [],
      later: [],
      no_date: [],
    };

    for (const task of rows) {
      const key = categorizeMyTaskBucket(task, todayStr, tomorrowStr, weekLastStr);
      groups[key].push(task);
    }

    return { ok: true as const, data: groups };
  } catch (error) {
    console.error("getWorkspaceMyTasks", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export type WorkloadCapacityTaskRow = {
  id: string;
  title: string;
  hours: number;
  projectId: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
  assigneeId: string | null;
};

export type WorkloadCapacityRow = {
  member: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string | null;
  };
  capacityHours: number;
  assignedHours: number;
  availableHours: number;
  utilizationPercent: number;
  loadLabel: "available" | "assigned" | "overloaded";
  weekStart: string;
  weekEnd: string;
  tasks: WorkloadCapacityTaskRow[];
};

function workloadLoadLabel(utilizationPercent: number): "available" | "assigned" | "overloaded" {
  if (utilizationPercent > 100) return "overloaded";
  if (utilizationPercent >= 80) return "assigned";
  return "available";
}

/** Capacity vs assigned hours for the current rolling week (today … +6 days), per active team member. */
export async function getWorkspaceWorkloadCapacity(): Promise<
  { ok: true; data: WorkloadCapacityRow[] } | { ok: false; error: string }
> {
  try {
    const members = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        avatarUrl: teamMembers.avatarUrl,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .where(eq(teamMembers.status, "active"))
      .orderBy(asc(teamMembers.name));

    if (!members.length) {
      return { ok: true as const, data: [] };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(now);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekStartStr = now.toISOString().slice(0, 10);
    const weekEndStr = weekEndDate.toISOString().slice(0, 10);

    const logWindowEnd = new Date(weekEndDate);
    logWindowEnd.setHours(23, 59, 59, 999);

    const memberIds = members.map((m) => m.id);

    const taskRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        actualHours: tasks.actualHours,
        assigneeId: tasks.assigneeId,
        projectId: tasks.projectId,
        status: tasks.status,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          inArray(tasks.assigneeId, memberIds),
          between(tasks.dueDate, weekStartStr, weekEndStr)
        )
      );

    const taskIds = taskRows.map((t) => t.id);

    const logsInWeek =
      taskIds.length === 0
        ? []
        : await db
            .select({
              taskId: timeLogs.taskId,
              hours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
            })
            .from(timeLogs)
            .where(
              and(
                inArray(timeLogs.taskId, taskIds),
                gte(timeLogs.loggedAt, now),
                lte(timeLogs.loggedAt, logWindowEnd)
              )
            )
            .groupBy(timeLogs.taskId);

    const logWeekMap = Object.fromEntries(logsInWeek.map((r) => [r.taskId, toNumber(r.hours)]));

    const logsTotal =
      taskIds.length === 0
        ? []
        : await db
            .select({
              taskId: timeLogs.taskId,
              hours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
            })
            .from(timeLogs)
            .where(inArray(timeLogs.taskId, taskIds))
            .groupBy(timeLogs.taskId);

    const logTotalMap = Object.fromEntries(logsTotal.map((r) => [r.taskId, toNumber(r.hours)]));

    const deductionMap = await getAvailabilityDeductionsByMember(memberIds, weekStartStr, weekEndStr);

    const data: WorkloadCapacityRow[] = members.map((member) => {
      const mTasks = taskRows.filter((t) => t.assigneeId === member.id);
      let assignedSum = 0;
      const capacityTasks: WorkloadCapacityTaskRow[] = mTasks.map((t) => {
        const est = toNumber(t.estimatedHours);
        const weekL = logWeekMap[t.id] ?? 0;
        const totalL = logTotalMap[t.id] ?? 0;
        const hours = est > 0 ? est : weekL > 0 ? weekL : totalL > 0 ? totalL : 0;
        assignedSum += hours;
        return {
          id: t.id,
          title: t.title,
          hours: Number(hours.toFixed(2)),
          projectId: t.projectId,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          estimatedHours: t.estimatedHours,
          actualHours: t.actualHours,
          assigneeId: t.assigneeId,
        };
      });

      const assignedHours = Number(assignedSum.toFixed(2));
      const deduction = deductionMap.get(member.id) ?? 0;
      const capacity = Math.max(
        0,
        Number((DEFAULT_WEEKLY_CAPACITY_HOURS - deduction).toFixed(2))
      );
      const utilizationPercent =
        capacity > 0
          ? Math.round((assignedHours / capacity) * 1000) / 10
          : assignedHours > 0
            ? 100
            : 0;
      const availableHours = Math.max(0, Number((capacity - assignedHours).toFixed(2)));

      return {
        member,
        capacityHours: capacity,
        assignedHours,
        availableHours,
        utilizationPercent,
        loadLabel: workloadLoadLabel(utilizationPercent),
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        tasks: capacityTasks.sort((a, b) => a.title.localeCompare(b.title)),
      };
    });

    return { ok: true as const, data };
  } catch (error) {
    console.error("getWorkspaceWorkloadCapacity", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function updateTaskSortOrder(updates: Array<{ id: string; sortOrder: number; status: string }>) {
  const parsed = sortOrderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false as const, error: "Invalid payload" };
  try {
    await db.transaction(async (tx) => {
      for (const item of parsed.data) {
        await tx
          .update(tasks)
          .set({ sortOrder: item.sortOrder, status: item.status })
          .where(eq(tasks.id, item.id));
      }
    });
    revalidatePath("/dashboard/workspace");
    return { ok: true as const };
  } catch (error) {
    console.error("updateTaskSortOrder", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function logTime(input: {
  taskId: string;
  hours: number;
  description?: string;
  teamMemberId?: string;
  loggedAt?: string;
}) {
  const parsed = logTimeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid payload" };
  try {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, parsed.data.taskId),
      columns: { projectId: true },
    });
    if (!task) return { ok: false as const, error: "Task not found" };

    const [newLog] = await db
      .insert(timeLogs)
      .values({
        taskId: parsed.data.taskId,
        projectId: task.projectId,
        hours: String(parsed.data.hours),
        description: parsed.data.description ?? null,
        teamMemberId: parsed.data.teamMemberId ?? null,
        loggedAt: parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : new Date(),
      })
      .returning();

    await recalculateTaskActualHours(parsed.data.taskId);
    revalidateTimeTrackingCaches(task.projectId);
    return { ok: true as const, data: newLog };
  } catch (error) {
    console.error("logTime", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function deleteTimeLog(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    const [deleted] = await db
      .delete(timeLogs)
      .where(eq(timeLogs.id, parsed.data))
      .returning({ taskId: timeLogs.taskId, projectId: timeLogs.projectId });
    if (deleted?.taskId) await recalculateTaskActualHours(deleted.taskId);
    const projectId =
      deleted?.projectId ??
      (deleted?.taskId
        ? (
            await db.query.tasks.findFirst({
              where: eq(tasks.id, deleted.taskId),
              columns: { projectId: true },
            })
          )?.projectId
        : undefined);
    revalidateTimeTrackingCaches(projectId);
    return { ok: true as const };
  } catch (error) {
    console.error("deleteTimeLog", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function getTimeLogs(taskId: string) {
  const parsed = z.string().uuid().safeParse(taskId);
  if (!parsed.success) return { ok: false as const, error: "Invalid task id" };
  try {
    const data = await db
      .select({
        id: timeLogs.id,
        taskId: timeLogs.taskId,
        teamMemberId: timeLogs.teamMemberId,
        teamMemberName: teamMembers.name,
        description: timeLogs.description,
        hours: timeLogs.hours,
        loggedAt: timeLogs.loggedAt,
        startedAt: timeLogs.startedAt,
        endedAt: timeLogs.endedAt,
        createdAt: timeLogs.createdAt,
      })
      .from(timeLogs)
      .leftJoin(teamMembers, eq(timeLogs.teamMemberId, teamMembers.id))
      .where(eq(timeLogs.taskId, parsed.data))
      .orderBy(desc(timeLogs.loggedAt));
    return { ok: true as const, data };
  } catch (error) {
    console.error("getTimeLogs", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function createTaskComment(taskId: string, body: string) {
  const parsed = z
    .object({ taskId: z.string().uuid(), body: z.string().min(1).max(4000) })
    .safeParse({ taskId, body });
  if (!parsed.success) return { ok: false as const, error: "Invalid payload" };
  try {
    const [comment] = await db
      .insert(taskComments)
      .values({ taskId: parsed.data.taskId, body: parsed.data.body, authorName: "Admin" })
      .returning();
    revalidatePath("/dashboard/workspace");
    return { ok: true as const, data: comment };
  } catch (error) {
    console.error("createTaskComment", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function getTaskComments(taskId: string) {
  const parsed = z.string().uuid().safeParse(taskId);
  if (!parsed.success) return { ok: false as const, error: "Invalid task id" };
  try {
    const data = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, parsed.data))
      .orderBy(asc(taskComments.createdAt));
    return { ok: true as const, data };
  } catch (error) {
    console.error("getTaskComments", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function deleteTaskComment(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    await db.delete(taskComments).where(eq(taskComments.id, parsed.data));
    revalidatePath("/dashboard/workspace");
    return { ok: true as const };
  } catch (error) {
    console.error("deleteTaskComment", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function assignTask(taskId: string, teamMemberId: string | null) {
  const parsed = z
    .object({ taskId: z.string().uuid(), teamMemberId: z.string().uuid().nullable() })
    .safeParse({ taskId, teamMemberId });
  if (!parsed.success) return { ok: false as const, error: "Invalid payload" };
  try {
    await db
      .update(tasks)
      .set({ assigneeId: parsed.data.teamMemberId })
      .where(eq(tasks.id, parsed.data.taskId));
    revalidatePath("/dashboard/workspace");
    return { ok: true as const };
  } catch (error) {
    console.error("assignTask", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}
