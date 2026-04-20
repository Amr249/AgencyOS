"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, isNotNull, and, desc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { files, projects, invoices, teamMembers } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";
import { getImageKitClient } from "@/lib/imagekit";
import { FILE_DOCUMENT_TYPES, type FileRow } from "@/lib/file-types";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { memberIsAssignedToTask } from "@/lib/member-context";

const createFileSchema = z.object({
  name: z.string().min(1),
  imagekitFileId: z.string().min(1),
  imagekitUrl: z.string().url(),
  filePath: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  expenseId: z.string().uuid().nullable().optional(),
  documentType: z.enum(FILE_DOCUMENT_TYPES).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

const getFilesSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    expenseId: z.string().uuid().optional(),
    /** When `clientId` is set: `general` = Files tab (no document type); `documents` = Documents tab. */
    clientFileScope: z.enum(["general", "documents"]).optional(),
  })
  .refine(
    (d) =>
      d.clientId != null ||
      d.projectId != null ||
      d.taskId != null ||
      d.invoiceId != null ||
      d.expenseId != null,
    {
      message: "Provide clientId, projectId, taskId, invoiceId, or expenseId",
    }
  )
  .refine((d) => d.clientFileScope == null || d.clientId != null, {
    message: "clientFileScope is only valid with clientId",
  });

export async function getFiles(params: {
  clientId?: string;
  projectId?: string;
  taskId?: string;
  invoiceId?: string;
  expenseId?: string;
  clientFileScope?: "general" | "documents";
}) {
  const parsed = getFilesSchema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid params: provide clientId, projectId, taskId, invoiceId, or expenseId",
      data: [] as FileRow[],
    };
  }
  const { clientId, projectId, taskId, invoiceId, expenseId, clientFileScope } = parsed.data;
  try {
    const conditions = [isNull(files.deletedAt)];
    if (clientId != null) {
      conditions.push(eq(files.clientId, clientId));
      const scope = clientFileScope ?? "general";
      if (scope === "documents") {
        conditions.push(isNotNull(files.documentType));
      } else {
        conditions.push(isNull(files.documentType));
      }
    }
    if (projectId != null) conditions.push(eq(files.projectId, projectId));
    if (taskId != null) conditions.push(eq(files.taskId, taskId));
    if (invoiceId != null) conditions.push(eq(files.invoiceId, invoiceId));
    if (expenseId != null) conditions.push(eq(files.expenseId, expenseId));

    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        imagekitFileId: files.imagekitFileId,
        imagekitUrl: files.imagekitUrl,
        filePath: files.filePath,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        clientId: files.clientId,
        projectId: files.projectId,
        taskId: files.taskId,
        invoiceId: files.invoiceId,
        expenseId: files.expenseId,
        documentType: files.documentType,
        description: files.description,
        uploadedBy: files.uploadedBy,
        uploadedByName: teamMembers.name,
        uploadedByAvatarUrl: teamMembers.avatarUrl,
        createdAt: files.createdAt,
      })
      .from(files)
      .leftJoin(teamMembers, eq(teamMembers.userId, files.uploadedBy))
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));

    const data: FileRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      imagekitFileId: r.imagekitFileId,
      imagekitUrl: r.imagekitUrl,
      filePath: r.filePath,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      clientId: r.clientId,
      projectId: r.projectId,
      taskId: r.taskId,
      invoiceId: r.invoiceId,
      expenseId: r.expenseId,
      documentType: r.documentType ?? null,
      description: r.description ?? null,
      uploadedBy: r.uploadedBy ?? null,
      uploadedByName: r.uploadedByName ?? null,
      uploadedByAvatarUrl: r.uploadedByAvatarUrl ?? null,
      createdAt: r.createdAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getFiles", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FileRow[] };
    }
    return { ok: false as const, error: "Failed to load files", data: [] as FileRow[] };
  }
}

export async function createFile(data: z.infer<typeof createFileSchema>) {
  const parsed = createFileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;
    if (d.taskId) {
      if (!userId) {
        return { ok: false as const, error: { _form: ["Not authorized"] } };
      }
      if (sessionUserRole(session) === "member") {
        const allowed = await memberIsAssignedToTask(d.taskId, userId);
        if (!allowed) {
          return { ok: false as const, error: { _form: ["Forbidden"] } };
        }
      }
    }

    const [row] = await db
      .insert(files)
      .values({
        name: d.name,
        imagekitFileId: d.imagekitFileId,
        imagekitUrl: d.imagekitUrl,
        filePath: d.filePath,
        mimeType: d.mimeType ?? null,
        sizeBytes: d.sizeBytes ?? null,
        clientId: d.clientId ?? null,
        projectId: d.projectId ?? null,
        taskId: d.taskId ?? null,
        invoiceId: d.invoiceId ?? null,
        expenseId: d.expenseId ?? null,
        description: d.description ?? null,
        uploadedBy: userId,
      })
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Failed to create file record"] } };

    let clientIdForLog = row.clientId;
    if (!clientIdForLog && row.projectId) {
      const [p] = await db
        .select({ clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, row.projectId))
        .limit(1);
      clientIdForLog = p?.clientId ?? null;
    }
    if (!clientIdForLog && row.invoiceId) {
      const [inv] = await db
        .select({ clientId: invoices.clientId })
        .from(invoices)
        .where(eq(invoices.id, row.invoiceId))
        .limit(1);
      clientIdForLog = inv?.clientId ?? null;
    }
    if (clientIdForLog) {
      await logActivityWithActor({
        entityType: "file",
        entityId: row.id,
        action: "uploaded",
        metadata: {
          name: row.name,
          clientId: clientIdForLog,
          projectId: row.projectId,
        },
      });
    }

    let uploadedByName: string | null = null;
    let uploadedByAvatarUrl: string | null = null;
    if (row.uploadedBy) {
      const [tm] = await db
        .select({ name: teamMembers.name, avatarUrl: teamMembers.avatarUrl })
        .from(teamMembers)
        .where(eq(teamMembers.userId, row.uploadedBy))
        .limit(1);
      uploadedByName = tm?.name ?? null;
      uploadedByAvatarUrl = tm?.avatarUrl ?? null;
    }

    const data: FileRow = {
      id: row.id,
      name: row.name,
      imagekitFileId: row.imagekitFileId,
      imagekitUrl: row.imagekitUrl,
      filePath: row.filePath,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      clientId: row.clientId,
      projectId: row.projectId,
      taskId: row.taskId ?? null,
      invoiceId: row.invoiceId ?? null,
      expenseId: row.expenseId ?? null,
      documentType: row.documentType ?? null,
      description: row.description ?? null,
      uploadedBy: row.uploadedBy ?? null,
      uploadedByName,
      uploadedByAvatarUrl,
      createdAt: row.createdAt,
    };

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/expenses");
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
    if (row.invoiceId) revalidatePath(`/dashboard/invoices/${row.invoiceId}`);
    if (row.expenseId) revalidatePath(`/dashboard/expenses/${row.expenseId}`);
    if (row.taskId) {
      revalidatePath("/dashboard/workspace");
      revalidatePath("/dashboard/my-tasks");
    }

    return { ok: true as const, data };
  } catch (e) {
    console.error("createFile", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] } };
  }
}

export async function deleteFile(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid file id" };
  }

  const [row] = await db
    .select({
      id: files.id,
      imagekitFileId: files.imagekitFileId,
      clientId: files.clientId,
      projectId: files.projectId,
      taskId: files.taskId,
      invoiceId: files.invoiceId,
      expenseId: files.expenseId,
      uploadedBy: files.uploadedBy,
    })
    .from(files)
    .where(eq(files.id, parsed.data));

  if (!row) {
    return { ok: false as const, error: "File not found" };
  }

  if (row.taskId) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;
    if (!userId) return { ok: false as const, error: "Not authorized" };
    if (sessionUserRole(session) === "member") {
      const assigned = await memberIsAssignedToTask(row.taskId, userId);
      if (!assigned) return { ok: false as const, error: "Forbidden" };
      if (row.uploadedBy !== userId) {
        return { ok: false as const, error: "Forbidden" };
      }
    }
  }

  const client = getImageKitClient();
  if (client && row.imagekitFileId) {
    try {
      await client.files.delete(row.imagekitFileId);
    } catch (e) {
      console.error("ImageKit delete error", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to delete file from storage",
      };
    }
  }

  await db.delete(files).where(eq(files.id, parsed.data));

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/expenses");
  if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
  if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
  if (row.invoiceId) revalidatePath(`/dashboard/invoices/${row.invoiceId}`);
  if (row.expenseId) revalidatePath(`/dashboard/expenses/${row.expenseId}`);
  if (row.taskId) {
    revalidatePath("/dashboard/workspace");
    revalidatePath("/dashboard/my-tasks");
  }

  return { ok: true as const };
}
