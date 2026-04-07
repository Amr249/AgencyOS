"use server";

import { revalidatePath } from "next/cache";
import { and, asc, between, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients, projects, taskComments, taskStatusEnum, tasks, teamMembers, timeLogs } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const TASK_STATUSES = ["todo", "in_progress", "in_review", "done", "blocked"] as const;
const COLUMN_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "موقوف",
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
        phaseId: tasks.phaseId,
        parentTaskId: tasks.parentTaskId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        sortOrder: tasks.sortOrder,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        actualHours: tasks.actualHours,
        createdAt: tasks.createdAt,
        assigneeId: tasks.assigneeId,
        assigneeName: teamMembers.name,
        assigneeAvatarUrl: teamMembers.avatarUrl,
      })
      .from(tasks)
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(and(eq(tasks.projectId, parsed.data), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

    const taskIds = rows.map((r) => r.id);
    const logs = taskIds.length
      ? await db
          .select({
            taskId: timeLogs.taskId,
            totalLoggedHours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
          })
          .from(timeLogs)
          .where(inArray(timeLogs.taskId, taskIds))
          .groupBy(timeLogs.taskId)
      : [];

    const logMap = Object.fromEntries(logs.map((l) => [l.taskId, toNumber(l.totalLoggedHours)]));

    const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as any[]])) as Record<
      (typeof TASK_STATUSES)[number],
      any[]
    >;

    for (const row of rows) {
      grouped[row.status as (typeof TASK_STATUSES)[number]].push({
        ...row,
        totalLoggedHours: logMap[row.id] ?? 0,
      });
    }

    return {
      ok: true as const,
      data: {
        columns: TASK_STATUSES.map((status) => ({
          status,
          label: COLUMN_LABELS[status],
          tasks: grouped[status],
        })),
      },
    };
  } catch (error) {
    console.error("getWorkspaceBoard", error);
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

export async function getWorkspaceCalendar(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { ok: false as const, error: "Invalid month format (YYYY-MM)" };
  const year = Number(match[1]);
  const mo = Number(match[2]);
  const startDate = `${year}-${String(mo).padStart(2, "0")}-01`;
  const endDate = new Date(year, mo, 0).toISOString().slice(0, 10);
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

export async function getWorkspaceMyTasks() {
  try {
    const [withAssignee] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), sql`${tasks.assigneeId} is not null`));
    const mustUseAssignee = (withAssignee?.count ?? 0) > 0;

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const end = weekEnd.toISOString().slice(0, 10);

    const conditions = [isNull(tasks.deletedAt)];
    if (mustUseAssignee) conditions.push(sql`${tasks.assigneeId} is not null`);

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectName: projects.name,
        clientName: clients.companyName,
        assigneeName: teamMembers.name,
        assigneeAvatarUrl: teamMembers.avatarUrl,
        actualHours: tasks.actualHours,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(teamMembers, eq(tasks.assigneeId, teamMembers.id))
      .where(and(...conditions))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

    const groups = { today: [] as any[], this_week: [] as any[], later: [] as any[], no_date: [] as any[] };
    for (const task of rows) {
      if (!task.dueDate) {
        groups.no_date.push(task);
        continue;
      }
      if (task.dueDate === start) {
        groups.today.push(task);
      } else if (task.dueDate > start && between(sql`${task.dueDate}`, start, end)) {
        groups.this_week.push(task);
      } else if (task.dueDate > end) {
        groups.later.push(task);
      } else {
        groups.this_week.push(task);
      }
    }
    return { ok: true as const, data: groups };
  } catch (error) {
    console.error("getWorkspaceMyTasks", error);
    return { ok: false as const, error: isDbConnectionError(error) ? getDbErrorKey(error) : "unknown" };
  }
}

export async function getWorkspaceWorkload() {
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

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 56);
    const rangeStartDate = now.toISOString().slice(0, 10);
    const rangeEndDate = rangeEnd.toISOString().slice(0, 10);

    const memberIds = members.map((m) => m.id);
    const taskRows = memberIds.length
      ? await db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueDate: tasks.dueDate,
            estimatedHours: tasks.estimatedHours,
            assigneeId: tasks.assigneeId,
          })
          .from(tasks)
          .where(
            and(
              isNull(tasks.deletedAt),
              inArray(tasks.assigneeId, memberIds),
              between(tasks.dueDate, rangeStartDate, rangeEndDate)
            )
          )
      : [];

    const taskIds = taskRows.map((t) => t.id);
    const logRows = taskIds.length
      ? await db
          .select({
            taskId: timeLogs.taskId,
            hours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
          })
          .from(timeLogs)
          .where(inArray(timeLogs.taskId, taskIds))
          .groupBy(timeLogs.taskId)
      : [];
    const logMap = Object.fromEntries(logRows.map((r) => [r.taskId, toNumber(r.hours)]));

    const weekStarts = Array.from({ length: 8 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i * 7);
      return d;
    });

    const data = members.map((member) => {
      const memberTasks = taskRows.filter((t) => t.assigneeId === member.id);
      const weeks = weekStarts.map((ws) => {
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        const weekTasks = memberTasks.filter((t) => {
          if (!t.dueDate) return false;
          return t.dueDate >= ws.toISOString().slice(0, 10) && t.dueDate <= we.toISOString().slice(0, 10);
        });
        return {
          weekStart: ws.toISOString().slice(0, 10),
          taskCount: weekTasks.length,
          estimatedHours: Number(
            weekTasks.reduce((sum, t) => sum + toNumber(t.estimatedHours), 0).toFixed(2)
          ),
          loggedHours: Number(
            weekTasks.reduce((sum, t) => sum + (logMap[t.id] ?? 0), 0).toFixed(2)
          ),
          tasks: weekTasks.map((t) => t.title),
        };
      });
      return { member, weeks };
    });

    return { ok: true as const, data };
  } catch (error) {
    console.error("getWorkspaceWorkload", error);
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
    const [newLog] = await db
      .insert(timeLogs)
      .values({
        taskId: parsed.data.taskId,
        hours: String(parsed.data.hours),
        description: parsed.data.description ?? null,
        teamMemberId: parsed.data.teamMemberId ?? null,
        loggedAt: parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : new Date(),
      })
      .returning();

    await recalculateTaskActualHours(parsed.data.taskId);
    revalidatePath("/dashboard/workspace");
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
    const [deleted] = await db.delete(timeLogs).where(eq(timeLogs.id, parsed.data)).returning({ taskId: timeLogs.taskId });
    if (deleted?.taskId) await recalculateTaskActualHours(deleted.taskId);
    revalidatePath("/dashboard/workspace");
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
    .object({ taskId: z.string().uuid(), body: z.string().min(1).max(2000) })
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
