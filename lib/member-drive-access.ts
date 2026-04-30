import { sql } from "drizzle-orm";
import { db, folders } from "@/lib/db";
import { getTeamMemberIdsForSessionUser } from "@/lib/member-context";

type FolderEdge = { id: string; parentId: string | null };

/**
 * Folders where the member may list/download files (granted subtrees minus exclusion subtrees).
 * One recursive pass per team member id.
 */
export async function getAccessibleFolderIds(teamMemberId: string): Promise<Set<string>> {
  const res = (await db.execute(
    sql`
      WITH RECURSIVE granted AS (
        SELECT f.id, fa.team_member_id AS tm_id
        FROM folders f
        INNER JOIN folder_access fa ON fa.folder_id = f.id
        WHERE fa.team_member_id = ${teamMemberId}
        UNION ALL
        SELECT f.id, g.tm_id
        FROM folders f
        INNER JOIN granted g ON f.parent_id = g.id
      ),
      excluded AS (
        SELECT f.id, fae.team_member_id AS tm_id
        FROM folders f
        INNER JOIN folder_access_exclusions fae ON fae.folder_id = f.id
        WHERE fae.team_member_id = ${teamMemberId}
        UNION ALL
        SELECT f.id, e.tm_id
        FROM folders f
        INNER JOIN excluded e ON f.parent_id = e.id
      )
      SELECT DISTINCT g.id::text AS id
      FROM granted g
      WHERE NOT EXISTS (
        SELECT 1 FROM excluded x WHERE x.id = g.id AND x.tm_id = g.tm_id
      )
    `
  )) as unknown as { rows: { id: string }[] };
  const out = new Set<string>();
  const list = res.rows ?? [];
  for (const row of list) {
    if (row?.id) out.add(String(row.id));
  }
  return out;
}

export function expandFolderIdsWithAncestors(
  contentIds: Iterable<string>,
  folderEdges: FolderEdge[]
): Set<string> {
  const byId = new Map(folderEdges.map((f) => [f.id, f]));
  const visible = new Set<string>();
  for (const start of contentIds) {
    let cur: string | null = start;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      visible.add(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }
  }
  return visible;
}

async function loadAllFolderParentEdges(): Promise<FolderEdge[]> {
  return db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
}

/** Union of content folder ids for every team_members row linked to this user. */
export async function getMemberDriveContentFolderIdsForUser(userId: string): Promise<Set<string>> {
  const tmIds = await getTeamMemberIdsForSessionUser(userId);
  const out = new Set<string>();
  for (const tmId of tmIds) {
    const part = await getAccessibleFolderIds(tmId);
    for (const id of part) out.add(id);
  }
  return out;
}

/** Folders visible in the drive tree (content plus ancestor chain to root). */
export async function getMemberDriveVisibleFolderIdsForUser(userId: string): Promise<Set<string>> {
  const content = await getMemberDriveContentFolderIdsForUser(userId);
  if (content.size === 0) return new Set();
  const edges = await loadAllFolderParentEdges();
  return expandFolderIdsWithAncestors(content, edges);
}

/**
 * @deprecated Prefer getMemberDriveContentFolderIdsForUser or getAccessibleFolderIds
 */
export async function getMemberAccessibleProjectFolderIds(userId: string): Promise<Set<string>> {
  return getMemberDriveContentFolderIdsForUser(userId);
}

export async function memberHasAccessToProjectFolder(userId: string, folderId: string): Promise<boolean> {
  const content = await getMemberDriveContentFolderIdsForUser(userId);
  return content.has(folderId);
}

export async function canAccessFolder(teamMemberId: string, folderId: string): Promise<boolean> {
  const s = await getAccessibleFolderIds(teamMemberId);
  return s.has(folderId);
}
