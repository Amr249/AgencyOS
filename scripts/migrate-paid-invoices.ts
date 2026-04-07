/**
 * Backfill `payments` for invoices marked paid before the payments table existed.
 * Idempotent: only touches paid invoices with zero payment rows.
 *
 * Run: npx tsx scripts/migrate-paid-invoices.ts
 * Requires: DATABASE_URL (e.g. in .env.local)
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { runLegacyPaidInvoicePaymentMigration } = await import("@/lib/migrate-legacy-payments");

  const { migratedCount, candidateCount, details } = await runLegacyPaidInvoicePaymentMigration();

  console.log(
    `Found ${candidateCount} paid invoice(s) with no payment records; inserted ${migratedCount} payment row(s).`
  );
  for (const row of details) {
    console.log(
      `  ${row.invoiceNumber}  id=${row.invoiceId}  ${row.amount} SAR  payment_date=${row.paymentDate}`
    );
  }
  console.log("Migration complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
