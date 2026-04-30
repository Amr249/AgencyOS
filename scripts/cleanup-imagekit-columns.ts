/**
 * Phase 2 (after ImageKit → R2 migration is verified):
 *
 * 1. Writes a Drizzle SQL migration that drops legacy file columns and sets `r2_key` NOT NULL.
 * 2. Appends an entry to `drizzle/meta/_journal.json` so `pnpm db:migrate` applies it.
 * 3. Prints the exact edits needed in `lib/db/schema.ts` for the `files` table (Drizzle schema
 *    must match the DB before you run `db:generate` again).
 *
 * Run:
 *   npx tsx scripts/cleanup-imagekit-columns.ts
 *
 * Preconditions:
 *   - Every row in `files` has a non-null `r2_key` (run migrate-imagekit-to-r2 first).
 *   - Application code no longer reads `imagekit_file_id`, `imagekit_url`, or `file_path`.
 */
import { readFile, writeFile, access } from "fs/promises";
import { resolve } from "path";

const MIGRATION_TAG = "0028_drop_imagekit_file_legacy_columns";
const SQL_REL = `drizzle/${MIGRATION_TAG}.sql`;
const JOURNAL = resolve(process.cwd(), "drizzle/meta/_journal.json");

const SQL = `-- Drop legacy ImageKit columns from files; require R2 key.
-- Run only after all file rows have r2_key set (see scripts/migrate-imagekit-to-r2.ts).

ALTER TABLE "files" DROP COLUMN IF EXISTS "imagekit_file_id";
ALTER TABLE "files" DROP COLUMN IF EXISTS "imagekit_url";
ALTER TABLE "files" DROP COLUMN IF EXISTS "file_path";

ALTER TABLE "files" ALTER COLUMN "r2_key" SET NOT NULL;
`;

const SCHEMA_HINT = `
=== Update lib/db/schema.ts — table "files" ===

Remove these columns from the files table definition:
  imagekitFileId
  imagekitUrl
  filePath

Change:
  r2Key: text("r2_key"),

To:
  r2Key: text("r2_key").notNull(),

Then run: pnpm db:generate   (should report no schema drift if DB already matches)
or rely on this SQL migration only.

=== Update application code ===

- Remove any zod/schemas still requiring imagekitFileId, imagekitUrl, filePath.
- Use r2Key + CLOUDFLARE_R2_PUBLIC_URL (see getPublicUrl in lib/r2.ts) or store full public URL
  in a renamed column in a follow-up migration.
`;

async function main() {
  const sqlPath = resolve(process.cwd(), SQL_REL);
  try {
    await access(sqlPath);
    throw new Error(
      `${SQL_REL} already exists. Delete it and remove its journal entry if you need to regenerate.`
    );
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : "";
    if (code !== "ENOENT") throw err;
  }

  await writeFile(sqlPath, SQL, "utf8");
  console.log(`Wrote ${SQL_REL}`);

  const raw = await readFile(JOURNAL, "utf8");
  const journal = JSON.parse(raw) as {
    version: string;
    dialect: string;
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
  };

  if (journal.entries.some((e) => e.tag === MIGRATION_TAG)) {
    throw new Error(`Journal already contains ${MIGRATION_TAG}`);
  }

  const nextIdx = Math.max(...journal.entries.map((e) => e.idx)) + 1;
  journal.entries.push({
    idx: nextIdx,
    version: journal.entries[journal.entries.length - 1]?.version ?? "7",
    when: Date.now(),
    tag: MIGRATION_TAG,
    breakpoints: true,
  });

  await writeFile(JOURNAL, JSON.stringify(journal, null, 2) + "\n", "utf8");
  console.log(`Appended migration to drizzle/meta/_journal.json (idx ${nextIdx})`);
  console.log("\nRun: pnpm db:migrate\n");
  console.log(SCHEMA_HINT);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
