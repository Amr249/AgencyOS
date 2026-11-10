import "server-only";

import { eq, max, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";

/** Sum of recorded payments for an invoice, plus how many rows there are. */
export async function getInvoicePaymentTotals(invoiceId: string) {
  const [row] = await db
    .select({
      total: sum(payments.amount),
      lastPaymentDate: max(payments.paymentDate),
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  return {
    paid: parseFloat(String(row?.total ?? "0")),
    lastPaymentDate: row?.lastPaymentDate ?? null,
  };
}

/**
 * Derives the invoice status from its payment records (the source of truth):
 * none → pending, some → partial, all → paid. `not_received` is kept unless fully paid.
 * Paid date = date of the latest payment (noon UTC avoids day shifts).
 */
export async function recalculateInvoiceStatus(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
  });
  if (!invoice) return null;

  const { paid: totalPaid, lastPaymentDate } = await getInvoicePaymentTotals(invoiceId);
  const invoiceTotal = parseFloat(invoice.total);

  // Legacy invoices marked paid before payment rows existed: nothing to derive from.
  if (invoice.status === "paid" && totalPaid <= 0) return invoice;

  let newStatus: "pending" | "partial" | "paid" | "not_received";
  if (totalPaid >= invoiceTotal && totalPaid > 0) {
    newStatus = "paid";
  } else if (invoice.status === "not_received") {
    newStatus = "not_received";
  } else if (totalPaid <= 0) {
    newStatus = "pending";
  } else {
    newStatus = "partial";
  }

  const [row] = await db
    .update(invoices)
    .set({
      status: newStatus,
      paidAt:
        newStatus === "paid"
          ? lastPaymentDate
            ? new Date(`${lastPaymentDate}T12:00:00Z`)
            : new Date()
          : null,
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return row ?? null;
}
