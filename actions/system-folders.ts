"use server";

import type { SQL } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { db, clients, expenses, files, folders, invoices, projects, teamMembers } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { requireWriteAccess, trialExpiredPlain } from "@/lib/trial";
import { r2ObjectKeyFromPublicUrl } from "@/lib/r2-public-url";
import { createFile } from "@/actions/files";
import { agencySystemDrivePathPrefix } from "@/lib/agency-drive-prefix";
import { requireAgencyOrganization } from "@/lib/org-session";

function systemFolderSyncTag(organizationId: string): string {
  return `system-folders-${organizationId}`;
}

async function runSystemFolderSyncWithRetry(organizationId: string): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await runSystemFolderSync(organizationId);
      return;
    } catch (e) {
      last = e;
      if (attempt < 1 && isDbConnectionError(e)) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

function cachedDriveSystemFolderSync(organizationId: string) {
  return unstable_cache(
    async () => {
      await runSystemFolderSyncWithRetry(organizationId);
      return true;
    },
    ["drive-system-sync-v2", organizationId],
    { revalidate: 300, tags: [systemFolderSyncTag(organizationId)] }
  );
}

const ROOT_DEFS = [
  { name: "Clients", systemType: "root_clients" },
  { name: "Projects", systemType: "root_projects" },
  { name: "Invoices", systemType: "root_invoices" },
  { name: "Expenses", systemType: "root_expenses" },
  { name: "Team", systemType: "root_team" },
  { name: "General", systemType: "root_general" },
] as const;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  software: "Software",
  hosting: "Hosting",
  marketing: "Marketing",
  salaries: "Salaries",
  equipment: "Equipment",
  office: "Office",
  other: "Other",
};

function seg(name: string): string {
  return name.trim().replace(/\//g, "-").replace(/\s+/g, " ").slice(0, 200) || "untitled";
}

/** Keep materialized `path` correct under a parent after its path changes. */
async function syncChildFolderPathsRecursive(parentId: string, parentPath: string) {
  const kids = await db.select().from(folders).where(eq(folders.parentId, parentId));
  const base = parentPath.endsWith("/") ? parentPath.slice(0, -1) : parentPath;
  for (const k of kids) {
    const newPath = `${base}/${seg(k.name)}`;
    if (k.path !== newPath) {
      await db.update(folders).set({ path: newPath }).where(eq(folders.id, k.id));
    }
    await syncChildFolderPathsRecursive(k.id, newPath);
  }
}

async function findOne(where: SQL | undefined): Promise<(typeof folders.$inferSelect) | null> {
  if (!where) return null;
  const [row] = await db.select().from(folders).where(where).limit(1);
  return row ?? null;
}

async function insertSystemFolder(values: {
  name: string;
  parentId: string | null;
  path: string;
  systemType: string;
  clientId?: string | null;
  projectId?: string | null;
  teamMemberId?: string | null;
}) {
  const [row] = await db
    .insert(folders)
    .values({
      name: values.name,
      parentId: values.parentId,
      path: values.path,
      isSystem: true,
      systemType: values.systemType,
      clientId: values.clientId ?? null,
      projectId: values.projectId ?? null,
      teamMemberId: values.teamMemberId ?? null,
      createdBy: null,
    })
    .returning();
  return row ?? null;
}

async function ensureRoot(name: string, systemType: string, organizationId: string): Promise<string> {
  const prefix = agencySystemDrivePathPrefix(organizationId);
  const path = `${prefix}/${seg(name)}`;
  const existing = await findOne(
    and(isNull(folders.parentId), eq(folders.systemType, systemType), eq(folders.path, path))
  );
  if (existing) return existing.id;
  const row = await insertSystemFolder({
    name,
    parentId: null,
    path,
    systemType,
  });
  if (!row) throw new Error("Failed to create root system folder");
  return row.id;
}

async function removeOrphanedClientFolders(organizationId: string) {
  const archived = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(isNotNull(clients.deletedAt), eq(clients.organizationId, organizationId)));
  const ids = archived.map((r) => r.id);
  if (ids.length === 0) return;
  const sysPrefix = agencySystemDrivePathPrefix(organizationId);
  const rows = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.systemType, "client"),
        inArray(folders.clientId, ids),
        sql`${folders.path} like ${sysPrefix + "%"}`
      )
    );
  for (const r of rows) {
    await db.delete(folders).where(eq(folders.id, r.id));
  }
}

async function removeOrphanedProjectFolders(organizationId: string) {
  const gone = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(isNotNull(projects.deletedAt), eq(projects.organizationId, organizationId)));
  const ids = gone.map((r) => r.id);
  if (ids.length === 0) return;
  const sysPrefix = agencySystemDrivePathPrefix(organizationId);
  const rows = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.systemType, "project"),
        inArray(folders.projectId, ids),
        sql`${folders.path} like ${sysPrefix + "%"}`
      )
    );
  for (const r of rows) {
    await db.delete(folders).where(eq(folders.id, r.id));
  }
}

async function ensureChildFolder(opts: {
  parentId: string;
  parentPath: string;
  name: string;
  systemType: string;
  clientId?: string | null;
  projectId?: string | null;
  teamMemberId?: string | null;
}): Promise<string> {
  if (opts.systemType === "project" && opts.projectId != null) {
    const byProject = await findOne(
      and(
        eq(folders.parentId, opts.parentId),
        eq(folders.systemType, "project"),
        eq(folders.projectId, opts.projectId)
      )
    );
    if (byProject) {
      const base = opts.parentPath.endsWith("/") ? opts.parentPath.slice(0, -1) : opts.parentPath;
      const path = `${base}/${seg(opts.name)}`;
      const clientId = opts.clientId ?? null;
      if (byProject.name !== opts.name || byProject.path !== path || byProject.clientId !== clientId) {
        await db.update(folders).set({ name: opts.name, path, clientId }).where(eq(folders.id, byProject.id));
        await syncChildFolderPathsRecursive(byProject.id, path);
      }
      return byProject.id;
    }
  }

  const parts: SQL[] = [
    eq(folders.parentId, opts.parentId),
    eq(folders.systemType, opts.systemType),
    eq(folders.name, opts.name),
  ];
  if (opts.clientId != null) parts.push(eq(folders.clientId, opts.clientId));
  else parts.push(isNull(folders.clientId));
  if (opts.projectId != null) parts.push(eq(folders.projectId, opts.projectId));
  else parts.push(isNull(folders.projectId));
  if (opts.teamMemberId != null) parts.push(eq(folders.teamMemberId, opts.teamMemberId));
  else parts.push(isNull(folders.teamMemberId));

  const existing = await findOne(and(...parts));
  if (existing) {
    if (existing.name !== opts.name) {
      await db.update(folders).set({ name: opts.name }).where(eq(folders.id, existing.id));
    }
    return existing.id;
  }
  const base = opts.parentPath.endsWith("/") ? opts.parentPath.slice(0, -1) : opts.parentPath;
  const path = `${base}/${seg(opts.name)}`;
  const row = await insertSystemFolder({
    name: opts.name,
    parentId: opts.parentId,
    path,
    systemType: opts.systemType,
    clientId: opts.clientId ?? null,
    projectId: opts.projectId ?? null,
    teamMemberId: opts.teamMemberId ?? null,
  });
  if (!row) throw new Error("insert child system folder failed");
  return row.id;
}

/** Full idempotent sync — call from Drive page (admin). */
export async function ensureSystemFolders(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || sessionUserRole(session) === "member") {
    return { ok: false, error: "forbidden" };
  }
  const wa = await requireWriteAccess();
  if (!wa.ok) return trialExpiredPlain();
  const organizationId = wa.organizationId;
  try {
    await cachedDriveSystemFolderSync(organizationId)();
    return { ok: true };
  } catch (e) {
    if (isDbConnectionError(e)) {
      console.warn("ensureSystemFolders: transient database connection issue", getDbErrorKey(e));
    } else {
      console.error("ensureSystemFolders", e);
    }
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "unknown" };
  }
}

/** Trusted internal full sync (e.g. after entity create). */
export async function ensureSystemFoldersInternal(): Promise<void> {
  const ctx = await requireAgencyOrganization();
  await runSystemFolderSync(ctx.organizationId);
  revalidateTag(systemFolderSyncTag(ctx.organizationId), "max");
}

async function runSystemFolderSync(organizationId: string) {
  await removeOrphanedClientFolders(organizationId);
  await removeOrphanedProjectFolders(organizationId);

  const roots: Record<string, string> = {};
  for (const r of ROOT_DEFS) {
    roots[r.systemType] = await ensureRoot(r.name, r.systemType, organizationId);
  }

  const clientsRoot = roots.root_clients!;
  const projectsRoot = roots.root_projects!;
  const invoicesRoot = roots.root_invoices!;
  const expensesRoot = roots.root_expenses!;
  const teamRoot = roots.root_team!;

  const [clientsRootRow] = await db.select().from(folders).where(eq(folders.id, clientsRoot)).limit(1);
  const [projectsRootRow] = await db.select().from(folders).where(eq(folders.id, projectsRoot)).limit(1);
  const [invoicesRootRow] = await db.select().from(folders).where(eq(folders.id, invoicesRoot)).limit(1);
  const [expensesRootRow] = await db.select().from(folders).where(eq(folders.id, expensesRoot)).limit(1);
  const [teamRootRow] = await db.select().from(folders).where(eq(folders.id, teamRoot)).limit(1);
  if (!clientsRootRow || !projectsRootRow || !invoicesRootRow || !expensesRootRow || !teamRootRow) return;

  const activeClients = await db
    .select()
    .from(clients)
    .where(and(isNull(clients.deletedAt), eq(clients.organizationId, organizationId)))
    .orderBy(asc(clients.companyName));
  for (const c of activeClients) {
    const clientFolderId = await ensureChildFolder({
      parentId: clientsRoot,
      parentPath: clientsRootRow.path,
      name: c.companyName,
      systemType: "client",
      clientId: c.id,
    });
    const [cf] = await db.select().from(folders).where(eq(folders.id, clientFolderId)).limit(1);
    if (!cf) continue;
    await ensureChildFolder({
      parentId: clientFolderId,
      parentPath: cf.path,
      name: "Logo & Brand",
      systemType: "client_brand",
      clientId: c.id,
    });
    await ensureChildFolder({
      parentId: clientFolderId,
      parentPath: cf.path,
      name: "Contracts",
      systemType: "client_contracts",
      clientId: c.id,
    });
    await ensureChildFolder({
      parentId: clientFolderId,
      parentPath: cf.path,
      name: "General",
      systemType: "client_general",
      clientId: c.id,
    });
  }

  const activeProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        isNull(projects.deletedAt),
        eq(projects.organizationId, organizationId),
        eq(clients.organizationId, organizationId)
      )
    )
    .orderBy(asc(clients.companyName), asc(projects.name));

  for (const p of activeProjects) {
    const displayName = p.name.trim() || "Untitled";
    const projectFolderId = await ensureChildFolder({
      parentId: projectsRoot,
      parentPath: projectsRootRow.path,
      name: displayName,
      systemType: "project",
      projectId: p.id,
      clientId: p.clientId,
    });
    const [pf] = await db.select().from(folders).where(eq(folders.id, projectFolderId)).limit(1);
    if (!pf) continue;
    await ensureChildFolder({
      parentId: projectFolderId,
      parentPath: pf.path,
      name: "Designs",
      systemType: "project_designs",
      projectId: p.id,
      clientId: p.clientId,
    });
    await ensureChildFolder({
      parentId: projectFolderId,
      parentPath: pf.path,
      name: "Deliverables",
      systemType: "project_deliverables",
      projectId: p.id,
      clientId: p.clientId,
    });
    await ensureChildFolder({
      parentId: projectFolderId,
      parentPath: pf.path,
      name: "Documents",
      systemType: "project_documents",
      projectId: p.id,
      clientId: p.clientId,
    });
  }

  const invoiceClients = await db
    .selectDistinct({ clientId: invoices.clientId, companyName: clients.companyName })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        isNull(clients.deletedAt),
        eq(invoices.organizationId, organizationId),
        eq(clients.organizationId, organizationId)
      )
    );
  for (const ic of invoiceClients) {
    await ensureChildFolder({
      parentId: invoicesRoot,
      parentPath: invoicesRootRow.path,
      name: ic.companyName,
      systemType: "invoice_client",
      clientId: ic.clientId,
    });
  }

  const categoryFolderIds: Record<string, string> = {};
  for (const cat of Object.keys(EXPENSE_CATEGORY_LABELS)) {
    const label = EXPENSE_CATEGORY_LABELS[cat]!;
    const id = await ensureChildFolder({
      parentId: expensesRoot,
      parentPath: expensesRootRow.path,
      name: label,
      systemType: "expense_category",
    });
    categoryFolderIds[cat] = id;
  }

  const salariesParentId = categoryFolderIds.salaries;
  const [salariesRow] = await db.select().from(folders).where(eq(folders.id, salariesParentId)).limit(1);
  if (salariesRow) {
    const salaryMembers = await db
      .selectDistinct({ id: teamMembers.id, name: teamMembers.name })
      .from(expenses)
      .innerJoin(teamMembers, eq(expenses.teamMemberId, teamMembers.id))
      .where(
        and(
          eq(expenses.category, "salaries"),
          eq(teamMembers.status, "active"),
          eq(expenses.organizationId, organizationId),
          eq(teamMembers.organizationId, organizationId)
        )
      );
    for (const m of salaryMembers) {
      await ensureChildFolder({
        parentId: salariesParentId,
        parentPath: salariesRow.path,
        name: m.name,
        systemType: "expense_team_member",
        teamMemberId: m.id,
      });
    }
  }

  for (const cat of Object.keys(EXPENSE_CATEGORY_LABELS)) {
    if (cat === "salaries") continue;
    const catFolderId = categoryFolderIds[cat];
    const [catRow] = await db.select().from(folders).where(eq(folders.id, catFolderId)).limit(1);
    if (!catRow) continue;
    const titles = await db
      .selectDistinct({ title: expenses.title })
      .from(expenses)
      .where(
        and(
          eq(expenses.category, cat as (typeof expenses.$inferSelect)["category"]),
          eq(expenses.organizationId, organizationId)
        )
      );
    for (const t of titles) {
      const title = t.title?.trim();
      if (!title) continue;
      await ensureChildFolder({
        parentId: catFolderId,
        parentPath: catRow.path,
        name: title,
        systemType: "expense_title",
      });
    }
  }

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.status, "active"), eq(teamMembers.organizationId, organizationId)))
    .orderBy(asc(teamMembers.name));
  for (const m of members) {
    await ensureChildFolder({
      parentId: teamRoot,
      parentPath: teamRootRow.path,
      name: m.name,
      systemType: "team_member",
      teamMemberId: m.id,
    });
  }
}

export async function ensureClientFolderTreesForClient(_clientId: string): Promise<void> {
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
}

export async function ensureProjectFolderTreesForProject(_projectId: string): Promise<void> {
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
}

export async function ensureTeamMemberFolderForMember(_teamMemberId: string): Promise<void> {
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
}

export async function getSystemFolderForEntity(
  entityType: "client" | "project" | "team_member",
  entityId: string
): Promise<string | null> {
  const { organizationId } = await requireAgencyOrganization();
  const sysPrefix = agencySystemDrivePathPrefix(organizationId);
  const underOrgTree = sql`${folders.path} like ${sysPrefix + "%"}`;
  if (entityType === "client") {
    const row = await findOne(
      and(eq(folders.systemType, "client"), eq(folders.clientId, entityId), underOrgTree)
    );
    return row?.id ?? null;
  }
  if (entityType === "project") {
    const row = await findOne(
      and(eq(folders.systemType, "project"), eq(folders.projectId, entityId), underOrgTree)
    );
    return row?.id ?? null;
  }
  const row = await findOne(
    and(eq(folders.systemType, "team_member"), eq(folders.teamMemberId, entityId), underOrgTree)
  );
  return row?.id ?? null;
}

export async function getClientBrandFolderId(clientId: string): Promise<string | null> {
  const { organizationId } = await requireAgencyOrganization();
  const sysPrefix = agencySystemDrivePathPrefix(organizationId);
  const row = await findOne(
    and(
      eq(folders.systemType, "client_brand"),
      eq(folders.clientId, clientId),
      sql`${folders.path} like ${sysPrefix + "%"}`
    )
  );
  return row?.id ?? null;
}

export async function getExpenseSystemFolderId(
  category: string,
  opts?: { teamMemberId?: string | null; title?: string | null }
): Promise<string | null> {
  const { organizationId } = await requireAgencyOrganization();
  const expenseRootPath = `${agencySystemDrivePathPrefix(organizationId)}/${seg("Expenses")}`;
  const root = await findOne(
    and(eq(folders.systemType, "root_expenses"), eq(folders.path, expenseRootPath))
  );
  if (!root) return null;
  const catKey = category in EXPENSE_CATEGORY_LABELS ? category : "other";
  const label = EXPENSE_CATEGORY_LABELS[catKey]!;
  const catFolder = await findOne(
    and(eq(folders.parentId, root.id), eq(folders.systemType, "expense_category"), eq(folders.name, label))
  );
  if (!catFolder) return null;
  if (catKey === "salaries" && opts?.teamMemberId) {
    const row = await findOne(
      and(
        eq(folders.parentId, catFolder.id),
        eq(folders.systemType, "expense_team_member"),
        eq(folders.teamMemberId, opts.teamMemberId)
      )
    );
    return row?.id ?? null;
  }
  const title = opts?.title?.trim();
  if (title && catKey !== "salaries") {
    const row = await findOne(
      and(eq(folders.parentId, catFolder.id), eq(folders.systemType, "expense_title"), eq(folders.name, title))
    );
    return row?.id ?? catFolder.id;
  }
  return catFolder.id;
}

async function hasFileWithR2Key(folderId: string, r2Key: string): Promise<boolean> {
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.r2Key, r2Key), isNull(files.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function recordClientLogoInBrandFolder(
  clientId: string,
  logoUrl: string | null | undefined,
  fileName = "logo"
): Promise<void> {
  const key = r2ObjectKeyFromPublicUrl(logoUrl ?? "");
  if (!key) return;
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
  const folderId = await getClientBrandFolderId(clientId);
  if (!folderId) return;
  if (await hasFileWithR2Key(folderId, key)) return;
  await createFile({
    name: fileName,
    r2Key: key,
    mimeType: null,
    sizeBytes: null,
    clientId,
    folderId,
  });
  revalidatePath("/dashboard/drive");
}

export async function recordProjectCoverInProjectFolder(
  projectId: string,
  coverUrl: string | null | undefined,
  fileName = "cover"
): Promise<void> {
  const key = r2ObjectKeyFromPublicUrl(coverUrl ?? "");
  if (!key) return;
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
  const folderId = await getSystemFolderForEntity("project", projectId);
  if (!folderId) return;
  const [p] = await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return;
  if (await hasFileWithR2Key(folderId, key)) return;
  await createFile({
    name: fileName,
    r2Key: key,
    mimeType: null,
    sizeBytes: null,
    clientId: p.clientId,
    projectId,
    folderId,
  });
  revalidatePath("/dashboard/drive");
}

export async function recordTeamAvatarInMemberFolder(
  teamMemberId: string,
  avatarUrl: string | null | undefined,
  fileName = "avatar"
): Promise<void> {
  const key = r2ObjectKeyFromPublicUrl(avatarUrl ?? "");
  if (!key) return;
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
  const folderId = await getSystemFolderForEntity("team_member", teamMemberId);
  if (!folderId) return;
  if (await hasFileWithR2Key(folderId, key)) return;
  await createFile({
    name: fileName,
    r2Key: key,
    mimeType: null,
    sizeBytes: null,
    folderId,
  });
  revalidatePath("/dashboard/drive");
}

export async function recordExpenseReceiptInCategoryFolder(
  expenseId: string,
  category: string,
  receiptUrl: string | null | undefined,
  teamMemberId: string | null | undefined,
  title: string | null | undefined,
  fileName = "receipt"
): Promise<void> {
  const key = r2ObjectKeyFromPublicUrl(receiptUrl ?? "");
  if (!key) return;
  const wa = await requireWriteAccess();
  if (!wa.ok) return;
  await ensureSystemFoldersInternal();
  const folderId = await getExpenseSystemFolderId(category, {
    teamMemberId: category === "salaries" ? teamMemberId ?? null : null,
    title: category !== "salaries" ? title : null,
  });
  if (!folderId) return;
  if (await hasFileWithR2Key(folderId, key)) return;
  const [ex] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!ex) return;
  await createFile({
    name: fileName,
    r2Key: key,
    mimeType: null,
    sizeBytes: null,
    expenseId,
    clientId: ex.clientId,
    projectId: ex.projectId,
    folderId,
  });
  revalidatePath("/dashboard/drive");
}
