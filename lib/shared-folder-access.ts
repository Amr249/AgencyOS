import { and, asc, eq, isNull } from "drizzle-orm";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { db, files, folders } from "@/lib/db";
import { publicUrlFromR2Key } from "@/lib/r2-public-url";

export type SharedFolderRootResult =
  | { ok: true; root: typeof folders.$inferSelect }
  | { ok: false; reason: "invalid" | "not_found" | "forbidden" | "expired" };

function normalizeShareToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (!trimmed) return "";
  try {
    // Protect against double-encoded links copied from chats/email clients.
    const decoded = decodeURIComponent(trimmed);
    return decoded.trim();
  } catch {
    return trimmed;
  }
}

/** URL / sans-serif confusions (e.g. capital I vs lowercase L) — verified via DB: tokens differ by one char. */
const CONFUSABLE: Record<string, string[]> = {
  I: ["I", "l", "1"],
  l: ["l", "I", "1"],
  "1": ["1", "I", "l"],
  O: ["O", "0"],
  o: ["o", "0"],
  "0": ["0", "O", "o"],
};

function shareTokenLookupCandidates(normalized: string): string[] {
  const positions: { index: number; chars: string[] }[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]!;
    const alt = CONFUSABLE[c];
    if (alt) positions.push({ index: i, chars: [...new Set(alt)] });
  }
  if (positions.length === 0) return [normalized];

  const out = new Set<string>();
  const MAX = 400;
  const dfs = (pi: number, buf: string[]) => {
    if (out.size >= MAX) return;
    if (pi === positions.length) {
      out.add(buf.join(""));
      return;
    }
    const { index, chars } = positions[pi]!;
    for (const ch of chars) {
      if (out.size >= MAX) return;
      const next = [...buf];
      next[index] = ch;
      dfs(pi + 1, next);
    }
  };
  dfs(0, [...normalized]);
  const list = [...out];
  list.sort((a, b) => {
    if (a === normalized) return -1;
    if (b === normalized) return 1;
    return 0;
  });
  return list;
}

export async function resolveSharedFolderRoot(token: string): Promise<SharedFolderRootResult> {
  noStore();
  const t = normalizeShareToken(token);
  if (!t || t.length < 8) return { ok: false, reason: "invalid" };
  try {
    for (const candidate of shareTokenLookupCandidates(t)) {
      const [root] = await db.select().from(folders).where(eq(folders.shareToken, candidate)).limit(1);
      if (!root) continue;
      if (!root.isPublic) {
        return { ok: false, reason: "forbidden" };
      }
      if (root.shareExpiresAt && new Date(root.shareExpiresAt).getTime() <= Date.now()) {
        return { ok: false, reason: "expired" };
      }
      return { ok: true, root };
    }
    return { ok: false, reason: "not_found" };
  } catch (e) {
    console.error("resolveSharedFolderRoot:failed", { token: t, error: e });
    return { ok: false, reason: "not_found" };
  }
}

export function isFolderPathUnderSharedRoot(rootPath: string, candidatePath: string): boolean {
  const r = rootPath.replace(/\/+$/, "");
  const c = candidatePath.replace(/\/+$/, "");
  return c === r || c.startsWith(`${r}/`);
}

export type SharedFolderBrowseData = {
  root: { id: string; name: string; shareExpiresAt: Date | null };
  current: { id: string; name: string };
  breadcrumbs: { id: string; name: string }[];
  childFolders: { id: string; name: string }[];
  files: {
    id: string;
    name: string;
    imagekitUrl: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
  }[];
};

async function loadSharedFolderBrowseTree(
  root: typeof folders.$inferSelect,
  rootPath: string,
  targetId: string
): Promise<
  | { ok: true; data: SharedFolderBrowseData }
  | { ok: false; reason: "not_found" | "forbidden" | "failed" }
> {
  try {
    const [current] = await db.select().from(folders).where(eq(folders.id, targetId)).limit(1);
    if (!current) return { ok: false, reason: "not_found" };
    if (!isFolderPathUnderSharedRoot(rootPath, current.path.replace(/\/+$/, ""))) {
      return { ok: false, reason: "forbidden" };
    }

    const up: { id: string; name: string }[] = [];
    let cur: typeof current | undefined = current;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      up.push({ id: cur.id, name: cur.name });
      if (cur.id === root.id) break;
      if (!cur.parentId) return { ok: false, reason: "forbidden" };
      const [p] = await db.select().from(folders).where(eq(folders.id, cur.parentId)).limit(1);
      cur = p;
      if (!cur) return { ok: false, reason: "forbidden" };
    }
    if (up.length === 0 || up[up.length - 1]?.id !== root.id) {
      return { ok: false, reason: "forbidden" };
    }
    const breadcrumbs = up.reverse();

    const childFolders = await db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(eq(folders.parentId, current.id))
      .orderBy(asc(folders.name));

    const fileRows = await db
      .select({
        id: files.id,
        name: files.name,
        r2Key: files.r2Key,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(eq(files.folderId, current.id), isNull(files.deletedAt)))
      .orderBy(asc(files.name));

    const filesForGuest = fileRows.map((r) => ({
      id: r.id,
      name: r.name,
      /** Legacy field name: public R2 URL for guests (ImageKit columns were dropped in migration 0028). */
      imagekitUrl: publicUrlFromR2Key(r.r2Key),
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt,
    }));

    return {
      ok: true,
      data: {
        root: { id: root.id, name: root.name, shareExpiresAt: root.shareExpiresAt },
        current: { id: current.id, name: current.name },
        breadcrumbs,
        childFolders,
        files: filesForGuest,
      },
    };
  } catch (e) {
    console.error("getSharedFolderBrowse", e);
    return { ok: false, reason: "failed" };
  }
}

export async function getSharedFolderBrowse(
  token: string,
  browseFolderId: string | null
): Promise<
  | { ok: true; data: SharedFolderBrowseData }
  | { ok: false; reason: "invalid" | "not_found" | "forbidden" | "expired" | "failed" }
> {
  const rootRes = await resolveSharedFolderRoot(token);
  if (!rootRes.ok) return rootRes;

  const root = rootRes.root;
  const rootPath = root.path.replace(/\/+$/, "");

  let targetId = browseFolderId?.trim() || root.id;
  const parsed = z.string().uuid().safeParse(targetId);
  if (!parsed.success) targetId = root.id;

  const hadFolderParam = Boolean(browseFolderId?.trim());
  let result = await loadSharedFolderBrowseTree(root, rootPath, targetId);
  if (!result.ok && result.reason === "forbidden" && hadFolderParam && targetId !== root.id) {
    result = await loadSharedFolderBrowseTree(root, rootPath, root.id);
  }
  return result;
}

export async function assertFileReadableViaSharedFolder(token: string, fileId: string): Promise<
  | {
      ok: true;
      file: { id: string; name: string; imagekitUrl: string; mimeType: string | null };
    }
  | { ok: false; status: 400 | 403 | 404 }
> {
  const idParsed = z.string().uuid().safeParse(fileId);
  if (!idParsed.success) return { ok: false, status: 400 };

  const rootRes = await resolveSharedFolderRoot(token);
  if (!rootRes.ok) return { ok: false, status: 404 };

  const [file] = await db
    .select({
      id: files.id,
      name: files.name,
      r2Key: files.r2Key,
      mimeType: files.mimeType,
      folderId: files.folderId,
    })
    .from(files)
    .where(and(eq(files.id, idParsed.data), isNull(files.deletedAt)))
    .limit(1);

  if (!file?.folderId) return { ok: false, status: 404 };

  const publicUrl = publicUrlFromR2Key(file.r2Key);
  if (!publicUrl) return { ok: false, status: 404 };

  const [folderRow] = await db
    .select({ path: folders.path })
    .from(folders)
    .where(eq(folders.id, file.folderId))
    .limit(1);
  if (!folderRow) return { ok: false, status: 404 };

  if (!isFolderPathUnderSharedRoot(rootRes.root.path, folderRow.path.replace(/\/+$/, ""))) {
    return { ok: false, status: 403 };
  }

  return {
    ok: true,
    file: {
      id: file.id,
      name: file.name,
      imagekitUrl: publicUrl,
      mimeType: file.mimeType,
    },
  };
}
