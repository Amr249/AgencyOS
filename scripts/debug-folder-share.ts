/**
 * Debug folder public sharing: verify DB columns and share_token / is_public data.
 * Run: npx tsx scripts/debug-folder-share.ts
 * Optional: npx tsx scripts/debug-folder-share.ts <token-from-url>
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const tokenArg = process.argv[2]?.trim() || null;

  const [{ eq, or, sql }, { db }, { folders }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/db/schema"),
  ]);

  const allFolders = await db
    .select({
      id: folders.id,
      name: folders.name,
      path: folders.path,
      shareToken: folders.shareToken,
      isPublic: folders.isPublic,
      shareExpiresAt: folders.shareExpiresAt,
      projectId: folders.projectId,
    })
    .from(folders);

  const withToken = allFolders.filter((f) => (f.shareToken?.trim() ?? "").length > 0);

  console.log("=== FOLDERS: count with share_token set ===", withToken.length, "/", allFolders.length);
  console.log(
    JSON.stringify(
      withToken.map((f) => ({
        id: f.id,
        name: f.name,
        shareToken: f.shareToken,
        isPublic: f.isPublic,
        shareExpiresAt: f.shareExpiresAt,
      })),
      null,
      2
    )
  );

  const rawColumns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folders'
    ORDER BY ordinal_position
  `);
  console.log("\n=== FOLDERS TABLE COLUMNS (information_schema) ===");
  console.log(JSON.stringify(rawColumns.rows, null, 2));

  if (tokenArg) {
    console.log("\n=== LOOKUP BY TOKEN (arg) ===", JSON.stringify(tokenArg));
    const rawExact = await db.execute(sql`
      SELECT id, name, share_token, is_public, share_expires_at
      FROM folders
      WHERE share_token = ${tokenArg}
    `);
    console.log("Raw SQL WHERE share_token = arg:", JSON.stringify(rawExact.rows, null, 2));

    const rawLower = await db.execute(sql`
      SELECT id, name, share_token, is_public
      FROM folders
      WHERE share_token IS NOT NULL AND lower(share_token) = lower(${tokenArg})
    `);
    console.log("Raw SQL lower(share_token) = lower(arg):", JSON.stringify(rawLower.rows, null, 2));

    const [ormRow] = await db
      .select()
      .from(folders)
      .where(or(eq(folders.shareToken, tokenArg), sql`lower(${folders.shareToken}) = lower(${tokenArg})`))
      .limit(1);
    console.log(
      "Drizzle first row:",
      ormRow ? { id: ormRow.id, shareToken: ormRow.shareToken, isPublic: ormRow.isPublic } : null
    );
  }

  const { resolveSharedFolderRoot, getSharedFolderBrowse } = await import("@/lib/shared-folder-access");
  console.log("\n=== resolveSharedFolderRoot (confusable I vs l) ===");
  const bad = "rFuxbo1hFXd8fgzSAmI9";
  const good = "rFuxbo1hFXd8fgzSAml9";
  console.log("capital-I token ok:", (await resolveSharedFolderRoot(bad)).ok);
  console.log("lowercase-l token ok:", (await resolveSharedFolderRoot(good)).ok);
  const browseBad = await getSharedFolderBrowse(bad, null);
  console.log("getSharedFolderBrowse(bad):", browseBad.ok ? "ok" : browseBad.reason);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
