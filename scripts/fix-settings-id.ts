/**
 * Migrate `settings.id` from integer/serial to UUID (Postgres cannot auto-cast int → uuid).
 *
 *   npx tsx scripts/fix-settings-id.ts
 *
 * Loads `DATABASE_URL` from `.env.local` then `.env`.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env.local or .env");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log("Fixing settings table id column...");

  const [col] = await sql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'id'
  `;
  if (!col) {
    console.error("Column settings.id not found.");
    process.exit(1);
  }
  const dataType = String((col as { data_type: string }).data_type).toLowerCase();
  if (dataType === "uuid") {
    console.log("settings.id is already uuid — nothing to do.");
    return;
  }

  const rows = await sql`SELECT * FROM settings`;
  console.log(`Found ${rows.length} settings row(s)`);

  if (rows.length === 0) {
    await sql`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`;
    await sql`ALTER TABLE settings ALTER COLUMN id DROP DEFAULT`;
    await sql`ALTER TABLE settings ALTER COLUMN id TYPE uuid USING gen_random_uuid()`;
    await sql`ALTER TABLE settings ALTER COLUMN id SET DEFAULT gen_random_uuid()`;
    await sql`ALTER TABLE settings ADD PRIMARY KEY (id)`;
    console.log("settings.id changed to UUID (empty table)");
  } else {
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS id_new uuid DEFAULT gen_random_uuid()`;
    await sql`UPDATE settings SET id_new = gen_random_uuid() WHERE id_new IS NULL`;
    await sql`ALTER TABLE settings ALTER COLUMN id_new SET NOT NULL`;
    await sql`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`;
    await sql`ALTER TABLE settings ALTER COLUMN id DROP DEFAULT`;
    await sql`ALTER TABLE settings DROP COLUMN id`;
    await sql`ALTER TABLE settings RENAME COLUMN id_new TO id`;
    await sql`ALTER TABLE settings ADD PRIMARY KEY (id)`;
    await sql`ALTER TABLE settings ALTER COLUMN id SET DEFAULT gen_random_uuid()`;
    console.log("settings.id migrated from integer to UUID (data preserved on other columns)");
  }

  const check = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'id'
  `;
  console.log("Verification:", check);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
