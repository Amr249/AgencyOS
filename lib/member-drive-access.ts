import { inArray } from "drizzle-orm";
import { db, folderAccess, folders } from "@/lib/db";
import { getMemberProjectIdsForUser, getTeamMemberIdsForSessionUser } from "@/lib/member-context";

/**
 * Project drive folders a member may use: must have an ancestor (including self) with
 * `folder_access` rows that explicitly include one of the member's `team_members` ids.
 * Folders with no ACL on any ancestor are hidden (admin-only until shared).
 */
export async function getMemberAccessibleProjectFolderIds(userId: string): Promise<Set<string>> {
  const projectIds = await getMemberProjectIdsForUser(userId);
  const memberTeamIdsArr = await getTeamMemberIdsForSessionUser(userId);
  const memberTeamIds = new Set(memberTeamIdsArr);
  if (projectIds.length === 0 || memberTeamIds.size === 0) {
    return new Set();
  }

  const folderRows = await db
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(inArray(folders.projectId, projectIds));

  if (folderRows.length === 0) return new Set();

  const folderById = new Map(folderRows.map((r) => [r.id, r]));
  const folderIds = folderRows.map((r) => r.id);

  const aclRows = await db
    .select({ folderId: folderAccess.folderId, teamMemberId: folderAccess.teamMemberId })
    .from(folderAccess)
    .where(inArray(folderAccess.folderId, folderIds));

  const aclMap = new Map<string, string[]>();
  for (const a of aclRows) {
    const list = aclMap.get(a.folderId) ?? [];
    list.push(a.teamMemberId);
    aclMap.set(a.folderId, list);
  }

  function explicitGrantsMember(folderId: string): boolean {
    const list = aclMap.get(folderId);
    return Boolean(list && list.length > 0 && list.some((tid) => memberTeamIds.has(tid)));
  }

  function memberHasInheritedAccess(folderId: string): boolean {
    const visited = new Set<string>();
    let cur: string | null = folderId;
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      if (explicitGrantsMember(cur)) return true;
      const node = folderById.get(cur);
      cur = node?.parentId ?? null;
    }
    return false;
  }

  const out = new Set<string>();
  for (const f of folderRows) {
    if (memberHasInheritedAccess(f.id)) {
      out.add(f.id);
    }
  }
  return out;
}

export async function memberHasAccessToProjectFolder(userId: string, folderId: string): Promise<boolean> {
  const set = await getMemberAccessibleProjectFolderIds(userId);
  return set.has(folderId);
}
