"use server";

import { z } from "zod";
import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db, folders, files, projects, folderAccess, teamMembers } from "@/lib/db";
import { deleteFromR2 } from "@/lib/r2";
import { authOptions } from "@/lib/auth";
import { findPostgresErrorCode, getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getMemberProjectIdsForUser, getTeamMemberIdsForSessionUser } from "@/lib/member-context";
import { resolveSharedFolderRoot } from "@/lib/shared-folder-access";

export type FolderRow = typeof folders.$inferSelect;

function storageKeyForFile(row: { r2Key: string | null }): string | null {
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

function sanitizePathSegment(name: string): string {
  return name.trim().replace(/\//g, "-").replace(/\s+/g, " ").slice(0, 200) || "untitled";
}

async function collectSubtreeFolderIds(rootId: string): Promise<string[]> {
  const out: string[] = [];
  let frontier: string[] = [rootId];
  while (frontier.length) {
    out.push(...frontier);
    const children = await db.select({ id: folders.id }).from(folders).where(inArray(folders.parentId, frontier));
    frontier = children.map((c) => c.id);
  }
  return out;
}

const createFolderSchema = z
  .object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
    clientId: z.string().uuid().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    accessTeamMemberIds: z.array(z.string().uuid()).optional(),
    /** Root folder under `/dashboard/drive` (requires session user). */
    standaloneRoot: z.boolean().optional(),
  })
  .refine((d) => d.parentId != null || d.clientId != null || d.projectId != null || d.standaloneRoot === true, {
    message: "Provide parentId or clientId or projectId or standaloneRoot",
  })
  .refine((d) => !d.standaloneRoot || (d.parentId == null && d.clientId == null && d.projectId == null), {
    message: "standaloneRoot is only valid for a root-level personal folder",
  });

export async function createFolder(input: z.infer<typeof createFolderSchema>) {
  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const { name, parentId, clientId, projectId, accessTeamMemberIds, standaloneRoot } = parsed.data;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return { ok: false as const, error: { _form: ["Not authorized"] } };
  const role = sessionUserRole(session);

  const segment = sanitizePathSegment(name);
  try {
    let path: string;
    let resolvedClientId: string | null = clientId ?? null;
    let resolvedProjectId: string | null = projectId ?? null;

    if (parentId) {
      const [parent] = await db.select().from(folders).where(eq(folders.id, parentId)).limit(1);
      if (!parent) return { ok: false as const, error: { _form: ["Parent folder not found"] } };
      if (!parent.clientId && !parent.projectId && !parent.path.startsWith(`/drive/user/${userId}/`)) {
        return { ok: false as const, error: { _form: ["Invalid parent folder"] } };
      }
      resolvedClientId = parent.clientId;
      resolvedProjectId = parent.projectId;
      if (role === "member" && !resolvedProjectId) {
        return { ok: false as const, error: { _form: ["Members can only create project folders"] } };
      }
      if (role === "member" && resolvedProjectId) {
        const allowedProjects = await getMemberProjectIdsForUser(userId);
        if (!allowedProjects.includes(resolvedProjectId)) {
          return { ok: false as const, error: { _form: ["Forbidden"] } };
        }
      }
      const base = parent.path.endsWith("/") ? parent.path.slice(0, -1) : parent.path;
      path = `${base}/${segment}`;
    } else {
      if (standaloneRoot) {
        if (role === "member") {
          return { ok: false as const, error: { _form: ["Members cannot create standalone folders"] } };
        }
        if (!userId) return { ok: false as const, error: { _form: ["Not authorized"] } };
        path = `/drive/user/${userId}/${segment}`;
        resolvedClientId = null;
        resolvedProjectId = null;
      } else if (resolvedClientId) path = `/client/${resolvedClientId}/${segment}`;
      else if (resolvedProjectId) {
        if (role === "member") {
          const allowedProjects = await getMemberProjectIdsForUser(userId);
          if (!allowedProjects.includes(resolvedProjectId)) {
            return { ok: false as const, error: { _form: ["Forbidden"] } };
          }
        }
        path = `/project/${resolvedProjectId}/${segment}`;
      }
      else return { ok: false as const, error: { _form: ["clientId or projectId required for root folder"] } };
    }

    const [row] = await db
      .insert(folders)
      .values({
        name: name.trim(),
        parentId: parentId ?? null,
        clientId: resolvedClientId,
        projectId: resolvedProjectId,
        path,
        createdBy: userId,
      })
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Failed to create folder"] } };

    if (row.projectId && accessTeamMemberIds && accessTeamMemberIds.length > 0) {
      const dedup = Array.from(new Set(accessTeamMemberIds));
      try {
        await db.insert(folderAccess).values(
          dedup.map((teamMemberId) => ({
            folderId: row.id,
            teamMemberId,
          }))
        );
      } catch (e) {
        const pgCode = findPostgresErrorCode(e);
        if (pgCode !== "23505") throw e;
      }
    }

    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
    if (!row.clientId && !row.projectId) revalidatePath("/dashboard/drive");

    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createFolder", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to create folder"] } };
  }
}

const renameFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
});

export async function renameFolder(id: string, name: string) {
  const parsed = renameFolderSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  try {
    const [existing] = await db.select().from(folders).where(eq(folders.id, parsed.data.id)).limit(1);
    if (!existing) return { ok: false as const, error: { _form: ["Folder not found"] } };
    if (!existing.clientId && !existing.projectId) {
      if (!existing.path.startsWith(`/drive/user/${session.user.id}/`)) {
        return { ok: false as const, error: { _form: ["Forbidden"] } };
      }
    }

    const [row] = await db
      .update(folders)
      .set({ name: parsed.data.name.trim() })
      .where(eq(folders.id, parsed.data.id))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Folder not found"] } };
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
    if (!row.clientId && !row.projectId) revalidatePath("/dashboard/drive");
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("renameFolder", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

export async function deleteFolder(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "Invalid folder id" };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: "Not authorized" };

  try {
    const subtreeIds = await collectSubtreeFolderIds(parsed.data);
    const fileRows = await db
      .select({ id: files.id, r2Key: files.r2Key })
      .from(files)
      .where(and(inArray(files.folderId, subtreeIds), isNull(files.deletedAt)));

    for (const f of fileRows) {
      const key = storageKeyForFile(f);
      if (!key) continue;
      try {
        await deleteFromR2(key);
      } catch (e) {
        console.error("deleteFolder R2", f.id, e);
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "Failed to delete file from storage",
        };
      }
    }

    await db.delete(files).where(inArray(files.folderId, subtreeIds));

    const [root] = await db.select().from(folders).where(eq(folders.id, parsed.data)).limit(1);
    if (!root) return { ok: false as const, error: "Folder not found" };
    const uid = session.user.id;
    if (!root.clientId && !root.projectId) {
      if (!root.path.startsWith(`/drive/user/${uid}/`)) {
        return { ok: false as const, error: "Forbidden" };
      }
    }
    await db.delete(folders).where(eq(folders.id, parsed.data));

    if (root?.clientId) revalidatePath(`/dashboard/clients/${root.clientId}`);
    if (root?.projectId) revalidatePath(`/dashboard/projects/${root.projectId}`);
    if (root && !root.clientId && !root.projectId) revalidatePath("/dashboard/drive");

    return { ok: true as const };
  } catch (e) {
    console.error("deleteFolder", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to delete folder" };
  }
}

const listFoldersSchema = z
  .object({
    parentId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
  })
  .refine((d) => d.parentId != null || d.clientId != null || d.projectId != null, {
    message: "Provide parentId and/or clientId and/or projectId",
  });

export async function getFolders(params: z.infer<typeof listFoldersSchema>) {
  const parsed = listFoldersSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid params", data: [] as FolderRow[] };
  }
  const { parentId, clientId, projectId } = parsed.data;
  try {
    const conditions = [];
    if (parentId) {
      conditions.push(eq(folders.parentId, parentId));
    } else {
      conditions.push(isNull(folders.parentId));
    }
    if (clientId) conditions.push(eq(folders.clientId, clientId));
    if (projectId) conditions.push(eq(folders.projectId, projectId));

    const rows = await db
      .select()
      .from(folders)
      .where(and(...conditions))
      .orderBy(asc(folders.path));

    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getFolders", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderRow[] };
    }
    return { ok: false as const, error: "Failed to load folders", data: [] as FolderRow[] };
  }
}

const allFoldersScopeSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
  })
  .refine((d) => (d.clientId != null) !== (d.projectId != null), {
    message: "Provide exactly one of clientId or projectId",
  });

/** All folders in a client or project scope (full tree for drive UI). */
export async function getAllFoldersForScope(params: z.infer<typeof allFoldersScopeSchema>) {
  const parsed = allFoldersScopeSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid params", data: [] as FolderRow[] };
  }
  const { clientId, projectId } = parsed.data;
  try {
    const rows = await db
      .select()
      .from(folders)
      .where(clientId ? eq(folders.clientId, clientId) : eq(folders.projectId, projectId!))
      .orderBy(asc(folders.path));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getAllFoldersForScope", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderRow[] };
    }
    return { ok: false as const, error: "Failed to load folders", data: [] as FolderRow[] };
  }
}

/** Personal drive folders for the current user (`/drive/user/{userId}/…`). */
export async function getAllStandaloneFolders() {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  if (!uid) {
    return { ok: false as const, error: "Not authorized", data: [] as FolderRow[] };
  }
  const prefix = `/drive/user/${uid}/`;
  try {
    const rows = await withDbReadRetry("getAllStandaloneFolders.rows", () =>
      db
        .select()
        .from(folders)
        .where(
          and(isNull(folders.clientId), isNull(folders.projectId), sql`${folders.path} like ${prefix + "%"}`)
        )
        .orderBy(asc(folders.path))
    );
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("getAllStandaloneFolders", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderRow[] };
    }
    return { ok: false as const, error: "Failed to load folders", data: [] as FolderRow[] };
  }
}

/**
 * Drive tree folders for current user:
 * - personal standalone folders (`/drive/user/{uid}/...`)
 * - project folders (`/project/{projectId}/...`) for accessible projects
 */
export async function getDriveFolders() {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  if (!uid) {
    return { ok: false as const, error: "Not authorized", data: [] as FolderRow[] };
  }
  try {
    const role = sessionUserRole(session);
    let projectIds: string[] = [];
    let memberIds: string[] = [];
    if (role === "member") {
      projectIds = await getMemberProjectIdsForUser(uid);
      memberIds = await getTeamMemberIdsForSessionUser(uid);
    } else {
      const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(isNull(projects.deletedAt));
      projectIds = rows.map((r) => r.id);
    }

    const standalonePrefix = `/drive/user/${uid}/`;
    const scopeCond =
      projectIds.length > 0
        ? or(
            role === "member"
              ? sql`false`
              : and(
                  isNull(folders.clientId),
                  isNull(folders.projectId),
                  sql`${folders.path} like ${standalonePrefix + "%"}`
                ),
            inArray(folders.projectId, projectIds)
          )
        : role === "member"
          ? sql`false`
          : and(
              isNull(folders.clientId),
              isNull(folders.projectId),
              sql`${folders.path} like ${standalonePrefix + "%"}`
            );

    const rows = await db
      .select()
      .from(folders)
      .where(scopeCond)
      .orderBy(asc(folders.path));

    if (role !== "member") {
      return { ok: true as const, data: rows };
    }
    if (rows.length === 0) {
      return { ok: true as const, data: rows };
    }

    const aclRows = await db
      .select({ folderId: folderAccess.folderId, teamMemberId: folderAccess.teamMemberId })
      .from(folderAccess)
      .where(inArray(folderAccess.folderId, rows.map((r) => r.id)));
    const aclMap = new Map<string, string[]>();
    for (const a of aclRows) {
      const list = aclMap.get(a.folderId) ?? [];
      list.push(a.teamMemberId);
      aclMap.set(a.folderId, list);
    }

    const filtered = rows.filter((f) => {
      if (!f.projectId) return false;
      const acl = aclMap.get(f.id);
      if (!acl || acl.length === 0) return true;
      return acl.some((id) => memberIds.includes(id));
    });
    return { ok: true as const, data: filtered };
  } catch (e) {
    console.error("getDriveFolders", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderRow[] };
    }
    return { ok: false as const, error: "Failed to load drive folders", data: [] as FolderRow[] };
  }
}

/**
 * Set folder public sharing to an explicit state (avoids flip/toggle bugs with the UI switch).
 * When enabling, always ensures a `shareToken` exists.
 */
export async function setFolderPublicSharing(folderId: string, enabled: boolean) {
  const parsed = z.string().uuid().safeParse(folderId);
  if (!parsed.success) return { ok: false as const, error: { _form: ["Invalid folder id"] } };
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: { _form: ["Not authorized"] } };
  const role = sessionUserRole(session);
  try {
    const [existing] = await db.select().from(folders).where(eq(folders.id, parsed.data)).limit(1);
    if (!existing) return { ok: false as const, error: { _form: ["Folder not found"] } };
    if (role === "member") {
      const projectsAllowed = await getMemberProjectIdsForUser(userId);
      if (!existing.projectId || !projectsAllowed.includes(existing.projectId)) {
        return { ok: false as const, error: { _form: ["Forbidden"] } };
      }
    }
    if (existing.isPublic === enabled && (!enabled || (existing.shareToken?.trim() ?? "").length > 0)) {
      return { ok: true as const, data: existing };
    }
    const token = enabled ? (existing.shareToken?.trim() || nanoid(20)) : null;
    const [row] = await db
      .update(folders)
      .set({
        isPublic: enabled,
        shareToken: token,
        shareExpiresAt: enabled ? existing.shareExpiresAt : null,
      })
      .where(eq(folders.id, parsed.data))
      .returning();
    if (!row) return { ok: false as const, error: { _form: ["Folder not found"] } };
    revalidatePath("/dashboard/drive");
    revalidatePath("/dashboard/member-drive");
    if (enabled && row.shareToken) {
      revalidatePath(`/share/folder/${row.shareToken}`);
    }
    return { ok: true as const, data: row };
  } catch (e) {
    console.error("setFolderPublicSharing", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

/** @deprecated Use setFolderPublicSharing; kept for any external callers. */
export async function toggleFolderPublic(folderId: string) {
  const parsed = z.string().uuid().safeParse(folderId);
  if (!parsed.success) return { ok: false as const, error: { _form: ["Invalid folder id"] } };
  const [existing] = await db.select().from(folders).where(eq(folders.id, parsed.data)).limit(1);
  if (!existing) return { ok: false as const, error: { _form: ["Folder not found"] } };
  return setFolderPublicSharing(folderId, !existing.isPublic);
}

export async function setFolderAccess(folderId: string, teamMemberIds: string[]) {
  const parsed = z.object({ folderId: z.string().uuid(), teamMemberIds: z.array(z.string().uuid()) }).safeParse({ folderId, teamMemberIds });
  if (!parsed.success) return { ok: false as const, error: { _form: ["Invalid input"] } };
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: { _form: ["Not authorized"] } };
  const role = sessionUserRole(session);
  try {
    const [folder] = await db.select().from(folders).where(eq(folders.id, parsed.data.folderId)).limit(1);
    if (!folder) return { ok: false as const, error: { _form: ["Folder not found"] } };
    if (!folder.projectId) return { ok: false as const, error: { _form: ["Access list is only for project folders"] } };
    if (role === "member") {
      const allowed = await getMemberProjectIdsForUser(userId);
      if (!allowed.includes(folder.projectId)) return { ok: false as const, error: { _form: ["Forbidden"] } };
    }
    await db.delete(folderAccess).where(eq(folderAccess.folderId, folder.id));
    const dedup = Array.from(new Set(parsed.data.teamMemberIds));
    if (dedup.length > 0) {
      await db.insert(folderAccess).values(
        dedup.map((teamMemberId) => ({ folderId: folder.id, teamMemberId }))
      );
    }
    revalidatePath("/dashboard/drive");
    return { ok: true as const };
  } catch (e) {
    console.error("setFolderAccess", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed"] } };
  }
}

export async function getFolderAccess(folderId: string) {
  const parsed = z.string().uuid().safeParse(folderId);
  if (!parsed.success) return { ok: false as const, error: "Invalid folder id", data: [] as string[] };
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Not authorized", data: [] as string[] };
  const role = sessionUserRole(session);
  try {
    const [folder] = await db.select().from(folders).where(eq(folders.id, parsed.data)).limit(1);
    if (!folder) return { ok: false as const, error: "Folder not found", data: [] as string[] };
    if (role === "member") {
      const allowed = await getMemberProjectIdsForUser(userId);
      if (!folder.projectId || !allowed.includes(folder.projectId)) {
        return { ok: false as const, error: "Forbidden", data: [] as string[] };
      }
    }
    const rows = await db
      .select({ teamMemberId: folderAccess.teamMemberId })
      .from(folderAccess)
      .where(eq(folderAccess.folderId, folder.id));
    return { ok: true as const, data: rows.map((r) => r.teamMemberId) };
  } catch (e) {
    console.error("getFolderAccess", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as string[] };
    }
    return { ok: false as const, error: "Failed", data: [] as string[] };
  }
}

export async function getFolderByShareToken(token: string) {
  try {
    const rootRes = await resolveSharedFolderRoot(token);
    if (!rootRes.ok) {
      return { ok: false as const, reason: rootRes.reason };
    }
    const folder = rootRes.root;
    const prefix = folder.path.endsWith("/") ? folder.path : `${folder.path}/`;
    const childFolders = await db
      .select({ id: folders.id, name: folders.name, path: folders.path })
      .from(folders)
      .where(sql`${folders.path} like ${prefix + "%"}`)
      .orderBy(asc(folders.path));
    const childFiles = await db
      .select({
        id: files.id,
        name: files.name,
        imagekitUrl: files.imagekitUrl,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        folderId: files.folderId,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(isNull(files.deletedAt), sql`${files.folderId} in (select id from folders where path like ${prefix + "%"})`))
      .orderBy(asc(files.name));
    return { ok: true as const, data: { folder, childFolders, childFiles } };
  } catch (e) {
    console.error("getFolderByShareToken", e);
    return { ok: false as const, reason: "failed" as const };
  }
}

export async function getFolderBreadcrumbs(folderId: string) {
  const parsed = z.string().uuid().safeParse(folderId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid folder id", data: [] as { id: string; name: string }[] };
  }
  try {
    const crumbs: { id: string; name: string }[] = [];
    let currentId: string | null = parsed.data;
    const guard = new Set<string>();
    while (currentId && !guard.has(currentId)) {
      guard.add(currentId);
      const [f] = await db
        .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
        .from(folders)
        .where(eq(folders.id, currentId))
        .limit(1);
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name });
      currentId = f.parentId;
    }
    return { ok: true as const, data: crumbs };
  } catch (e) {
    console.error("getFolderBreadcrumbs", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as { id: string; name: string }[] };
    }
    return { ok: false as const, error: "Failed to load breadcrumbs", data: [] as { id: string; name: string }[] };
  }
}

const moveFolderSchema = z.object({
  folderId: z.string().uuid(),
  newParentId: z.string().uuid().nullable(),
});

export async function moveFolder(folderId: string, newParentId: string | null) {
  const parsed = moveFolderSchema.safeParse({ folderId, newParentId });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: { _form: ["Not authorized"] } };

  try {
    const [moving] = await db.select().from(folders).where(eq(folders.id, parsed.data.folderId)).limit(1);
    if (!moving) return { ok: false as const, error: { _form: ["Folder not found"] } };

    const subtree = await collectSubtreeFolderIds(parsed.data.folderId);
    if (parsed.data.newParentId && subtree.includes(parsed.data.newParentId)) {
      return { ok: false as const, error: { _form: ["Cannot move folder into its own descendant"] } };
    }

    let newPath: string;
    let newParentIdVal = parsed.data.newParentId;

    if (parsed.data.newParentId) {
      const [parent] = await db.select().from(folders).where(eq(folders.id, parsed.data.newParentId)).limit(1);
      if (!parent) return { ok: false as const, error: { _form: ["New parent not found"] } };
      if (parent.clientId !== moving.clientId || parent.projectId !== moving.projectId) {
        return { ok: false as const, error: { _form: ["Parent must belong to the same client/project scope"] } };
      }
      const base = parent.path.endsWith("/") ? parent.path.slice(0, -1) : parent.path;
      newPath = `${base}/${sanitizePathSegment(moving.name)}`;
    } else {
      newParentIdVal = null;
      if (moving.clientId) {
        newPath = `/client/${moving.clientId}/${sanitizePathSegment(moving.name)}`;
      } else if (moving.projectId) {
        newPath = `/project/${moving.projectId}/${sanitizePathSegment(moving.name)}`;
      } else {
        const uid = session.user.id;
        const prefix = `/drive/user/${uid}/`;
        if (!moving.path.startsWith(prefix)) {
          return { ok: false as const, error: { _form: ["Invalid personal folder"] } };
        }
        newPath = `${prefix}${sanitizePathSegment(moving.name)}`;
      }
    }

    const oldPath = moving.path;
    if (oldPath === newPath && moving.parentId === newParentIdVal) {
      return { ok: true as const, data: moving };
    }

    await db
      .update(folders)
      .set({ parentId: newParentIdVal, path: newPath })
      .where(eq(folders.id, moving.id));

    const descendants = await db
      .select()
      .from(folders)
      .where(and(sql`${folders.path} LIKE ${oldPath + "/%"}`, ne(folders.id, moving.id)));

    for (const d of descendants) {
      if (!d.path.startsWith(oldPath + "/")) continue;
      const suffix = d.path.slice(oldPath.length);
      const updatedPath = newPath + suffix;
      await db.update(folders).set({ path: updatedPath }).where(eq(folders.id, d.id));
    }

    const [updated] = await db.select().from(folders).where(eq(folders.id, moving.id)).limit(1);
    if (updated?.clientId) revalidatePath(`/dashboard/clients/${updated.clientId}`);
    if (updated?.projectId) revalidatePath(`/dashboard/projects/${updated.projectId}`);
    if (!updated?.clientId && !updated?.projectId) {
      revalidatePath("/dashboard/drive");
      revalidatePath("/dashboard/member-drive");
    }

    return { ok: true as const, data: updated! };
  } catch (e) {
    console.error("moveFolder", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to move folder"] } };
  }
}
