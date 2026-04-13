"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { phases, projects, projectTemplates, taskTemplates, tasks } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";

const saveAsTemplateSchema = z.object({
  projectId: z.string().uuid(),
  templateName: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().nullable(),
});

type TaskSnapshot = {
  id: string;
  phaseId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: string;
  sortOrder: number;
};

function orderTasksParentsFirst(rows: TaskSnapshot[]): TaskSnapshot[] {
  const byParent = new Map<string | null, TaskSnapshot[]>();
  for (const t of rows) {
    const p = t.parentTaskId;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(t);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  const out: TaskSnapshot[] = [];
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

function phaseIndexForTask(
  t: TaskSnapshot,
  byId: Map<string, TaskSnapshot>,
  phaseIdToIndex: Map<string, number>
): number {
  let cur: TaskSnapshot | undefined = t;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.phaseId) return phaseIdToIndex.get(cur.phaseId) ?? 0;
    cur = cur.parentTaskId ? byId.get(cur.parentTaskId) : undefined;
  }
  return 0;
}

export async function saveProjectAsTemplate(
  projectId: string,
  templateName: string,
  description?: string | null
) {
  const parsed = saveAsTemplateSchema.safeParse({ projectId, templateName, description });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { projectId: pid, templateName: name, description: desc } = parsed.data;

  try {
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, pid), isNull(projects.deletedAt)))
      .limit(1);
    if (!proj) {
      return { ok: false as const, error: "Project not found" };
    }

    const phaseRows = await db
      .select({ id: phases.id, name: phases.name })
      .from(phases)
      .where(eq(phases.projectId, pid))
      .orderBy(asc(phases.order), asc(phases.name));

    const defaultPhases = phaseRows.map((p) => p.name);
    const phaseIdToIndex = new Map(phaseRows.map((p, i) => [p.id, i]));

    const taskRows = await db
      .select({
        id: tasks.id,
        phaseId: tasks.phaseId,
        parentTaskId: tasks.parentTaskId,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        sortOrder: tasks.sortOrder,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, pid), isNull(tasks.deletedAt)));

    const snapshots: TaskSnapshot[] = taskRows.map((r) => ({
      id: r.id,
      phaseId: r.phaseId,
      parentTaskId: r.parentTaskId,
      title: r.title,
      description: r.description,
      priority: r.priority,
      sortOrder: r.sortOrder,
    }));

    const byId = new Map(snapshots.map((t) => [t.id, t]));
    const ordered = orderTasksParentsFirst(snapshots);

    const tpl = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projectTemplates)
        .values({
          name: name.trim(),
          description: desc?.trim() ? desc.trim() : null,
          defaultPhases,
          defaultBudget: null,
          sourceProjectId: pid,
        })
        .returning();

      if (!created) return null;

      const oldTaskIdToTemplateTaskId = new Map<string, string>();

      for (const t of ordered) {
        const phaseIndex = phaseIndexForTask(t, byId, phaseIdToIndex);
        const parentTemplateId = t.parentTaskId
          ? oldTaskIdToTemplateTaskId.get(t.parentTaskId) ?? null
          : null;

        const [inserted] = await tx
          .insert(taskTemplates)
          .values({
            projectTemplateId: created.id,
            parentTaskTemplateId: parentTemplateId,
            title: t.title,
            description: t.description,
            estimatedHours: null,
            priority: t.priority as (typeof taskTemplates.$inferInsert)["priority"],
            phaseIndex,
            sortOrder: t.sortOrder,
          })
          .returning();

        if (inserted) oldTaskIdToTemplateTaskId.set(t.id, inserted.id);
      }

      return created;
    });

    if (!tpl) {
      return { ok: false as const, error: "Failed to create template" };
    }

    revalidatePath("/dashboard/templates");
    revalidatePath(`/dashboard/templates/${tpl.id}`);
    revalidatePath(`/dashboard/projects/${pid}`);
    return { ok: true as const, data: { templateId: tpl.id } };
  } catch (e) {
    console.error("saveProjectAsTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to save template" };
  }
}

export async function listProjectTemplates() {
  try {
    const rows = await db
      .select({
        id: projectTemplates.id,
        name: projectTemplates.name,
        description: projectTemplates.description,
        defaultPhases: projectTemplates.defaultPhases,
        createdAt: projectTemplates.createdAt,
        sourceProjectId: projectTemplates.sourceProjectId,
      })
      .from(projectTemplates)
      .orderBy(desc(projectTemplates.createdAt));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("listProjectTemplates", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load templates" };
  }
}

export async function getProjectTemplateById(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid template id" };
  try {
    const [tpl] = await db
      .select()
      .from(projectTemplates)
      .where(eq(projectTemplates.id, parsed.data))
      .limit(1);
    if (!tpl) return { ok: false as const, error: "Template not found" };

    const taskRows = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.projectTemplateId, parsed.data))
      .orderBy(asc(taskTemplates.phaseIndex), asc(taskTemplates.sortOrder), asc(taskTemplates.title));

    return { ok: true as const, data: { template: tpl, tasks: taskRows } };
  } catch (e) {
    console.error("getProjectTemplateById", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to load template" };
  }
}

export async function deleteProjectTemplate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid template id" };
  try {
    const [row] = await db
      .delete(projectTemplates)
      .where(eq(projectTemplates.id, parsed.data))
      .returning();
    if (!row) return { ok: false as const, error: "Template not found" };
    revalidatePath("/dashboard/templates");
    revalidatePath(`/dashboard/templates/${parsed.data}`);
    return { ok: true as const };
  } catch (e) {
    console.error("deleteProjectTemplate", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e) };
    }
    return { ok: false as const, error: "Failed to delete template" };
  }
}
