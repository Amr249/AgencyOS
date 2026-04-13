"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { eq, isNull, and, sql, ilike, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, projects, milestones, clients } from "@/lib/db";
import { logActivityWithActor } from "@/actions/activity-log";

const taskStatusValues = ["todo", "in_progress", "in_review", "done", "blocked"] as const;
const taskPriorityValues = ["low", "medium", "high", "urgent"] as const;

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  status: z.enum(taskStatusValues).default("todo"),
  priority: z.enum(taskPriorityValues).default("medium"),
  assigneeId: z.string().uuid().nullable().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
  milestoneId: z.string().uuid().nullable().optional(),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(taskPriorityValues).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  estimatedHours: z.coerce.number().min(0).nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
});

const getTasksFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  status: z.enum(taskStatusValues).optional(),
  priority: z.enum(taskPriorityValues).optional(),
  search: z.string().optional(),
});

const createSubtaskSchema = z.object({
  parentId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type GetTasksFilters = z.infer<typeof getTasksFiltersSchema>;

async function validateMilestoneForProject(
  milestoneId: string | null | undefined,
  projectId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (milestoneId == null) return { ok: true };
  const [m] = await db
    .select({ id: milestones.id })
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);
  if (!m) return { ok: false, error: "Milestone not found for this project" };
  return { ok: true };
}

export type TaskWithProject = {
  id: string;
  projectId: string;
  projectName: string;
  /** Project cover (`projects.cover_image_url`). */
  projectCoverImageUrl: string | null;
  /** Client logo when cover is empty (`clients.logo_url`). */
  projectClientLogoUrl: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: string | null;
  notes: string | null;
  createdAt: Date;
  actualHours?: string | null;
  milestoneId?: string | null;
  subtaskCount?: number;
};

export async function getTasks(filters?: GetTasksFilters) {
  const parsed = filters ? getTasksFiltersSchema.safeParse(filters) : { success: true as const, data: {} };
  if (!parsed.success) return { ok: false as const, error: "Invalid filters" };

  const f = parsed.success ? parsed.data : {};
  try {
    const conditions = [isNull(tasks.deletedAt), isNull(tasks.parentTaskId)];

    if (f.projectId) conditions.push(eq(tasks.projectId, f.projectId));
    if (f.milestoneId) conditions.push(eq(tasks.milestoneId, f.milestoneId));
    if (f.status) conditions.push(eq(tasks.status, f.status));
    if (f.priority) conditions.push(eq(tasks.priority, f.priority));
    if (f.search?.trim()) {
      conditions.push(ilike(tasks.title, `%${f.search.trim()}%`));
    }

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
        startDate: tasks.startDate,
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        notes: tasks.notes,
        createdAt: tasks.createdAt,
        actualHours: tasks.actualHours,
        milestoneId: tasks.milestoneId,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));

    const taskIds = rows.map((r) => r.id);
    let subtaskCountMap: Record<string, number> = {};
    if (taskIds.length > 0) {
      const subtaskRows = await db
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), inArray(tasks.parentTaskId, taskIds)));
      for (const r of subtaskRows) {
        if (r.parentTaskId) subtaskCountMap[r.parentTaskId] = (subtaskCountMap[r.parentTaskId] ?? 0) + 1;
      }
    }

    const data: TaskWithProject[] = rows.map((r) => ({
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
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getTasks", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load tasks" };
  }
}

/** Tasks for a single project (non-deleted, root tasks only). Same shape as getTasks({ projectId }). */
export async function getTasksByProjectId(projectId: string) {
  return getTasks({ projectId });
}

export async function getTasksByMilestoneId(milestoneId: string) {
  const parsed = z.string().uuid().safeParse(milestoneId);
  if (!parsed.success) return { ok: false as const, error: "Invalid milestone id" };
  try {
    const [m] = await db
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, parsed.data))
      .limit(1);
    if (!m) return { ok: false as const, error: "Milestone not found" };

    return getTasks({ projectId: m.projectId, milestoneId: parsed.data });
  } catch (e) {
    console.error("getTasksByMilestoneId", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load tasks" };
  }
}

export async function getTaskById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid task id" };
  try {
    const [row] = await db
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
        dueDate: tasks.dueDate,
        estimatedHours: tasks.estimatedHours,
        notes: tasks.notes,
        createdAt: tasks.createdAt,
        milestoneId: tasks.milestoneId,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(tasks.id, parsed.data), isNull(tasks.deletedAt)));

    if (!row) return { ok: false as const, error: "Task not found" };

    const subtasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.parentTaskId, row.id), isNull(tasks.deletedAt)))
      .orderBy(tasks.createdAt);

    return {
      ok: true as const,
      data: {
        ...row,
        projectCoverImageUrl: row.projectCoverImageUrl?.trim() || null,
        projectClientLogoUrl: row.projectClientLogoUrl?.trim() || null,
        subtasks,
      },
    };
  } catch (e) {
    console.error("getTaskById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load task" };
  }
}

export async function createTask(input: CreateTaskInput) {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    if (data.milestoneId) {
      const mv = await validateMilestoneForProject(data.milestoneId, data.projectId);
      if (!mv.ok) return { ok: false as const, error: { _form: [mv.error] } };
    }

    const [row] = await db
      .insert(tasks)
      .values({
        projectId: data.projectId,
        title: data.title,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        description: data.description ?? null,
        estimatedHours: data.estimatedHours != null ? String(data.estimatedHours) : null,
        milestoneId: data.milestoneId ?? null,
      })
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Failed to create task"] } };
    await logActivityWithActor({
      entityType: "task",
      entityId: row.id,
      action: "created",
      metadata: { title: row.title, projectId: row.projectId },
    });
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${data.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workspace");
    revalidatePath("/dashboard/my-tasks");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createTask", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: ["حدث خطأ غير متوقع."] } };
  }
}

export async function updateTask(input: UpdateTaskInput) {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;
  try {
    if (data.milestoneId !== undefined && data.milestoneId !== null) {
      const [current] = await db
        .select({
          projectId: tasks.projectId,
          parentTaskId: tasks.parentTaskId,
        })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!current) return { ok: false as const, error: { _form: ["Task not found"] } };
      if (current.parentTaskId != null) {
        return {
          ok: false as const,
          error: { _form: ["Subtasks cannot be linked to a milestone"] },
        };
      }
      const mv = await validateMilestoneForProject(data.milestoneId, current.projectId);
      if (!mv.ok) return { ok: false as const, error: { _form: [mv.error] } };
    }

    const updatePayload: Record<string, unknown> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.startDate !== undefined) updatePayload.startDate = data.startDate ?? null;
    if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate ?? null;
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.estimatedHours !== undefined)
      updatePayload.estimatedHours = data.estimatedHours != null ? String(data.estimatedHours) : null;
    if (data.milestoneId !== undefined) updatePayload.milestoneId = data.milestoneId;
    if (data.assigneeId !== undefined) updatePayload.assigneeId = data.assigneeId;

    let previousStatus: string | undefined;
    if (data.status !== undefined) {
      const [prevRow] = await db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      previousStatus = prevRow?.status;
    }

    const [row] = await db
      .update(tasks)
      .set(updatePayload as typeof tasks.$inferInsert)
      .where(eq(tasks.id, id))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Task not found"] } };
    if (
      data.status !== undefined &&
      previousStatus !== undefined &&
      previousStatus !== row.status
    ) {
      await logActivityWithActor({
        entityType: "task",
        entityId: row.id,
        action: "status_changed",
        metadata: {
          title: row.title,
          projectId: row.projectId,
          oldStatus: previousStatus,
          newStatus: row.status,
        },
      });
    }
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${row.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard");
    if (data.assigneeId !== undefined) {
      revalidatePath("/dashboard/workspace");
      revalidatePath("/dashboard/workspace/workload");
    }
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateTask", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function updateTaskStatus(id: string, status: (typeof taskStatusValues)[number]) {
  const idParsed = z.string().uuid().safeParse(id);
  const statusParsed = z.enum(taskStatusValues).safeParse(status);
  if (!idParsed.success || !statusParsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  try {
    const [prevRow] = await db
      .select({ status: tasks.status })
      .from(tasks)
      .where(eq(tasks.id, idParsed.data))
      .limit(1);
    const [row] = await db
      .update(tasks)
      .set({ status: statusParsed.data })
      .where(eq(tasks.id, idParsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Task not found" };
    if (prevRow && prevRow.status !== row.status) {
      await logActivityWithActor({
        entityType: "task",
        entityId: row.id,
        action: "status_changed",
        metadata: {
          title: row.title,
          projectId: row.projectId,
          oldStatus: prevRow.status,
          newStatus: row.status,
        },
      });
    }
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${row.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/workspace");
    revalidatePath("/dashboard/my-tasks");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateTaskStatus", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to update status" };
  }
}

export async function deleteTask(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid task id" };
  try {
    const [existing] = await db
      .select({ title: tasks.title, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, parsed.data), isNull(tasks.deletedAt)))
      .limit(1);
    if (!existing) return { ok: false as const, error: "Task not found" };
    const [row] = await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(eq(tasks.id, parsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Task not found" };
    await logActivityWithActor({
      entityType: "task",
      entityId: parsed.data,
      action: "deleted",
      metadata: { title: existing.title, projectId: existing.projectId },
    });
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${row.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteTask", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to delete task" };
  }
}

export async function createSubtask(input: z.infer<typeof createSubtaskSchema>) {
  const parsed = createSubtaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  try {
    const [parent] = await db
      .select({ projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, parsed.data.parentId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!parent) return { ok: false as const, error: { _form: ["Parent task not found"] } };

    const [row] = await db
      .insert(tasks)
      .values({
        projectId: parent.projectId,
        parentTaskId: parsed.data.parentId,
        title: parsed.data.title,
        status: "todo",
        priority: "medium",
      })
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Failed to create subtask"] } };
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${parent.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createSubtask", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] },
    };
  }
}

export async function toggleSubtask(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid task id" };
  try {
    const [current] = await db
      .select({ status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.id, parsed.data), isNull(tasks.deletedAt)))
      .limit(1);
    if (!current) return { ok: false as const, error: "Task not found" };
    const newStatus = current.status === "done" ? "todo" : "done";
    const [row] = await db
      .update(tasks)
      .set({ status: newStatus })
      .where(eq(tasks.id, parsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Task not found" };
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${row.projectId}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("toggleSubtask", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to toggle subtask" };
  }
}
