"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, isNotNull, and, desc, or, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { files, folders, projects, invoices, teamMembers, folderAccess } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { logActivityWithActor } from "@/actions/activity-log";
import { deleteFromR2 } from "@/lib/r2";
import { FILE_DOCUMENT_TYPES, type FileRow, type FileDocumentType } from "@/lib/file-types";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getMemberProjectIdsForUser, getTeamMemberIdsForSessionUser, memberIsAssignedToTask } from "@/lib/member-context";

function fileStorageKey(row: { r2Key: string | null; filePath: string }): string {
  const k = row.r2Key?.trim();
  return k && k.length > 0 ? k : row.filePath;
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
  folderId: z.string().uuid().optional(),
  r2Key: z.string().min(1).optional(),
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
  } = parsed.data;
  try {
    const conditions = [isNull(files.deletedAt)];

    if (driveView) {
      const session = await getServerSession(authOptions);
      const uid = session?.user?.id ?? null;
      if (!uid) return { ok: false as const, error: "Not authorized", data: [] as FileRow[] };
      const role = sessionUserRole(session);
      if (role === "member") {
        const projectIds = await getMemberProjectIdsForUser(uid);
        if (projectIds.length === 0) {
          return { ok: true as const, data: [] as FileRow[] };
        }
        const memberIds = await getTeamMemberIdsForSessionUser(uid);
        const driveFolders = await withDbReadRetry("getFiles.driveFolders", () =>
          db.select({ id: folders.id }).from(folders).where(inArray(folders.projectId, projectIds))
        );
        const folderIds = driveFolders.map((f) => f.id);
        if (folderIds.length === 0) {
          conditions.push(inArray(files.projectId, projectIds));
        } else {
          const acl = await withDbReadRetry("getFiles.folderAcl", () =>
            db
              .select({ folderId: folderAccess.folderId, teamMemberId: folderAccess.teamMemberId })
              .from(folderAccess)
              .where(inArray(folderAccess.folderId, folderIds))
          );
          const aclMap = new Map<string, string[]>();
          for (const a of acl) {
            const list = aclMap.get(a.folderId) ?? [];
            list.push(a.teamMemberId);
            aclMap.set(a.folderId, list);
          }
          const allowedFolderIds = folderIds.filter((id) => {
            const row = aclMap.get(id);
            if (!row || row.length === 0) return true;
            return row.some((x) => memberIds.includes(x));
          });
          const driveCond =
            allowedFolderIds.length > 0
              ? or(
                  inArray(files.projectId, projectIds),
                  inArray(files.folderId, allowedFolderIds)
                )
              : inArray(files.projectId, projectIds);
          if (driveCond) conditions.push(driveCond);
        }
      }
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

    const rows = await withDbReadRetry("getFiles.rows", () =>
      db
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
        .orderBy(desc(files.createdAt))
    );

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
      folderId: r.folderId ?? null,
      r2Key: r.r2Key ?? null,
      isPublic: r.isPublic ?? false,
      shareToken: r.shareToken ?? null,
      shareExpiresAt: r.shareExpiresAt ?? null,
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

    const isPersonalDriveFile =
      d.clientId == null &&
      d.projectId == null &&
      d.taskId == null &&
      d.invoiceId == null &&
      d.expenseId == null;
    const role = sessionUserRole(session);
    if (role === "member" && isPersonalDriveFile) {
      if (!d.folderId) {
        return { ok: false as const, error: { _form: ["Members cannot upload standalone drive files"] } };
      }
      const [targetFolder] = await db.select().from(folders).where(eq(folders.id, d.folderId)).limit(1);
      if (!targetFolder?.projectId) {
        return { ok: false as const, error: { _form: ["Members can only upload to project folders"] } };
      }
      const allowedProjects = await getMemberProjectIdsForUser(userId ?? "");
      if (!allowedProjects.includes(targetFolder.projectId)) {
        return { ok: false as const, error: { _form: ["Forbidden"] } };
      }
      d.projectId = targetFolder.projectId;
    }
    if (isPersonalDriveFile && d.folderId != null && userId) {
      const [fol] = await db.select().from(folders).where(eq(folders.id, d.folderId)).limit(1);
      if (
        !fol ||
        fol.clientId != null ||
        fol.projectId != null ||
        !fol.path.startsWith(`/drive/user/${userId}/`)
      ) {
        return { ok: false as const, error: { _form: ["Invalid folder"] } };
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
        documentType: d.documentType ?? null,
        description: d.description ?? null,
        uploadedBy: userId,
        folderId: d.folderId ?? null,
        r2Key: d.r2Key ?? null,
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
      folderId: row.folderId ?? null,
      r2Key: row.r2Key ?? null,
      isPublic: row.isPublic ?? false,
      shareToken: row.shareToken ?? null,
      shareExpiresAt: row.shareExpiresAt ?? null,
    };

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
      filePath: files.filePath,
      r2Key: files.r2Key,
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

  try {
    const [row] = await db
      .update(files)
      .set({ folderId: parsed.data.folderId })
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
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

  try {
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
    const [existing] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, parsed.data), isNull(files.deletedAt)))
      .limit(1);
    if (!existing) return { ok: false as const, error: { _form: ["File not found"] } };

    const nextPublic = !existing.isPublic;
    let shareToken: string | null = existing.shareToken;
    let shareExpiresAt: Date | null = existing.shareExpiresAt;
    if (nextPublic) {
      if (!shareToken) shareToken = nanoid(16);
    } else {
      shareToken = null;
      shareExpiresAt = null;
    }

    const [row] = await db
      .update(files)
      .set({ isPublic: nextPublic, shareToken, shareExpiresAt })
      .where(eq(files.id, parsed.data))
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Update failed"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return { ok: true as const, data: row };
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
    const [existing] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .limit(1);
    if (!existing) return { ok: false as const, error: { _form: ["File not found"] } };

    const token =
      existing.isPublic && existing.shareToken?.trim()
        ? existing.shareToken.trim()
        : nanoid(16);

    const [row] = await db
      .update(files)
      .set({ shareToken: token, shareExpiresAt, isPublic: true })
      .where(and(eq(files.id, parsed.data.fileId), isNull(files.deletedAt)))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return { ok: true as const, data: { shareToken: token, shareExpiresAt, file: row } };
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
    const [row] = await db
      .update(files)
      .set({ shareExpiresAt })
      .where(
        and(
          eq(files.id, parsed.data.fileId),
          isNull(files.deletedAt),
          eq(files.isPublic, true),
          isNotNull(files.shareToken)
        )
      )
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["File not found or not shared"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return { ok: true as const, data: row };
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
    const [row] = await db
      .update(files)
      .set({ shareToken: null, shareExpiresAt: null, isPublic: false })
      .where(and(eq(files.id, parsed.data), isNull(files.deletedAt)))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["File not found"] } };
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/drive");
    return { ok: true as const, data: row };
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
  imagekitUrl: string;
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
        imagekitUrl: files.imagekitUrl,
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
        imagekitUrl: row.imagekitUrl,
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
  imagekitFileId: string;
  imagekitUrl: string;
  filePath: string;
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
  return {
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
    folderId: r.folderId ?? null,
    r2Key: r.r2Key ?? null,
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
      if (sessionUserRole(session) === "member") {
        const projectIds = await getMemberProjectIdsForUser(session.user.id);
        if (projectIds.length === 0) {
          return { ok: true as const, total: 0 };
        }
        conditions.push(inArray(files.projectId, projectIds));
      }
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
