/**
 * @deprecated Prefer `npx tsx scripts/migrate-paid-invoices.ts` (same behavior).
 * Kept for existing npm script `db:backfill-legacy-payments`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { runLegacyPaidInvoicePaymentMigration } = await import("@/lib/migrate-legacy-payments");
  const { migratedCount, candidateCount } = await runLegacyPaidInvoicePaymentMigration();
  console.log(
    `Backfill complete: ${migratedCount} payment row(s) inserted, ${candidateCount} candidate(s) processed.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
