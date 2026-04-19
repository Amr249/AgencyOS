"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { taskDependencies, tasks } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { memberMayViewTaskById } from "@/lib/member-context";

const dependencyTypes = [
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
  "start_to_finish",
] as const;

const addDependencySchema = z.object({
  taskId: z.string().uuid(),
  dependsOnTaskId: z.string().uuid(),
  type: z.enum(dependencyTypes).optional().default("finish_to_start"),
});

const removeDependencySchema = z.object({
  id: z.string().uuid(),
});

const getTaskDependenciesSchema = z.object({
  taskId: z.string().uuid(),
});

const getDependenciesForTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).default([]),
});

const getCriticalPathSchema = z.object({
  projectId: z.string().uuid(),
});

function utcDateOnly(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function durationInDays(
  startDate: string | Date | null | undefined,
  dueDate: string | Date | null | undefined,
  createdAt: Date
): number {
  const fallback = utcDateOnly(createdAt) ?? new Date();
  const start = utcDateOnly(startDate) ?? utcDateOnly(dueDate) ?? fallback;
  const end = utcDateOnly(dueDate) ?? utcDateOnly(startDate) ?? start;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export async function validateNoCycle(taskId: string, dependsOnTaskId: string) {
  try {
    if (taskId === dependsOnTaskId) {
      return {
        valid: false as const,
        cycle: [taskId, dependsOnTaskId],
        error: "A task cannot depend on itself." as const,
      };
    }

    // If taskId is reachable from dependsOnTaskId through existing edges,
    // adding taskId -> dependsOnTaskId creates a cycle.
    const visited = new Set<string>([dependsOnTaskId]);
    const parents = new Map<string, string | null>([[dependsOnTaskId, null]]);
    let frontier = [dependsOnTaskId];

    while (frontier.length > 0) {
      const nextBatch = await db
        .select({
          taskId: taskDependencies.taskId,
          dependsOnTaskId: taskDependencies.dependsOnTaskId,
        })
        .from(taskDependencies)
        .where(inArray(taskDependencies.taskId, frontier));

      frontier = [];

      for (const edge of nextBatch) {
        const next = edge.dependsOnTaskId;
        if (next === taskId) {
          const chain: string[] = [];
          let cursor: string | null = edge.taskId;
          while (cursor) {
            chain.push(cursor);
            cursor = parents.get(cursor) ?? null;
          }
          chain.reverse();
          const cycle = [taskId, ...chain, taskId];
          return {
            valid: false as const,
            cycle,
            error: "This dependency creates a circular dependency." as const,
          };
        }
        if (!visited.has(next)) {
          visited.add(next);
          parents.set(next, edge.taskId);
          frontier.push(next);
        }
      }
    }

    return { valid: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { valid: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function addDependency(input: z.infer<typeof addDependencySchema>) {
  try {
    const parsed = addDependencySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const { taskId, dependsOnTaskId, type } = parsed.data;

    if (taskId === dependsOnTaskId) {
      return { ok: false as const, error: "A task cannot depend on itself." as const };
    }

    const [task, blockingTask] = await Promise.all([
      db.query.tasks.findFirst({ where: eq(tasks.id, taskId), columns: { id: true, projectId: true } }),
      db.query.tasks.findFirst({
        where: eq(tasks.id, dependsOnTaskId),
        columns: { id: true, projectId: true },
      }),
    ]);

    if (!task || !blockingTask) {
      return { ok: false as const, error: "Task not found." as const };
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false as const, error: "Not authorized." as const };
    }
    if (sessionUserRole(session) === "member") {
      const a = await memberMayViewTaskById(taskId, userId);
      const b = await memberMayViewTaskById(dependsOnTaskId, userId);
      if (!a || !b) {
        return { ok: false as const, error: "Forbidden." as const };
      }
    } else if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden." as const };
    }

    const existing = await db.query.taskDependencies.findFirst({
      where: and(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)),
      columns: { id: true },
    });
    if (existing) {
      return { ok: false as const, error: "Dependency already exists." as const };
    }

    const cycleCheck = await validateNoCycle(taskId, dependsOnTaskId);
    if (!cycleCheck.valid) {
      if (cycleCheck.cycle) {
        return {
          ok: false as const,
          error: "Cannot add dependency: would create circular reference",
          cycle: cycleCheck.cycle,
        };
      }
      return {
        ok: false as const,
        error:
          typeof cycleCheck.error === "string" ? cycleCheck.error : "Failed to validate dependency graph.",
      };
    }

    const [created] = await db
      .insert(taskDependencies)
      .values({
        taskId,
        dependsOnTaskId,
        type,
      })
      .returning();

    revalidatePath("/dashboard/workspace");
    revalidatePath(`/dashboard/projects/${task.projectId}`);
    if (blockingTask.projectId !== task.projectId) {
      revalidatePath(`/dashboard/projects/${blockingTask.projectId}`);
    }

    return { ok: true as const, data: created };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function removeDependency(id: string) {
  try {
    const parsed = removeDependencySchema.safeParse({ id });
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const row = await db.query.taskDependencies.findFirst({
      where: eq(taskDependencies.id, parsed.data.id),
      with: {
        task: { columns: { id: true, projectId: true } },
        dependsOnTask: { columns: { id: true, projectId: true } },
      },
    });

    if (!row) {
      return { ok: false as const, error: "Dependency not found." as const };
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false as const, error: "Not authorized." as const };
    }
    if (sessionUserRole(session) === "member") {
      const ok = await memberMayViewTaskById(row.task.id, userId);
      if (!ok) {
        return { ok: false as const, error: "Forbidden." as const };
      }
    } else if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden." as const };
    }

    await db.delete(taskDependencies).where(eq(taskDependencies.id, parsed.data.id));

    revalidatePath("/dashboard/workspace");
    revalidatePath(`/dashboard/projects/${row.task.projectId}`);
    if (row.dependsOnTask.projectId !== row.task.projectId) {
      revalidatePath(`/dashboard/projects/${row.dependsOnTask.projectId}`);
    }

    return { ok: true as const };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getTaskDependencies(taskId: string) {
  try {
    const parsed = getTaskDependenciesSchema.safeParse({ taskId });
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false as const, error: "Not authorized." as const };
    }
    if (sessionUserRole(session) === "member") {
      const ok = await memberMayViewTaskById(parsed.data.taskId, userId);
      if (!ok) {
        return { ok: false as const, error: "Forbidden." as const };
      }
    } else if (sessionUserRole(session) !== "admin") {
      return { ok: false as const, error: "Forbidden." as const };
    }

    const rows = await db.query.taskDependencies.findMany({
      where: or(
        eq(taskDependencies.taskId, parsed.data.taskId),
        eq(taskDependencies.dependsOnTaskId, parsed.data.taskId)
      ),
      with: {
        task: {
          columns: { id: true, title: true, status: true, projectId: true },
        },
        dependsOnTask: {
          columns: { id: true, title: true, status: true, projectId: true },
        },
      },
    });

    let blockedBy = rows.filter((r) => r.taskId === parsed.data.taskId);
    let blocks = rows.filter((r) => r.dependsOnTaskId === parsed.data.taskId);

    if (sessionUserRole(session) === "member") {
      const bb: typeof blockedBy = [];
      for (const r of blockedBy) {
        if (await memberMayViewTaskById(r.dependsOnTask.id, userId)) bb.push(r);
      }
      blockedBy = bb;
      const bk: typeof blocks = [];
      for (const r of blocks) {
        if (await memberMayViewTaskById(r.task.id, userId)) bk.push(r);
      }
      blocks = bk;
    }

    const all = sessionUserRole(session) === "member" ? [...blockedBy, ...blocks] : rows;
    return { ok: true as const, data: { blockedBy, blocks, all } };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getDependenciesForTasks(taskIds: string[]) {
  try {
    const parsed = getDependenciesForTasksSchema.safeParse({ taskIds });
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    if (parsed.data.taskIds.length === 0) {
      return { ok: true as const, data: [] };
    }

    const rows = await db.query.taskDependencies.findMany({
      where: or(
        inArray(taskDependencies.taskId, parsed.data.taskIds),
        inArray(taskDependencies.dependsOnTaskId, parsed.data.taskIds)
      ),
      with: {
        task: { columns: { id: true, title: true, status: true, projectId: true } },
        dependsOnTask: { columns: { id: true, title: true, status: true, projectId: true } },
      },
    });

    return { ok: true as const, data: rows };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}

export async function getCriticalPath(projectId: string) {
  try {
    const parsed = getCriticalPathSchema.safeParse({ projectId });
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.flatten().fieldErrors };
    }

    const projectTasks = await db.query.tasks.findMany({
      where: and(eq(tasks.projectId, parsed.data.projectId), isNull(tasks.deletedAt)),
      columns: {
        id: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
      },
    });

    if (projectTasks.length === 0) {
      return {
        ok: true as const,
        data: {
          taskIds: [] as string[],
          projectDurationDays: 0,
        },
      };
    }

    const taskIds = projectTasks.map((t) => t.id);
    const durations = new Map(
      projectTasks.map((t) => [t.id, durationInDays(t.startDate, t.dueDate, t.createdAt)])
    );

    const deps = await db.query.taskDependencies.findMany({
      where: and(inArray(taskDependencies.taskId, taskIds), inArray(taskDependencies.dependsOnTaskId, taskIds)),
      columns: {
        taskId: true,
        dependsOnTaskId: true,
      },
    });

    const predecessors = new Map<string, string[]>();
    const successors = new Map<string, string[]>();
    const indegree = new Map<string, number>();

    for (const id of taskIds) {
      predecessors.set(id, []);
      successors.set(id, []);
      indegree.set(id, 0);
    }

    for (const edge of deps) {
      predecessors.get(edge.taskId)!.push(edge.dependsOnTaskId);
      successors.get(edge.dependsOnTaskId)!.push(edge.taskId);
      indegree.set(edge.taskId, (indegree.get(edge.taskId) ?? 0) + 1);
    }

    const queue = taskIds.filter((id) => (indegree.get(id) ?? 0) === 0);
    const topo: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      topo.push(current);
      for (const next of successors.get(current) ?? []) {
        const nextIn = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, nextIn);
        if (nextIn === 0) queue.push(next);
      }
    }

    // If a cycle exists in persisted data, fall back without throwing.
    if (topo.length !== taskIds.length) {
      return {
        ok: true as const,
        data: {
          taskIds: [] as string[],
          projectDurationDays: 0,
        },
      };
    }

    const es = new Map<string, number>();
    const ef = new Map<string, number>();
    for (const id of topo) {
      const preds = predecessors.get(id) ?? [];
      const earliestStart = preds.length === 0 ? 0 : Math.max(...preds.map((p) => ef.get(p) ?? 0));
      const finish = earliestStart + (durations.get(id) ?? 1);
      es.set(id, earliestStart);
      ef.set(id, finish);
    }

    const projectDurationDays = Math.max(...taskIds.map((id) => ef.get(id) ?? 0));

    const ls = new Map<string, number>();
    const lf = new Map<string, number>();
    const reversedTopo = [...topo].reverse();
    for (const id of reversedTopo) {
      const nextTasks = successors.get(id) ?? [];
      const latestFinish =
        nextTasks.length === 0 ? projectDurationDays : Math.min(...nextTasks.map((n) => ls.get(n) ?? projectDurationDays));
      const latestStart = latestFinish - (durations.get(id) ?? 1);
      lf.set(id, latestFinish);
      ls.set(id, latestStart);
    }

    const criticalTaskIds = topo.filter((id) => (es.get(id) ?? 0) === (ls.get(id) ?? 0));

    return {
      ok: true as const,
      data: {
        taskIds: criticalTaskIds,
        projectDurationDays,
      },
    };
  } catch (e) {
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    throw e;
  }
}
