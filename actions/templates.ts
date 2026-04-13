"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, projectMembers } from "@/lib/db";
import {
  clients,
  phases,
  projectTemplates,
  projects,
  taskTemplates,
  tasks,
} from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";
import { createProjectSchema, type CreateProjectInput } from "@/lib/project-schemas";
import { syncProjectServices } from "@/actions/project-services";

const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Matches `createProject` default phases when a template has no custom phases. */
const FALLBACK_PHASE_NAMES = ["Discovery", "Design", "Development", "Review", "Launch"] as const;

const createProjectTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  phases: z.array(z.string().min(1)).optional(),
  defaultBudget: z.coerce.number().min(0).optional(),
});

const addTaskToTemplateSchema = z.object({
  projectTemplateId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  phaseIndex: z.coerce.number().int().min(0).optional(),
});

export type ProjectTemplateRow = typeof projectTemplates.$inferSelect;
export type TaskTemplateRow = typeof taskTemplates.$inferSelect;

export type ProjectTemplateWithTasks = ProjectTemplateRow & {
  taskTemplates: TaskTemplateRow[];
};

function normalizePhaseNames(names: string[] | null | undefined): { name: string; order: number }[] {
  const cleaned = (names ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  const source = cleaned.length > 0 ? cleaned : [...FALLBACK_PHASE_NAMES];
  return source.map((name, order) => ({ name, order }));
}

function phaseDefsFromTemplate(names: string[] | null | undefined): { name: string; order: number }[] {
  return (names ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name, order) => ({ name, order }));
}

function orderTemplateTasksParentsFirst(rows: TaskTemplateRow[]): TaskTemplateRow[] {
  const byParent = new Map<string | null, TaskTemplateRow[]>();
  for (const t of rows) {
    const p = t.parentTaskTemplateId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(t);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  const out: TaskTemplateRow[] = [];
  const queue = [...(byParent.get(null) ?? [])];
  while (queue.length) {
    const t = queue.shift()!;
    out.push(t);
    queue.push(...(byParent.get(t.id) ?? []));
  }
  const seen = new Set(out.map((t) => t.id));
  for (const t of rows) {
    if (!seen.has(t.id)) out.push(t);
  }
  return out;
}

export async function createProjectTemplate(input: z.infer<typeof createProjectTemplateSchema>) {
  const parsed = createProjectTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { name, description, phases, defaultBudget } = parsed.data;
  try {
    const [row] = await db
      .insert(projectTemplates)
      .values({
        name,
        description: description ?? null,
        defaultPhases: phases ?? [],
        defaultBudget: defaultBudget != null ? String(defaultBudget) : null,
      })
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Failed to create template"] } };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createProjectTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}

export async function addTaskToTemplate(input: z.infer<typeof addTaskToTemplateSchema>) {
  const parsed = addTaskToTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  try {
    const [exists] = await db
      .select({ id: projectTemplates.id })
      .from(projectTemplates)
      .where(eq(projectTemplates.id, data.projectTemplateId))
      .limit(1);
    if (!exists) return { ok: false as const, error: { _form: ["Template not found"] } };

    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${taskTemplates.sortOrder}), -1)` })
      .from(taskTemplates)
      .where(eq(taskTemplates.projectTemplateId, data.projectTemplateId));

    const nextOrder = Number(maxRow?.max ?? -1) + 1;

    const [row] = await db
      .insert(taskTemplates)
      .values({
        projectTemplateId: data.projectTemplateId,
        title: data.title,
        description: data.description ?? null,
        estimatedHours:
          data.estimatedHours != null && data.estimatedHours > 0
            ? String(data.estimatedHours)
            : null,
        priority: data.priority ?? "medium",
        phaseIndex: data.phaseIndex ?? 0,
        sortOrder: nextOrder,
      })
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Failed to add task template"] } };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("addTaskToTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}

export type ProjectTemplatePickerRow = ProjectTemplateRow & { taskCount: number };

export async function getProjectTemplates(): Promise<
  { ok: true; data: ProjectTemplatePickerRow[] } | { ok: false; error: string }
> {
  try {
    const rows = await db
      .select()
      .from(projectTemplates)
      .orderBy(desc(projectTemplates.createdAt));
    if (rows.length === 0) {
      return { ok: true as const, data: [] };
    }
    const ids = rows.map((r) => r.id);
    const countRows = await db
      .select({
        projectTemplateId: taskTemplates.projectTemplateId,
        n: count(),
      })
      .from(taskTemplates)
      .where(inArray(taskTemplates.projectTemplateId, ids))
      .groupBy(taskTemplates.projectTemplateId);
    const countMap = new Map(countRows.map((r) => [r.projectTemplateId, Number(r.n)]));
    return {
      ok: true as const,
      data: rows.map((r) => ({
        ...r,
        taskCount: countMap.get(r.id) ?? 0,
      })),
    };
  } catch (e) {
    console.error("getProjectTemplates", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load templates" };
  }
}

export type ProjectTemplateListItem = ProjectTemplateRow & { taskCount: number };

/** @deprecated Prefer `getProjectTemplates()` — it already includes task counts. */
export async function getProjectTemplatesWithTaskCounts(): Promise<
  { ok: true; data: ProjectTemplateListItem[] } | { ok: false; error: string }
> {
  return getProjectTemplates();
}

export async function getTemplateById(
  id: string
): Promise<{ ok: true; data: ProjectTemplateWithTasks } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid template id" };
  try {
    const [template] = await db
      .select()
      .from(projectTemplates)
      .where(eq(projectTemplates.id, parsed.data))
      .limit(1);
    if (!template) return { ok: false as const, error: "Template not found" };

    const tTasks = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.projectTemplateId, parsed.data))
      .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.phaseIndex));

    return { ok: true as const, data: { ...template, taskTemplates: tTasks } };
  } catch (e) {
    console.error("getTemplateById", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: "Failed to load template" };
  }
}

export async function deleteProjectTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid template id" };
  try {
    const [deleted] = await db
      .delete(projectTemplates)
      .where(eq(projectTemplates.id, parsed.data))
      .returning({ id: projectTemplates.id });
    if (!deleted) return { ok: false as const, error: "Template not found" };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProjectTemplate", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

const updateProjectTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  defaultPhases: z.array(z.string().min(1)).optional(),
  defaultBudget: z.coerce.number().min(0).optional().nullable(),
});

export async function updateProjectTemplate(input: z.infer<typeof updateProjectTemplateSchema>) {
  const parsed = updateProjectTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, name, description, defaultPhases, defaultBudget } = parsed.data;
  try {
    const patch: Partial<typeof projectTemplates.$inferInsert> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (defaultPhases !== undefined) patch.defaultPhases = defaultPhases;
    if (defaultBudget !== undefined) {
      patch.defaultBudget = defaultBudget == null ? null : String(defaultBudget);
    }
    if (Object.keys(patch).length === 0) {
      return { ok: false as const, error: { _form: ["No changes"] } };
    }
    const [row] = await db
      .update(projectTemplates)
      .set(patch)
      .where(eq(projectTemplates.id, id))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Template not found"] } };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateProjectTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}

const updateTaskTemplateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  phaseIndex: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export async function updateTaskTemplate(input: z.infer<typeof updateTaskTemplateSchema>) {
  const parsed = updateTaskTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { id, title, description, estimatedHours, priority, phaseIndex, sortOrder } = parsed.data;
  try {
    const patch: Partial<typeof taskTemplates.$inferInsert> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (estimatedHours !== undefined) {
      patch.estimatedHours =
        estimatedHours == null || estimatedHours === 0 ? null : String(estimatedHours);
    }
    if (priority !== undefined) patch.priority = priority;
    if (phaseIndex !== undefined) patch.phaseIndex = phaseIndex;
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    if (Object.keys(patch).length === 0) {
      return { ok: false as const, error: { _form: ["No changes"] } };
    }
    const [row] = await db
      .update(taskTemplates)
      .set(patch)
      .where(eq(taskTemplates.id, id))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Task template not found"] } };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("updateTaskTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}

export async function deleteTaskTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id" };
  try {
    const [deleted] = await db
      .delete(taskTemplates)
      .where(eq(taskTemplates.id, parsed.data))
      .returning({ id: taskTemplates.id });
    if (!deleted) return { ok: false as const, error: "Task template not found" };
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const };
  } catch (e) {
    console.error("deleteTaskTemplate", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

const reorderTaskTemplatesSchema = z.object({
  projectTemplateId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

export async function reorderTaskTemplates(input: z.infer<typeof reorderTaskTemplatesSchema>) {
  const parsed = reorderTaskTemplatesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { projectTemplateId, orderedIds } = parsed.data;
  if (orderedIds.length === 0) return { ok: true as const };
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(taskTemplates)
          .set({ sortOrder: i })
          .where(
            and(eq(taskTemplates.id, orderedIds[i]!), eq(taskTemplates.projectTemplateId, projectTemplateId))
          );
      }
    });
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const };
  } catch (e) {
    console.error("reorderTaskTemplates", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}

export async function createProjectFromTemplate(templateId: string, input: CreateProjectInput) {
  const idParsed = z.string().uuid().safeParse(templateId);
  if (!idParsed.success) {
    return { ok: false as const, error: { _form: ["Invalid template id"] } };
  }
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  try {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), isNull(clients.deletedAt)))
      .limit(1);
    if (!client) {
      return { ok: false as const, error: { _form: ["Client not found"] } };
    }

    const templateRes = await getTemplateById(idParsed.data);
    if (!templateRes.ok) {
      return { ok: false as const, error: { _form: [templateRes.error] } };
    }
    const template = templateRes.data;

    const phaseDefs = phaseDefsFromTemplate(template.defaultPhases);

    const newProject = await db.transaction(async (tx) => {
      const [proj] = await tx
        .insert(projects)
        .values({
          name: data.name,
          clientId: data.clientId,
          status: data.status,
          coverImageUrl: data.coverImageUrl || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          budget: data.budget != null ? String(data.budget) : null,
          description: data.description ?? null,
        })
        .returning();
      if (!proj) throw new Error("Failed to create project");

      const phaseIdByIndex = new Map<number, string>();
      if (phaseDefs.length > 0) {
        const insertedPhases = await tx
          .insert(phases)
          .values(
            phaseDefs.map((p) => ({
              projectId: proj.id,
              name: p.name,
              order: p.order,
            }))
          )
          .returning();
        insertedPhases.forEach((ph, idx) => phaseIdByIndex.set(idx, ph.id));
      }

      const ordered = orderTemplateTasksParentsFirst(template.taskTemplates);
      const templateTaskIdToNewTaskId = new Map<string, string>();
      for (const tt of ordered) {
        const phaseId = phaseIdByIndex.get(tt.phaseIndex) ?? null;
        const parentTaskId = tt.parentTaskTemplateId
          ? templateTaskIdToNewTaskId.get(tt.parentTaskTemplateId) ?? null
          : null;
        const [taskRow] = await tx
          .insert(tasks)
          .values({
            projectId: proj.id,
            phaseId,
            parentTaskId,
            title: tt.title,
            description: tt.description ?? null,
            status: "todo",
            priority: tt.priority,
            sortOrder: tt.sortOrder,
            estimatedHours: tt.estimatedHours ?? null,
          })
          .returning();
        if (taskRow) templateTaskIdToNewTaskId.set(tt.id, taskRow.id);
      }

      if (data.teamMemberIds?.length) {
        await tx.insert(projectMembers).values(
          data.teamMemberIds.map((teamMemberId) => ({
            projectId: proj.id,
            teamMemberId,
          }))
        );
      }

      return proj;
    });

    const syncCreate = await syncProjectServices(newProject.id, data.serviceIds ?? []);
    if (!syncCreate.ok) {
      return { ok: false as const, error: { _form: [syncCreate.error] } };
    }

    await logActivityWithActor({
      entityType: "project",
      entityId: newProject.id,
      action: "created",
      metadata: {
        name: newProject.name,
        clientId: newProject.clientId,
        fromTemplateId: template.id,
        templateName: template.name,
      },
    });

    revalidatePath("/dashboard/projects");
    revalidatePath(`/dashboard/projects/${newProject.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings/templates");
    return { ok: true as const, data: newProject };
  } catch (e) {
    console.error("createProjectFromTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return {
      ok: false as const,
      error: { _form: [e instanceof Error ? e.message : "Unexpected error"] },
    };
  }
}
