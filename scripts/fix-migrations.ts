import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set. Check .env.local.");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
  if (!existsSync(journalPath)) {
    console.error("❌ Journal not found:", journalPath);
    process.exit(1);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
  const entries = journal.entries as Array<{ tag: string; when: number }>;
  console.log("📖 Found journal entries:", entries.length);

  // Drizzle uses schema "drizzle" by default for migrations table
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const existingRows = await sql`
    SELECT hash FROM "drizzle"."__drizzle_migrations"
  `;
  const existingHashes = new Set((existingRows as { hash: string }[]).map((r) => r.hash));
  console.log("📋 Already recorded migrations:", existingHashes.size);

  let inserted = 0;
  for (const entry of entries) {
    const sqlPath = join(process.cwd(), "drizzle", `${entry.tag}.sql`);
    if (!existsSync(sqlPath)) {
      console.warn("⚠️  Migration file not found:", entry.tag);
      continue;
    }
    const content = readFileSync(sqlPath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");
    const created_at = entry.when ?? Date.now();

    if (existingHashes.has(hash)) {
      console.log("⏭️  Already exists:", entry.tag);
      continue;
    }

    await sql`
      INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${created_at})
    `;
    existingHashes.add(hash);
    console.log("✅ Recorded:", entry.tag);
    inserted++;
  }

  console.log(`\n✅ Done — inserted ${inserted} migration record(s)`);
  console.log("Now run: npm run db:migrate");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
