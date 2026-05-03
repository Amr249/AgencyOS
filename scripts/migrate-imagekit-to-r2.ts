/**
 * One-off migration: download files from ImageKit URLs and upload to Cloudflare R2,
 * then update the database.
 *
 * Run locally (never in production CI):
 *   npx tsx scripts/migrate-imagekit-to-r2.ts
 *   npx tsx scripts/migrate-imagekit-to-r2.ts --dry-run
 *
 * Env: DATABASE_URL, CLOUDFLARE_R2_* (same as app — see .env.example)
 *
 * Default DB update (files table): sets `r2_key` only.
 *
 * Optional `--sync-url-fields`: writes the same audit JSON as before; DB URL columns were
 * removed in migration 0028, so only `r2_key` is updated on `files` (no `imagekit_url` / `file_path`).
 *
 * Entity URLs (client logo, agency logo, avatars, project covers, expense receipts) are
 * always updated to the new public R2 URL when migrated (column holds the public URL).
 *
 * Does NOT delete objects on ImageKit.
 */
import { writeFile } from "fs/promises";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DRY_RUN = process.argv.includes("--dry-run");
const SYNC_URL_FIELDS = process.argv.includes("--sync-url-fields");

const LEGACY_AUDIT = `${process.cwd()}/migration-imagekit-legacy-urls.json`;
const ERRORS_LOG = `${process.cwd()}/migration-errors.json`;

type LegacyEntry = {
  kind: string;
  id: string;
  oldUrl: string;
  newUrl?: string;
  r2Key?: string;
};

type ErrorEntry = {
  phase: string;
  kind: string;
  id: string;
  url?: string;
  message: string;
};

function isImageKitUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /imagekit\.io/i.test(url);
}

function extFromUrlOrName(url: string, fallbackName: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    const last = path.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot >= 0 && dot < last.length - 1) {
      const ext = last.slice(dot).replace(/[^a-zA-Z0-9.]/g, "");
      if (ext.length > 0 && ext.length <= 16) return ext;
    }
  } catch {
    /* ignore */
  }
  const base = fallbackName.replace(/^.*[/\\]/, "");
  const i = base.lastIndexOf(".");
  if (i >= 0) {
    const ext = base.slice(i).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
    return ext || ".bin";
  }
  return ".bin";
}

async function downloadBinary(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const raw = res.headers.get("content-type");
  const first = raw?.split(";")[0]?.trim();
  const contentType =
    first && first.length > 0 ? first : "application/octet-stream";
  return { buffer, contentType };
}

function buildFileR2Key(
  row: {
    id: string;
    name: string;
    clientId: string | null;
    projectId: string | null;
    taskId: string | null;
    expenseId: string | null;
    invoiceId: string | null;
  },
  sanitizeFilename: (filename: string) => string
): string {
  const safe = sanitizeFilename(row.name);
  if (row.taskId) {
    return `tasks/${row.taskId}/files/${row.id}_${safe}`;
  }
  if (row.projectId) {
    return `projects/${row.projectId}/files/${row.id}_${safe}`;
  }
  if (row.clientId) {
    return `clients/${row.clientId}/files/${row.id}_${safe}`;
  }
  if (row.expenseId) {
    return `expenses/attachments/${row.expenseId}/${row.id}_${safe}`;
  }
  if (row.invoiceId) {
    return `invoices/${row.invoiceId}/migrated_${row.id}_${safe}`;
  }
  return `migrated/files/${row.id}_${safe}`;
}

type UrlMigrateSpec = {
  kind: string;
  table: "clients" | "settings" | "team_members" | "projects" | "expenses";
  id: string;
  url: string;
  r2Key: string;
};

async function main() {
  const { isR2Configured, uploadToR2, sanitizeFilename } = await import("@/lib/r2");
  const { db } = await import("@/lib/db");
  const { clients, settings, teamMembers, projects, expenses } = await import("@/lib/db/schema");
  const { getDefaultOrganizationId } = await import("@/lib/db/default-organization");
  const { eq, isNull, isNotNull, and, sql } = await import("drizzle-orm");

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  if (!DRY_RUN && !isR2Configured()) {
    console.error(
      "R2 is not configured. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL."
    );
    process.exit(1);
  }

  const legacyBuffer: LegacyEntry[] = [];
  const errorsBuffer: ErrorEntry[] = [];

  console.log(
    DRY_RUN
      ? "DRY RUN — no uploads or DB writes."
      : SYNC_URL_FIELDS
        ? "LIVE — files: r2_key + audit JSON (legacy URL columns dropped in 0028)"
        : "LIVE — files: r2_key only (add --sync-url-fields for full audit JSON)."
  );

  let migrated = 0;
  let failed = 0;

  /** Reads legacy `imagekit_url` via raw SQL (column absent from Drizzle schema after 0028). */
  const fileQuery = await db.execute(sql`
    SELECT
      id,
      name,
      imagekit_url AS "legacyImageUrl",
      mime_type AS "mimeType",
      client_id AS "clientId",
      project_id AS "projectId",
      task_id AS "taskId",
      expense_id AS "expenseId",
      invoice_id AS "invoiceId",
      r2_key AS "r2Key"
    FROM files
    WHERE deleted_at IS NULL AND imagekit_url IS NOT NULL
  `);
  const fileRows = (fileQuery.rows as Record<string, unknown>[]).map((raw) => ({
    id: String(raw.id),
    name: String(raw.name),
    legacyImageUrl: String(raw.legacyImageUrl),
    mimeType: raw.mimeType != null ? String(raw.mimeType) : null,
    clientId: raw.clientId != null ? String(raw.clientId) : null,
    projectId: raw.projectId != null ? String(raw.projectId) : null,
    taskId: raw.taskId != null ? String(raw.taskId) : null,
    expenseId: raw.expenseId != null ? String(raw.expenseId) : null,
    invoiceId: raw.invoiceId != null ? String(raw.invoiceId) : null,
    r2Key: raw.r2Key != null ? String(raw.r2Key) : null,
  }));

  const ikFiles = fileRows.filter((r) => isImageKitUrl(r.legacyImageUrl));
  const total = ikFiles.length;

  for (let i = 0; i < ikFiles.length; i++) {
    const row = ikFiles[i]!;
    const key = buildFileR2Key(row, sanitizeFilename);
    const label = `[${i + 1}/${total}]`;
    console.log(`${label} Migrating: ${row.name} → ${key}`);

    if (DRY_RUN) {
      migrated++;
      continue;
    }

    let buffer: Buffer;
    let contentType: string;
    try {
      const d = await downloadBinary(row.legacyImageUrl);
      buffer = d.buffer;
      contentType = row.mimeType?.trim() || d.contentType;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ download failed: ${message}`);
      failed++;
      errorsBuffer.push({
        phase: "download",
        kind: "file",
        id: row.id,
        url: row.legacyImageUrl,
        message,
      });
      continue;
    }

    let publicUrl: string;
    try {
      const r = await uploadToR2(buffer, key, contentType);
      publicUrl = r.url;
    } catch (e1: unknown) {
      void e1;
      try {
        const r = await uploadToR2(buffer, key, contentType);
        publicUrl = r.url;
      } catch (e2) {
        const message = e2 instanceof Error ? e2.message : String(e2);
        console.error(`  ✗ R2 upload failed (after retry): ${message}`);
        failed++;
        errorsBuffer.push({
          phase: "upload",
          kind: "file",
          id: row.id,
          url: row.legacyImageUrl,
          message,
        });
        continue;
      }
    }

    try {
      if (SYNC_URL_FIELDS) {
        legacyBuffer.push({
          kind: "file",
          id: row.id,
          oldUrl: row.legacyImageUrl,
          newUrl: publicUrl,
          r2Key: key,
        });
        await db.execute(sql`UPDATE files SET r2_key = ${key} WHERE id = ${row.id}::uuid`);
      } else {
        await db.execute(sql`UPDATE files SET r2_key = ${key} WHERE id = ${row.id}::uuid`);
      }
      migrated++;
      console.log(`  ✓ OK`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ DB update failed: ${message}`);
      failed++;
      errorsBuffer.push({
        phase: "db",
        kind: "file",
        id: row.id,
        message,
      });
    }
  }

  const extras: UrlMigrateSpec[] = [];

  const clientLogos = await db
    .select({ id: clients.id, logoUrl: clients.logoUrl })
    .from(clients)
    .where(and(isNull(clients.deletedAt), isNotNull(clients.logoUrl)));
  for (const c of clientLogos) {
    if (!isImageKitUrl(c.logoUrl)) continue;
    const ext = extFromUrlOrName(c.logoUrl!, "logo.png");
    extras.push({
      kind: "client_logo",
      table: "clients",
      id: c.id,
      url: c.logoUrl!,
      r2Key: `clients/${c.id}/logo${ext}`,
    });
  }

  const settingsOrgId = await getDefaultOrganizationId();
  const [settingsRow] = settingsOrgId
    ? await db
        .select({ id: settings.id, agencyLogoUrl: settings.agencyLogoUrl })
        .from(settings)
        .where(eq(settings.organizationId, settingsOrgId))
        .limit(1)
    : [];
  if (settingsRow?.agencyLogoUrl && isImageKitUrl(settingsRow.agencyLogoUrl)) {
    const ext = extFromUrlOrName(settingsRow.agencyLogoUrl, "logo.png");
    extras.push({
      kind: "agency_logo",
      table: "settings",
      id: settingsRow.id,
      url: settingsRow.agencyLogoUrl,
      r2Key: `agency/logo${ext}`,
    });
  }

  const avatars = await db
    .select({ id: teamMembers.id, avatarUrl: teamMembers.avatarUrl })
    .from(teamMembers)
    .where(isNotNull(teamMembers.avatarUrl));
  for (const t of avatars) {
    if (!isImageKitUrl(t.avatarUrl)) continue;
    const ext = extFromUrlOrName(t.avatarUrl!, "avatar.png");
    extras.push({
      kind: "team_avatar",
      table: "team_members",
      id: t.id,
      url: t.avatarUrl!,
      r2Key: `team/${t.id}/avatar${ext}`,
    });
  }

  const covers = await db
    .select({ id: projects.id, coverImageUrl: projects.coverImageUrl })
    .from(projects)
    .where(and(isNull(projects.deletedAt), isNotNull(projects.coverImageUrl)));
  for (const p of covers) {
    if (!isImageKitUrl(p.coverImageUrl)) continue;
    const ext = extFromUrlOrName(p.coverImageUrl!, "cover.png");
    extras.push({
      kind: "project_cover",
      table: "projects",
      id: p.id,
      url: p.coverImageUrl!,
      r2Key: `projects/${p.id}/cover${ext}`,
    });
  }

  const receipts = await db
    .select({ id: expenses.id, receiptUrl: expenses.receiptUrl })
    .from(expenses)
    .where(isNotNull(expenses.receiptUrl));
  for (const ex of receipts) {
    if (!isImageKitUrl(ex.receiptUrl)) continue;
    const ext = extFromUrlOrName(ex.receiptUrl!, "receipt.bin");
    extras.push({
      kind: "expense_receipt",
      table: "expenses",
      id: ex.id,
      url: ex.receiptUrl!,
      r2Key: `expenses/receipts/${ex.id}${ext}`,
    });
  }

  const exTotal = extras.length;
  for (let i = 0; i < extras.length; i++) {
    const ex = extras[i]!;
    console.log(`[entity ${i + 1}/${exTotal}] ${ex.kind}: ${ex.id} → ${ex.r2Key}`);
    if (DRY_RUN) {
      migrated++;
      continue;
    }

    let buffer: Buffer;
    let contentType: string;
    try {
      const d = await downloadBinary(ex.url);
      buffer = d.buffer;
      contentType = d.contentType;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ download failed: ${message}`);
      failed++;
      errorsBuffer.push({
        phase: "download",
        kind: ex.kind,
        id: ex.id,
        url: ex.url,
        message,
      });
      continue;
    }

    let publicUrl: string;
    try {
      const r = await uploadToR2(buffer, ex.r2Key, contentType);
      publicUrl = r.url;
    } catch (e1: unknown) {
      void e1;
      try {
        const r = await uploadToR2(buffer, ex.r2Key, contentType);
        publicUrl = r.url;
      } catch (e2) {
        const message = e2 instanceof Error ? e2.message : String(e2);
        console.error(`  ✗ R2 upload failed (after retry): ${message}`);
        failed++;
        errorsBuffer.push({
          phase: "upload",
          kind: ex.kind,
          id: ex.id,
          url: ex.url,
          message,
        });
        continue;
      }
    }

    try {
      if (ex.table === "clients") {
        await db.update(clients).set({ logoUrl: publicUrl }).where(eq(clients.id, ex.id));
      } else if (ex.table === "settings") {
        await db.update(settings).set({ agencyLogoUrl: publicUrl }).where(eq(settings.id, ex.id));
      } else if (ex.table === "team_members") {
        await db.update(teamMembers).set({ avatarUrl: publicUrl }).where(eq(teamMembers.id, ex.id));
      } else if (ex.table === "projects") {
        await db
          .update(projects)
          .set({ coverImageUrl: publicUrl })
          .where(eq(projects.id, ex.id));
      } else if (ex.table === "expenses") {
        await db.update(expenses).set({ receiptUrl: publicUrl }).where(eq(expenses.id, ex.id));
      }

      legacyBuffer.push({
        kind: ex.kind,
        id: ex.id,
        oldUrl: ex.url,
        newUrl: publicUrl,
        r2Key: ex.r2Key,
      });
      migrated++;
      console.log(`  ✓ OK`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failed++;
      errorsBuffer.push({ phase: "db", kind: ex.kind, id: ex.id, message });
    }
  }

  if (!DRY_RUN) {
    if (errorsBuffer.length > 0) {
      await writeFile(ERRORS_LOG, JSON.stringify(errorsBuffer, null, 2), "utf8");
    }
    if (legacyBuffer.length > 0) {
      await writeFile(LEGACY_AUDIT, JSON.stringify(legacyBuffer, null, 2), "utf8");
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Succeeded: ${migrated}`);
  console.log(`Failures:  ${failed}`);
  if (errorsBuffer.length > 0) {
    console.log(`Errors written to ${ERRORS_LOG}`);
  }
  if (!DRY_RUN && legacyBuffer.length > 0) {
    console.log(`Legacy / audit map: ${LEGACY_AUDIT}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
