import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { and, eq, notExists } from "drizzle-orm";

export type LegacyPaymentMigrationRow = {
  invoiceNumber: string;
  invoiceId: string;
  amount: string;
  paymentDate: string;
};

export type LegacyPaymentMigrationResult = {
  migratedCount: number;
  candidateCount: number;
  details: LegacyPaymentMigrationRow[];
};

function paymentDateFromInvoice(paidAt: Date | null, issueDate: string): string {
  if (paidAt != null) {
    const t = new Date(paidAt).getTime();
    if (!Number.isNaN(t)) {
      return new Date(paidAt).toISOString().slice(0, 10);
    }
  }
  const s = String(issueDate);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Inserts one `payments` row per invoice with status `paid` that has no payment rows yet.
 * Idempotent: safe to run multiple times (skips invoices that already have any payment).
 */
export async function runLegacyPaidInvoicePaymentMigration(): Promise<LegacyPaymentMigrationResult> {
  const candidates = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      paidAt: invoices.paidAt,
      issueDate: invoices.issueDate,
      paymentMethod: invoices.paymentMethod,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        notExists(
          db.select({ id: payments.id }).from(payments).where(eq(payments.invoiceId, invoices.id))
        )
      )
    );

  const details: LegacyPaymentMigrationRow[] = [];

  // Note: `drizzle-orm/neon-http` does not support interactive transactions; inserts are sequential.
  for (const inv of candidates) {
    const paymentDate = paymentDateFromInvoice(inv.paidAt, String(inv.issueDate));
    const method = inv.paymentMethod?.trim();
    await db.insert(payments).values({
      invoiceId: inv.id,
      amount: String(inv.total),
      paymentDate,
      paymentMethod: method && method.length > 0 ? method : "other",
      notes: "Migrated from legacy paid invoice",
    });
    details.push({
      invoiceNumber: inv.invoiceNumber,
      invoiceId: inv.id,
      amount: String(inv.total),
      paymentDate,
    });
  }

  return {
    migratedCount: details.length,
    candidateCount: candidates.length,
    details,
  };
}
