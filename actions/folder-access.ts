"use server";

import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { collectSubtreeFolderIds } from "@/actions/folders";
import { notifyFolderAccessGranted } from "@/actions/notifications";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { db, folderAccess, folderAccessExclusions, folders, projects, teamMembers } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  expandFolderIdsWithAncestors,
  getAccessibleFolderIds,
  memberHasAccessToProjectFolder,
} from "@/lib/member-drive-access";

export type FolderAccessListEntry = {
  teamMemberId: string;
  memberName: string;
  memberAvatar: string | null;
  accessType: string;
  isDirect: boolean;
  excludedSubfolderIds: string[];
};

const uuid = z.string().uuid();

export async function grantFolderAccess(folderId: string, teamMemberId: string, accessType = "view") {
  const p = z
    .object({ folderId: uuid, teamMemberId: uuid, accessType: z.enum(["view", "upload"]).default("view") })
    .safeParse({ folderId, teamMemberId, accessType });
  if (!p.success) return { ok: false as const, error: "invalidInput" };

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")) };
  if (sessionUserRole(session) !== "admin") return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")) };

  try {
    const [folder] = await db.select().from(folders).where(eq(folders.id, p.data.folderId)).limit(1);
    if (!folder) return { ok: false as const, error: getDbErrorKey(new Error("Folder not found")) };

    const hadRow = await db
      .select({ id: folderAccess.id })
      .from(folderAccess)
      .where(and(eq(folderAccess.folderId, p.data.folderId), eq(folderAccess.teamMemberId, p.data.teamMemberId)))
      .limit(1);

    await db
      .insert(folderAccess)
      .values({
        folderId: p.data.folderId,
        teamMemberId: p.data.teamMemberId,
        accessType: p.data.accessType,
      })
      .onConflictDoNothing({ target: [folderAccess.folderId, folderAccess.teamMemberId] });

    if (!hadRow.length && folder.projectId) {
      const [proj] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, folder.projectId)).limit(1);
      await notifyFolderAccessGranted({
        folderId: folder.id,
        folderName: folder.name,
        projectId: folder.projectId,
        projectName: proj?.name ?? null,
        teamMemberIds: [p.data.teamMemberId],
        actorUserId: userId,
      });
    }

    revalidatePath("/dashboard/drive");
    revalidatePath("/dashboard/member-drive");
    return { ok: true as const };
  } catch (e) {
    console.error("grantFolderAccess", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export async function revokeFolderAccess(folderId: string, teamMemberId: string) {
  const p = z.object({ folderId: uuid, teamMemberId: uuid }).safeParse({ folderId, teamMemberId });
  if (!p.success) return { ok: false as const, error: "invalidInput" };

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")) };
  if (sessionUserRole(session) !== "admin") return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")) };

  try {
    const subtree = await collectSubtreeFolderIds(p.data.folderId);
    await db
      .delete(folderAccessExclusions)
      .where(
        and(eq(folderAccessExclusions.teamMemberId, p.data.teamMemberId), inArray(folderAccessExclusions.folderId, subtree))
      );
    await db
      .delete(folderAccess)
      .where(and(eq(folderAccess.folderId, p.data.folderId), eq(folderAccess.teamMemberId, p.data.teamMemberId)));

    revalidatePath("/dashboard/drive");
    revalidatePath("/dashboard/member-drive");
    return { ok: true as const };
  } catch (e) {
    console.error("revokeFolderAccess", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export async function excludeSubfolder(folderId: string, teamMemberId: string) {
  const p = z.object({ folderId: uuid, teamMemberId: uuid }).safeParse({ folderId, teamMemberId });
  if (!p.success) return { ok: false as const, error: "invalidInput" };

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")) };
  if (sessionUserRole(session) !== "admin") return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")) };

  try {
    await db
      .insert(folderAccessExclusions)
      .values({ folderId: p.data.folderId, teamMemberId: p.data.teamMemberId })
      .onConflictDoNothing({ target: [folderAccessExclusions.folderId, folderAccessExclusions.teamMemberId] });
    revalidatePath("/dashboard/drive");
    revalidatePath("/dashboard/member-drive");
    return { ok: true as const };
  } catch (e) {
    console.error("excludeSubfolder", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export async function removeExclusion(folderId: string, teamMemberId: string) {
  const p = z.object({ folderId: uuid, teamMemberId: uuid }).safeParse({ folderId, teamMemberId });
  if (!p.success) return { ok: false as const, error: "invalidInput" };

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")) };
  if (sessionUserRole(session) !== "admin") return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")) };

  try {
    await db
      .delete(folderAccessExclusions)
      .where(
        and(eq(folderAccessExclusions.folderId, p.data.folderId), eq(folderAccessExclusions.teamMemberId, p.data.teamMemberId))
      );
    revalidatePath("/dashboard/drive");
    revalidatePath("/dashboard/member-drive");
    return { ok: true as const };
  } catch (e) {
    console.error("removeExclusion", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e) };
    return { ok: false as const, error: getDbErrorKey(e) };
  }
}

export async function getFolderAccessList(folderId: string) {
  const parsed = uuid.safeParse(folderId);
  if (!parsed.success) return { ok: false as const, error: getDbErrorKey(new Error("invalidInput")), data: [] as FolderAccessListEntry[] };

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")), data: [] as FolderAccessListEntry[] };
  const role = sessionUserRole(session);
  try {
    const [ctxFolder] = await db.select().from(folders).where(eq(folders.id, parsed.data)).limit(1);
    if (!ctxFolder) return { ok: false as const, error: getDbErrorKey(new Error("Folder not found")), data: [] as FolderAccessListEntry[] };
    if (role === "member") {
      if (!ctxFolder.projectId) return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")), data: [] as FolderAccessListEntry[] };
      const allowed = await memberHasAccessToProjectFolder(userId, ctxFolder.id);
      if (!allowed) return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")), data: [] as FolderAccessListEntry[] };
    }

    const subtree = await collectSubtreeFolderIds(parsed.data);
    const descendantIds = subtree.filter((id) => id !== parsed.data);

    const roster = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        avatarUrl: teamMembers.avatarUrl,
        status: teamMembers.status,
      })
      .from(teamMembers)
      .where(eq(teamMembers.status, "active"))
      .orderBy(asc(teamMembers.name));

    const edges = await db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
    const out: FolderAccessListEntry[] = [];

    for (const m of roster) {
      const content = await getAccessibleFolderIds(m.id);
      const visible = expandFolderIdsWithAncestors(content, edges);
      if (!visible.has(parsed.data)) continue;

      const [direct] = await db
        .select({ accessType: folderAccess.accessType })
        .from(folderAccess)
        .where(and(eq(folderAccess.folderId, parsed.data), eq(folderAccess.teamMemberId, m.id)))
        .limit(1);

      const exRows =
        descendantIds.length > 0
          ? await db
              .select({ folderId: folderAccessExclusions.folderId })
              .from(folderAccessExclusions)
              .where(
                and(eq(folderAccessExclusions.teamMemberId, m.id), inArray(folderAccessExclusions.folderId, descendantIds))
              )
          : [];

      out.push({
        teamMemberId: m.id,
        memberName: m.name,
        memberAvatar: m.avatarUrl ?? null,
        accessType: direct?.accessType ?? "view",
        isDirect: Boolean(direct),
        excludedSubfolderIds: exRows.map((r) => r.folderId),
      });
    }

    return { ok: true as const, data: out };
  } catch (e) {
    console.error("getFolderAccessList", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderAccessListEntry[] };
    }
    return { ok: false as const, error: getDbErrorKey(e), data: [] as FolderAccessListEntry[] };
  }
}

export async function listDirectChildFoldersForAccess(parentFolderId: string) {
  const parsed = uuid.safeParse(parentFolderId);
  if (!parsed.success) return { ok: false as const, error: getDbErrorKey(new Error("invalidInput")), data: [] as { id: string; name: string }[] };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")), data: [] as { id: string; name: string }[] };
  if (sessionUserRole(session) !== "admin") return { ok: false as const, error: getDbErrorKey(new Error("Forbidden")), data: [] as { id: string; name: string }[] };

  try {
    const rows = await db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(eq(folders.parentId, parsed.data))
      .orderBy(asc(folders.name));
    return { ok: true as const, data: rows };
  } catch (e) {
    console.error("listDirectChildFoldersForAccess", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e), data: [] as { id: string; name: string }[] };
    return { ok: false as const, error: getDbErrorKey(e), data: [] as { id: string; name: string }[] };
  }
}

export async function getFolderAccessDirectCountsByFolderId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: getDbErrorKey(new Error("Not authorized")), data: {} as Record<string, number> };
  if (sessionUserRole(session) !== "admin") return { ok: true as const, data: {} as Record<string, number> };

  try {
    const rows = await db
      .select({
        folderId: folderAccess.folderId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(folderAccess)
      .groupBy(folderAccess.folderId);
    const data: Record<string, number> = {};
    for (const r of rows) {
      data[r.folderId] = Number(r.cnt ?? 0);
    }
    return { ok: true as const, data };
  } catch (e) {
    console.error("getFolderAccessDirectCountsByFolderId", e);
    if (isDbConnectionError(e)) return { ok: false as const, error: getDbErrorKey(e), data: {} as Record<string, number> };
    return { ok: false as const, error: getDbErrorKey(e), data: {} as Record<string, number> };
  }
}

export { getAccessibleFolderIds, canAccessFolder } from "@/lib/member-drive-access";
