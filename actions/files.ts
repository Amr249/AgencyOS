"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, isNotNull, and, desc, or, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { files, folders, projects, invoices, teamMembers } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";
import { deleteFromR2 } from "@/lib/r2";
import { publicUrlFromR2Key } from "@/lib/r2-public-url";
import { FILE_DOCUMENT_TYPES, type FileRow, type FileDocumentType } from "@/lib/file-types";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getMemberProjectIdsForUser, memberIsAssignedToTask } from "@/lib/member-context";
import { getMemberAccessibleProjectFolderIds, memberHasAccessToProjectFolder } from "@/lib/member-drive-access";
import { getDriveFolders } from "@/actions/folders";

export type DriveFolderDirectFileStat = {
  folderId: string;
  fileCount: number;
  totalBytes: number;
  newestAt: string | null;
};

/** Folder ids that may appear in agency drive (/drive, /member-drive) for the current user. */
async function driveViewScopedFolderIdsForUser(): Promise<
  { ok: true; ids: string[] } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Not authorized" };
  const role = sessionUserRole(session);
  if (role === "member") {
    const accessible = await getMemberAccessibleProjectFolderIds(uid);
    return { ok: true, ids: Array.from(accessible) };
  }
  const tree = await getDriveFolders();
  if (!tree.ok) {
    return { ok: false, error: typeof tree.error === "string" ? tree.error : "Failed to load drive folders" };
  }
  return { ok: true, ids: tree.data.map((f) => f.id) };
}

/**
 * Per-folder file aggregates for drive UI (sidebar counts, folder cards) without loading every file row.
 */
export async function getDriveFolderDirectFileStats(): Promise<
  { ok: true; data: DriveFolderDirectFileStat[] } | { ok: false; error: string; data: [] }
> {
  const scope = await driveViewScopedFolderIdsForUser();
  if (!scope.ok) return { ok: false, error: scope.error, data: [] };
  if (scope.ids.length === 0) return { ok: true, data: [] };
  try {
    const rows = await withDbReadRetry("getDriveFolderDirectFileStats", () =>
      db
        .select({
          folderId: files.folderId,
          cnt: sql<number>`count(*)::int`,
          bytes: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::double precision`,
          newest: sql<Date | null>`max(${files.createdAt})`,
        })
        .from(files)
        .where(
          and(isNull(files.deletedAt), isNotNull(files.folderId), inArray(files.folderId, scope.ids))
        )
        .groupBy(files.folderId)
    );

    const data: DriveFolderDirectFileStat[] = rows
      .filter((r) => r.folderId != null)
      .map((r) => ({
        folderId: r.folderId!,
        fileCount: Number(r.cnt ?? 0),
        totalBytes: Number(r.bytes ?? 0),
        newestAt: r.newest ? r.newest.toISOString() : null,
      }));
    return { ok: true, data };
  } catch (e) {
    console.error("getDriveFolderDirectFileStats", e);
    if (isDbConnectionError(e)) {
      return { ok: false, error: getDbErrorKey(e), data: [] };
    }
    return { ok: false, error: "Failed to load folder file stats", data: [] };
  }
}

function fileStorageKey(row: { r2Key: string | null }): string | null {
  const k = row.r2Key?.trim();
  return k && k.length > 0 ? k : null;
}

async function withDbReadRetry<T>(label: string, run: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run();
    } catch (e) {
      lastError = e;
      const canRetry = attempt < retries && isDbConnectionError(e);
      if (!canRetry) throw e;
      console.warn(`${label}: transient DB connection error, retrying (${attempt + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

const createFileSchema = z.object({
  name: z.string().min(1),
  r2Key: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  expenseId: z.string().uuid().nullable().optional(),
  documentType: z.enum(FILE_DOCUMENT_TYPES).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  folderId: z.string().uuid().optional(),
});

const getFilesSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    expenseId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    /** Personal drive on `/dashboard/drive` (scoped by session user via folder paths). */
    standaloneDrive: z.boolean().optional(),
    /** All files uploaded by current user across all scopes (drive aggregate view). */
    allForUser: z.boolean().optional(),
    /** Drive page full view (admin: all files, member: permitted project files). */
    driveView: z.boolean().optional(),
    /** Max rows returned (drive queries with huge folders). */
    takeLimit: z.number().int().min(1).max(10000).optional(),
    /** When `clientId` is set: `general` = Files tab (no document type); `documents` = Documents tab. */
    clientFileScope: z.enum(["general", "documents"]).optional(),
  })
  .refine(
    (d) =>
      d.standaloneDrive === true ||
      d.allForUser === true ||
      d.driveView === true ||
      d.clientId != null ||
      d.projectId != null ||
      d.taskId != null ||
      d.invoiceId != null ||
      d.expenseId != null ||
      d.folderId != null,
    {
      message:
        "Provide standaloneDrive, allForUser, driveView, clientId, projectId, taskId, invoiceId, expenseId, or folderId",
    }
  )
  .refine((d) => d.clientFileScope == null || d.clientId != null, {
    message: "clientFileScope is only valid with clientId",
  })
  .refine((d) => !(d.standaloneDrive && d.clientFileScope != null), {
    message: "clientFileScope is not valid with standaloneDrive",
  })
  .refine((d) => !(d.allForUser && d.clientFileScope != null), {
    message: "clientFileScope is not valid with allForUser",
  })
  .refine((d) => !(d.standaloneDrive && d.allForUser), {
    message: "standaloneDrive and allForUser cannot both be true",
  })
  .refine((d) => !(d.driveView && d.clientFileScope != null), {
    message: "clientFileScope is not valid with driveView",
  })
  .refine((d) => !((d.standaloneDrive || d.allForUser) && d.driveView), {
    message: "driveView cannot be combined with standaloneDrive/allForUser",
  })
  .refine((d) => d.takeLimit == null || d.driveView === true, {
    message: "takeLimit is only valid with driveView",
  });

export async function getFiles(params: {
  clientId?: string;
  projectId?: string;
  taskId?: string;
  invoiceId?: string;
  expenseId?: string;
  folderId?: string;
  clientFileScope?: "general" | "documents";
  standaloneDrive?: boolean;
  allForUser?: boolean;
  driveView?: boolean;
  takeLimit?: number;
}) {
  const parsed = getFilesSchema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        "Invalid params: provide standaloneDrive, allForUser, driveView, clientId, projectId, taskId, invoiceId, expenseId, or folderId",
      data: [] as FileRow[],
    };
  }
  const {
    clientId,
    projectId,
    taskId,
    invoiceId,
    expenseId,
    folderId,
    clientFileScope,
    standaloneDrive,
    allForUser,
    driveView,
    takeLimit,
  } = parsed.data;
  try {
    const conditions = [isNull(files.deletedAt)];

    if (driveView) {
      const scope = await driveViewScopedFolderIdsForUser();
      if (!scope.ok) {
        return { ok: false as const, error: scope.error, data: [] as FileRow[] };
      }
      if (scope.ids.length === 0) {
        return { ok: true as const, data: [] as FileRow[] };
      }
      conditions.push(inArray(files.folderId, scope.ids));
      if (folderId != null) conditions.push(eq(files.folderId, folderId));
    } else if (allForUser) {
      const session = await getServerSession(authOptions);
      const uid = session?.user?.id ?? null;
      if (!uid) {
        return { ok: false as const, error: "Not authorized", data: [] as FileRow[] };
      }
      conditions.push(eq(files.uploadedBy, uid));
      if (folderId != null) {
        conditions.push(eq(files.folderId, folderId));
      }
    } else if (standaloneDrive) {
      const session = await getServerSession(authOptions);
      const uid = session?.user?.id ?? null;
      if (!uid) {
        return { ok: false as const, error: "Not authorized", data: [] as FileRow[] };
      }
      const userPrefix = `/drive/user/${uid}`;
      conditions.push(isNull(files.clientId));
      conditions.push(isNull(files.projectId));
      conditions.push(isNull(files.taskId));
      conditions.push(isNull(files.invoiceId));
      conditions.push(isNull(files.expenseId));
      conditions.push(isNull(files.documentType));

      if (folderId != null) {
        const [fol] = await db.select().from(folders).where(eq(folders.id, folderId)).limit(1);
        if (
          !fol ||
          fol.clientId != null ||
          fol.projectId != null ||
          !fol.path.startsWith(`${userPrefix}/`)
        ) {
          return { ok: false as const, error: "Invalid folder", data: [] as FileRow[] };
        }
        conditions.push(eq(files.folderId, folderId));
      } else {
        const folderRows = await withDbReadRetry("getFiles.folderRows", () =>
          db
            .select({ id: folders.id })
            .from(folders)
            .where(
              and(
                isNull(folders.clientId),
                isNull(folders.projectId),
                sql`${folders.path} like ${userPrefix + "/%"}`
              )
            )
        );
        const ids = folderRows.map((r) => r.id);
        const scopeCond =
          ids.length > 0
            ? or(
                and(isNull(files.folderId), eq(files.uploadedBy, uid)),
                inArray(files.folderId, ids)
              )
            : and(isNull(files.folderId), eq(files.uploadedBy, uid));
        if (scopeCond) conditions.push(scopeCond);
      }
    } else {
      if (folderId != null) {
        conditions.push(eq(files.folderId, folderId));
      }
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
    }

    const rows = await withDbReadRetry("getFiles.rows", () => {
      const base = db
        .select({
          id: files.id,
          name: files.name,
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
          folderId: files.folderId,
          r2Key: files.r2Key,
          isPublic: files.isPublic,
          shareToken: files.shareToken,
          shareExpiresAt: files.shareExpiresAt,
          uploadedByName: teamMembers.name,
          uploadedByAvatarUrl: teamMembers.avatarUrl,
          createdAt: files.createdAt,
        })
        .from(files)
        .leftJoin(teamMembers, eq(teamMembers.userId, files.uploadedBy))
        .where(and(...conditions))
        .orderBy(desc(files.createdAt));
      return takeLimit != null ? base.limit(takeLimit) : base;
    });

    const data: FileRow[] = rows.map((r) => {
      const key = r.r2Key?.trim() ?? "";
      return {
        id: r.id,
        name: r.name,
        r2Key: key,
        publicFileUrl: publicUrlFromR2Key(r.r2Key),
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
        folderId: r.folderId ?? null,
        isPublic: r.isPublic ?? false,
        shareToken: r.shareToken ?? null,
        shareExpiresAt: r.shareExpiresAt ?? null,
      };
    });

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
    const role = sessionUserRole(session);
    if (d.taskId) {
      if (!userId) {
        return { ok: false as const, error: { _form: ["notAuthorized"] } };
      }
      if (role === "member") {
        const allowed = await memberIsAssignedToTask(d.taskId, userId);
        if (!allowed) {
          return { ok: false as const, error: { _form: ["forbidden"] } };
        }
      }
    }

    const folder =
      d.folderId != null
        ? (await db.select().from(folders).where(eq(folders.id, d.folderId)).limit(1))[0] ?? null
        : null;

    // If folder is scoped to project/client, inherit that scope automatically.
    // This is required for Drive project-linked folders where client/project ids
    // are not sent explicitly from the uploader.
    if (folder?.projectId && d.projectId == null) {
      d.projectId = folder.projectId;
    }
    if (folder?.clientId && d.clientId == null) {
      d.clientId = folder.clientId;
    }

    if (
      role === "member" &&
      !d.taskId &&
      !d.invoiceId &&
      !d.expenseId &&
      (folder?.projectId || d.projectId)
    ) {
      if (!d.folderId || !userId) {
        return { ok: false as const, error: { _form: ["forbidden"] } };
      }
      const allowedFolder = await memberHasAccessToProjectFolder(userId, d.folderId);
      if (!allowedFolder) {
        return { ok: false as const, error: { _form: ["forbidden"] } };
      }
    }

    const isPersonalDriveFile =
      d.clientId == null &&
      d.projectId == null &&
      d.taskId == null &&
      d.invoiceId == null &&
      d.expenseId == null;
    if (role === "member" && isPersonalDriveFile) {
      if (!d.folderId) {
        return { ok: false as const, error: { _form: ["memberDriveFolderRequired"] } };
      }
      const [targetFolder] = await db.select().from(folders).where(eq(folders.id, d.folderId)).limit(1);
      if (!targetFolder?.projectId) {
        return { ok: false as const, error: { _form: ["memberCanOnlyUploadToProjectFolders"] } };
      }
      const allowedProjects = await getMemberProjectIdsForUser(userId ?? "");
      if (!allowedProjects.includes(targetFolder.projectId)) {
        return { ok: false as const, error: { _form: ["forbidden"] } };
      }
      d.projectId = targetFolder.projectId;
    }
    if (isPersonalDriveFile && d.folderId != null && userId) {
      const fol = folder;
      if (
        !fol ||
        fol.clientId != null ||
        fol.projectId != null ||
        !fol.path.startsWith(`/drive/user/${userId}/`)
      ) {
        return { ok: false as const, error: { _form: ["Invalid folder"] } };
      }
    }

    const inserted = await db.execute(sql`
      insert into files (
        name,
        mime_type,
        size_bytes,
        client_id,
        project_id,
        task_id,
        invoice_id,
        expense_id,
        document_type,
        description,
        uploaded_by,
        folder_id,
        r2_key
      ) values (
        ${d.name},
        ${d.mimeType ?? null},
        ${d.sizeBytes ?? null},
        ${d.clientId ?? null},
        ${d.projectId ?? null},
        ${d.taskId ?? null},
        ${d.invoiceId ?? null},
        ${d.expenseId ?? null},
        ${d.documentType ?? null},
        ${d.description ?? null},
        ${userId},
        ${d.folderId ?? null},
        ${d.r2Key}
      )
      returning
        id,
        name,
        mime_type,
        size_bytes,
        client_id,
        project_id,
        task_id,
        invoice_id,
        expense_id,
        document_type,
        description,
        uploaded_by,
        folder_id,
        r2_key,
        is_public,
        share_token,
        share_expires_at,
        created_at
    `);
    const row = inserted.rows[0] as {
      id: string;
      name: string;
      mime_type: string | null;
      size_bytes: number | null;
      client_id: string | null;
      project_id: string | null;
      task_id: string | null;
      invoice_id: string | null;
      expense_id: string | null;
      document_type: FileDocumentType | null;
      description: string | null;
      uploaded_by: string | null;
      folder_id: string | null;
      r2_key: string | null;
      is_public: boolean;
      share_token: string | null;
      share_expires_at: Date | null;
      created_at: Date;
    } | undefined;

    if (!row) return { ok: false as const, error: { _form: ["Failed to create file record"] } };

    let clientIdForLog = row.client_id;
    if (!clientIdForLog && row.project_id) {
      const [p] = await db
        .select({ clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, row.project_id))
        .limit(1);
      clientIdForLog = p?.clientId ?? null;
    }
    if (!clientIdForLog && row.invoice_id) {
      const [inv] = await db
        .select({ clientId: invoices.clientId })
        .from(invoices)
        .where(eq(invoices.id, row.invoice_id))
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
          projectId: row.project_id,
        },
      });
    }

    let uploadedByName: string | null = null;
    let uploadedByAvatarUrl: string | null = null;
    if (row.uploaded_by) {
      const [tm] = await db
        .select({ name: teamMembers.name, avatarUrl: teamMembers.avatarUrl })
        .from(teamMembers)
        .where(eq(teamMembers.userId, row.uploaded_by))
        .limit(1);
      uploadedByName = tm?.name ?? null;
      uploadedByAvatarUrl = tm?.avatarUrl ?? null;
    }

    const key = (row.r2_key ?? d.r2Key).trim();
    const data: FileRow = {
      id: row.id,
      name: row.name,
      r2Key: key,
      publicFileUrl: publicUrlFromR2Key(key),
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      clientId: row.client_id,
      projectId: row.project_id,
      taskId: row.task_id ?? null,
      invoiceId: row.invoice_id ?? null,
      expenseId: row.expense_id ?? null,
      documentType: row.document_type ?? null,
      description: row.description ?? null,
      uploadedBy: row.uploaded_by ?? null,
      uploadedByName,
      uploadedByAvatarUrl,
      createdAt: row.created_at,
      folderId: row.folder_id ?? null,
      isPublic: row.is_public ?? false,
      shareToken: row.share_token ?? null,
      shareExpiresAt: row.share_expires_at ?? null,
    };

    const isStandaloneScope =
      !row.client_id &&
      !row.project_id &&
      !row.task_id &&
      !row.invoice_id &&
      !row.expense_id;
    if (isStandaloneScope) {
      revalidatePath("/dashboard/drive");
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/expenses");
    if (row.client_id) revalidatePath(`/dashboard/clients/${row.client_id}`);
    if (row.project_id) revalidatePath(`/dashboard/projects/${row.project_id}`);
    if (row.invoice_id) revalidatePath(`/dashboard/invoices/${row.invoice_id}`);
    if (row.expense_id) revalidatePath(`/dashboard/expenses/${row.expense_id}`);
    if (row.task_id) {
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
      r2Key: files.r2Key,
      clientId: files.clientId,
      projectId: files.projectId,
      taskId: files.taskId,
      invoiceId: files.invoiceId,
      expenseId: files.expenseId,
      uploadedBy: files.uploadedBy,
      folderId: files.folderId,
    })
    .from(files)
    .where(eq(files.id, parsed.data));

  if (!row) {
    return { ok: false as const, error: "File not found" };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return { ok: false as const, error: "Not authorized" };
  const role = sessionUserRole(session);

  if (role === "member") {
    if (row.taskId) {
      const assigned = await memberIsAssignedToTask(row.taskId, userId);
      if (!assigned) return { ok: false as const, error: "Forbidden" };
      if (row.uploadedBy !== userId) {
        return { ok: false as const, error: "Forbidden" };
      }
    } else if (row.projectId) {
      if (!row.folderId) return { ok: false as const, error: "Forbidden" };
      const allowed = await memberHasAccessToProjectFolder(userId, row.folderId);
      if (!allowed) return { ok: false as const, error: "Forbidden" };
    }
  }

  const storageKey = fileStorageKey(row);
  if (storageKey) {
    try {
      await deleteFromR2(storageKey);
    } catch (e) {
      console.error("R2 delete error", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to delete file from storage",
      };
    }
  }

  await db.delete(files).where(eq(files.id, parsed.data));

  const isStandaloneScope =
    !row.clientId &&
    !row.projectId &&
    !row.taskId &&
    !row.invoiceId &&
    !row.expenseId;
  if (isStandaloneScope) {
    revalidatePath("/dashboard/drive");
  }

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

const moveFileSchema = z.object({
  fileId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});

export async function moveFile(fileId: string, folderId: string | null) {
  const parsed = moveFileSchema.safeParse({ fileId, folderId });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };
  const uid = session.user.id;
  const role = sessionUserRole(session);

  try {
    const [fileRow] = await db
      .select({
        id: files.id,
        projectId: files.projectId,
        folderId: files.folderId,
      })
      .from(files)
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .limit(1);
    if (!fileRow) return { ok: false as const, error: { _form: ["File not found"] } };

    if (role === "member" && fileRow.projectId) {
      if (!fileRow.folderId || !parsed.data.folderId) {
        return { ok: false as const, error: { _form: ["Forbidden"] } };
      }
      const srcOk = await memberHasAccessToProjectFolder(uid, fileRow.folderId);
      const destOk = await memberHasAccessToProjectFolder(uid, parsed.data.folderId);
      if (!srcOk || !destOk) {
        return { ok: false as const, error: { _form: ["Forbidden"] } };
      }
    }

    const updated = await db.execute(sql`
      update files
      set folder_id = ${parsed.data.folderId}
      where id = ${parsed.data.fileId} and deleted_at is null
      returning id, client_id, project_id, folder_id
    `);
    const row = updated.rows[0] as
      | { id: string; client_id: string | null; project_id: string | null; folder_id: string | null }
      | undefined;
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    if (row.client_id) revalidatePath(`/dashboard/clients/${row.client_id}`);
    if (row.project_id) revalidatePath(`/dashboard/projects/${row.project_id}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("moveFile", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

const renameFileSchema = z.object({
  fileId: z.string().uuid(),
  newName: z.string().min(1).max(500),
});

export async function renameFile(fileId: string, newName: string) {
  const parsed = renameFileSchema.safeParse({ fileId, newName });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };
  const role = sessionUserRole(session);

  try {
    const [existing] = await db
      .select({
        id: files.id,
        projectId: files.projectId,
        folderId: files.folderId,
      })
      .from(files)
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .limit(1);
    if (!existing) return { ok: false as const, error: { _form: ["File not found"] } };
    if (role === "member" && existing.projectId) {
      if (!existing.folderId) return { ok: false as const, error: { _form: ["Forbidden"] } };
      const allowed = await memberHasAccessToProjectFolder(session.user.id, existing.folderId);
      if (!allowed) return { ok: false as const, error: { _form: ["Forbidden"] } };
    }

    const [row] = await db
      .update(files)
      .set({ name: parsed.data.newName.trim() })
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("renameFile", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

export async function toggleFilePublic(fileId: string) {
  const parsed = z.string().uuid().safeParse(fileId);
  if (!parsed.success) return { ok: false as const, error: { _form: ["Invalid file id"] } };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  try {
    const existingRes = await db.execute(sql`
      select id, is_public, share_token, share_expires_at, project_id, folder_id
      from files
      where id = ${parsed.data} and deleted_at is null
      limit 1
    `);
    const existing = existingRes.rows[0] as
      | {
          id: string;
          is_public: boolean;
          share_token: string | null;
          share_expires_at: Date | null;
          project_id: string | null;
          folder_id: string | null;
        }
      | undefined;
    if (!existing) return { ok: false as const, error: { _form: ["File not found"] } };
    if (sessionUserRole(session) === "member" && existing.project_id) {
      if (!existing.folder_id) return { ok: false as const, error: { _form: ["Forbidden"] } };
      const allowed = await memberHasAccessToProjectFolder(session.user.id, existing.folder_id);
      if (!allowed) return { ok: false as const, error: { _form: ["Forbidden"] } };
    }

    const nextPublic = !existing.is_public;
    let shareToken: string | null = existing.share_token;
    let shareExpiresAt: Date | null = existing.share_expires_at;
    if (nextPublic) {
      if (!shareToken) shareToken = nanoid(16);
    } else {
      shareToken = null;
      shareExpiresAt = null;
    }

    const updateRes = await db.execute(sql`
      update files
      set is_public = ${nextPublic}, share_token = ${shareToken}, share_expires_at = ${shareExpiresAt}
      where id = ${parsed.data}
      returning id, is_public, share_token, share_expires_at
    `);
    const row = updateRes.rows[0] as
      | { id: string; is_public: boolean; share_token: string | null; share_expires_at: Date | null }
      | undefined;

    if (!row) return { ok: false as const, error: { _form: ["Update failed"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return {
      ok: true as const,
      data: {
        id: row.id,
        isPublic: row.is_public,
        shareToken: row.share_token,
        shareExpiresAt: row.share_expires_at,
      },
    };
  } catch (e) {
    console.error("toggleFilePublic", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

const createShareLinkSchema = z.object({
  fileId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function createShareLink(fileId: string, expiresInDays?: number) {
  const parsed = createShareLinkSchema.safeParse({ fileId, expiresInDays });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  let shareExpiresAt: Date | null = null;
  if (parsed.data.expiresInDays != null) {
    const d = new Date();
    d.setDate(d.getDate() + parsed.data.expiresInDays);
    shareExpiresAt = d;
  }

  try {
    const existingRes = await db.execute(sql`
      select id, is_public, share_token, project_id, folder_id
      from files
      where id = ${parsed.data.fileId} and deleted_at is null
      limit 1
    `);
    const existing = existingRes.rows[0] as
      | {
          id: string;
          is_public: boolean;
          share_token: string | null;
          project_id: string | null;
          folder_id: string | null;
        }
      | undefined;
    if (!existing) return { ok: false as const, error: { _form: ["File not found"] } };
    if (sessionUserRole(session) === "member" && existing.project_id) {
      if (!existing.folder_id) return { ok: false as const, error: { _form: ["Forbidden"] } };
      const allowed = await memberHasAccessToProjectFolder(session.user.id, existing.folder_id);
      if (!allowed) return { ok: false as const, error: { _form: ["Forbidden"] } };
    }

    const token =
      existing.is_public && existing.share_token?.trim()
        ? existing.share_token.trim()
        : nanoid(16);

    const updateRes = await db.execute(sql`
      update files
      set share_token = ${token}, share_expires_at = ${shareExpiresAt}, is_public = true
      where id = ${parsed.data.fileId} and deleted_at is null
      returning id, is_public, share_token, share_expires_at
    `);
    const row = updateRes.rows[0] as
      | { id: string; is_public: boolean; share_token: string | null; share_expires_at: Date | null }
      | undefined;
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return {
      ok: true as const,
      data: {
        shareToken: token,
        shareExpiresAt,
        file: {
          id: row.id,
          isPublic: row.is_public,
          shareToken: row.share_token,
          shareExpiresAt: row.share_expires_at,
        },
      },
    };
  } catch (e) {
    console.error("createShareLink", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

const setShareExpirySchema = z.object({
  fileId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).nullable(),
});

/** `expiresInDays: null` removes expiry (link stays valid until revoked). */
export async function setShareLinkExpiryDays(fileId: string, expiresInDays: number | null) {
  const parsed = setShareExpirySchema.safeParse({ fileId, expiresInDays });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  let shareExpiresAt: Date | null = null;
  if (parsed.data.expiresInDays != null) {
    const d = new Date();
    d.setDate(d.getDate() + parsed.data.expiresInDays);
    shareExpiresAt = d;
  }

  try {
    const [before] = await db
      .select({ projectId: files.projectId, folderId: files.folderId })
      .from(files)
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .limit(1);
    if (!before) return { ok: false as const, error: { _form: ["File not found"] } };
    if (sessionUserRole(session) === "member" && before.projectId) {
      if (!before.folderId) return { ok: false as const, error: { _form: ["Forbidden"] } };
      const allowed = await memberHasAccessToProjectFolder(session.user.id, before.folderId);
      if (!allowed) return { ok: false as const, error: { _form: ["Forbidden"] } };
    }

    const updateRes = await db.execute(sql`
      update files
      set share_expires_at = ${shareExpiresAt}
      where id = ${parsed.data.fileId}
        and deleted_at is null
        and is_public = true
        and share_token is not null
      returning id, is_public, share_token, share_expires_at
    `);
    const row = updateRes.rows[0] as
      | { id: string; is_public: boolean; share_token: string | null; share_expires_at: Date | null }
      | undefined;
    if (!row) return { ok: false as const, error: { _form: ["File not found or not shared"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return {
      ok: true as const,
      data: {
        id: row.id,
        isPublic: row.is_public,
        shareToken: row.share_token,
        shareExpiresAt: row.share_expires_at,
      },
    };
  } catch (e) {
    console.error("setShareLinkExpiryDays", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

export async function revokeShareLink(fileId: string) {
  const parsed = z.string().uuid().safeParse(fileId);
  if (!parsed.success) return { ok: false as const, error: { _form: ["Invalid file id"] } };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  try {
    const updateRes = await db.execute(sql`
      update files
      set share_token = null, share_expires_at = null, is_public = false
      where id = ${parsed.data} and deleted_at is null
      returning id, is_public, share_token, share_expires_at
    `);
    const row = updateRes.rows[0] as
      | { id: string; is_public: boolean; share_token: string | null; share_expires_at: Date | null }
      | undefined;
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return {
      ok: true as const,
      data: {
        id: row.id,
        isPublic: row.is_public,
        shareToken: row.share_token,
        shareExpiresAt: row.share_expires_at,
      },
    };
  } catch (e) {
    console.error("revokeShareLink", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

export type SharedFileGuestPayload = {
  id: string;
  name: string;
  publicFileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  shareExpiresAt: Date | null;
};

export type ShareTokenFailureReason = "invalid" | "not_found" | "expired" | "forbidden";

export async function getFileByShareToken(
  token: string
): Promise<
  | { ok: true; data: SharedFileGuestPayload }
  | { ok: false; reason: ShareTokenFailureReason }
> {
  const parsed = z.string().min(8).max(64).safeParse(token);
  if (!parsed.success) {
    return { ok: false as const, reason: "invalid" as const };
  }

  try {
    const [row] = await db
      .select({
        id: files.id,
        name: files.name,
        r2Key: files.r2Key,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        isPublic: files.isPublic,
        shareToken: files.shareToken,
        shareExpiresAt: files.shareExpiresAt,
      })
      .from(files)
      .where(
        and(
          eq(files.shareToken, parsed.data),
          isNotNull(files.shareToken),
          isNull(files.deletedAt)
        )
      )
      .limit(1);

    if (!row) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (!row.isPublic) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    if (row.shareExpiresAt != null && row.shareExpiresAt < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }

    return {
      ok: true as const,
      data: {
        id: row.id,
        name: row.name,
        publicFileUrl: publicUrlFromR2Key(row.r2Key),
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        shareExpiresAt: row.shareExpiresAt,
      },
    };
  } catch (e) {
    console.error("getFileByShareToken", e);
    return { ok: false as const, reason: "not_found" as const };
  }
}

function mapFileRowFromJoin(r: {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  expenseId: string | null;
  documentType: FileDocumentType | null;
  description: string | null;
  uploadedBy: string | null;
  folderId: string | null;
  r2Key: string | null;
  isPublic: boolean;
  shareToken: string | null;
  shareExpiresAt: Date | null;
  uploadedByName: string | null;
  uploadedByAvatarUrl: string | null;
  createdAt: Date;
}): FileRow {
  const key = r.r2Key?.trim() ?? "";
  return {
    id: r.id,
    name: r.name,
    r2Key: key,
    publicFileUrl: publicUrlFromR2Key(r.r2Key),
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
    folderId: r.folderId ?? null,
    isPublic: r.isPublic ?? false,
    shareToken: r.shareToken ?? null,
    shareExpiresAt: r.shareExpiresAt ?? null,
  };
}

/** Recent uploads across the agency (for Drive quick-upload strip). */
export async function getRecentUploadsForDashboard(limit = 10) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, error: "Not authorized", data: [] as FileRow[] };
  }
  const lim = Math.min(Math.max(1, limit), 50);
  try {
    const rows = await db
      .select({
        id: files.id,
        name: files.name,
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
        folderId: files.folderId,
        r2Key: files.r2Key,
        isPublic: files.isPublic,
        shareToken: files.shareToken,
        shareExpiresAt: files.shareExpiresAt,
        uploadedByName: teamMembers.name,
        uploadedByAvatarUrl: teamMembers.avatarUrl,
        createdAt: files.createdAt,
      })
      .from(files)
      .leftJoin(teamMembers, eq(teamMembers.userId, files.uploadedBy))
      .where(isNull(files.deletedAt))
      .orderBy(desc(files.createdAt))
      .limit(lim);

    const data: FileRow[] = rows.map((r) => mapFileRowFromJoin(r));
    return { ok: true as const, data };
  } catch (e) {
    console.error("getRecentUploadsForDashboard", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FileRow[] };
    }
    return { ok: false as const, error: "Failed to load files", data: [] as FileRow[] };
  }
}

/** Total storage used by non-deleted file rows (informational). */
export async function getTotalFilesStorageBytes(input?: { standaloneDrive?: boolean; allForUser?: boolean; driveView?: boolean }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, error: "Not authorized", total: 0 };
  }
  try {
    const conditions = [isNull(files.deletedAt)];
    if (input?.driveView) {
      const scope = await driveViewScopedFolderIdsForUser();
      if (!scope.ok) {
        return { ok: false as const, error: scope.error, total: 0 };
      }
      if (scope.ids.length === 0) {
        return { ok: true as const, total: 0 };
      }
      conditions.push(inArray(files.folderId, scope.ids));
    } else if (input?.standaloneDrive || input?.allForUser) {
      conditions.push(eq(files.uploadedBy, session.user.id));
    }

    const [row] = await withDbReadRetry("getTotalFilesStorageBytes.total", () =>
      db
        .select({
          total: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::double precision`,
        })
        .from(files)
        .where(and(...conditions))
    );
    return { ok: true as const, total: Number(row?.total ?? 0) };
  } catch (e) {
    console.error("getTotalFilesStorageBytes", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), total: 0 };
    }
    return { ok: false as const, error: "Failed", total: 0 };
  }
}
