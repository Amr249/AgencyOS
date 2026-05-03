/**
 * Post-push verification for organization_id + settings.id.
 *
 *   npx tsx scripts/verify-org-columns.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  const orgCols = await sql`
    SELECT table_name, column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organization_id'
    ORDER BY table_name
  `;
  console.log("organization_id columns:\n", JSON.stringify(orgCols, null, 2));

  const settingsId = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'id'
  `;
  console.log("settings.id:\n", JSON.stringify(settingsId, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
