"use server";

import { db } from "@/lib/db";
import { payments, invoices } from "@/lib/db/schema";
import { eq, sum, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import { invoiceCollectedAmount } from "@/lib/invoice-collected";

export type Payment = typeof payments.$inferSelect;
export type PaymentWithInvoice = Payment & {
  invoice?: { invoiceNumber: string; total: string; clientId: string };
};

const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  paymentDate: z.string(),
  paymentMethod: z.enum(["bank_transfer", "cash", "credit_card", "cheque", "other"]).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const updatePaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive().optional(),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(["bank_transfer", "cash", "credit_card", "cheque", "other"]).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

async function recalculateInvoiceStatus(invoiceId: string) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
  });

  if (!invoice) return;

  const result = await db
    .select({ total: sum(payments.amount) })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const totalPaid = parseFloat(String(result[0]?.total ?? "0"));
  const invoiceTotal = parseFloat(invoice.total);

  let newStatus: "pending" | "partial" | "paid";
  if (totalPaid <= 0) {
    newStatus = "pending";
  } else if (totalPaid >= invoiceTotal) {
    newStatus = "paid";
  } else {
    newStatus = "partial";
  }

  await db
    .update(invoices)
    .set({
      status: newStatus,
      paidAt: newStatus === "paid" ? new Date() : null,
    })
    .where(eq(invoices.id, invoiceId));
}

export async function createPayment(input: z.infer<typeof createPaymentSchema>) {
  try {
    const validated = createPaymentSchema.parse(input);

    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: validated.invoiceId,
        amount: validated.amount.toString(),
        paymentDate: validated.paymentDate,
        paymentMethod: validated.paymentMethod,
        reference: validated.reference,
        notes: validated.notes,
      })
      .returning();

    await recalculateInvoiceStatus(validated.invoiceId);

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${validated.invoiceId}`);
    revalidatePath("/dashboard/reports");

    return { ok: true as const, data: payment };
  } catch (error) {
    console.error("createPayment", error);
    if (error instanceof z.ZodError) {
      return { ok: false as const, error: error.flatten().fieldErrors };
    }
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "Failed to create payment" };
  }
}

export async function updatePayment(input: z.infer<typeof updatePaymentSchema>) {
  try {
    const validated = updatePaymentSchema.parse(input);
    const { id, ...data } = validated;

    const currentPayment = await db.query.payments.findFirst({
      where: eq(payments.id, id),
    });

    if (!currentPayment) {
      return { ok: false as const, error: "Payment not found" };
    }

    const [updated] = await db
      .update(payments)
      .set({
        ...(data.amount !== undefined && { amount: data.amount.toString() }),
        ...(data.paymentDate && { paymentDate: data.paymentDate }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .where(eq(payments.id, id))
      .returning();

    await recalculateInvoiceStatus(currentPayment.invoiceId);

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${currentPayment.invoiceId}`);
    revalidatePath("/dashboard/reports");

    return { ok: true as const, data: updated };
  } catch (error) {
    console.error("updatePayment", error);
    if (error instanceof z.ZodError) {
      return { ok: false as const, error: error.flatten().fieldErrors };
    }
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "Failed to update payment" };
  }
}

export async function deletePayment(id: string) {
  try {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, id),
    });

    if (!payment) {
      return { ok: false as const, error: "Payment not found" };
    }

    await db.delete(payments).where(eq(payments.id, id));

    await recalculateInvoiceStatus(payment.invoiceId);

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${payment.invoiceId}`);
    revalidatePath("/dashboard/reports");

    return { ok: true as const };
  } catch (error) {
    console.error("deletePayment", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "Failed to delete payment" };
  }
}

export async function getPaymentsByInvoiceId(invoiceId: string) {
  try {
    const result = await db.query.payments.findMany({
      where: eq(payments.invoiceId, invoiceId),
      orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
    });
    return { ok: true as const, data: result };
  } catch (error) {
    console.error("getPaymentsByInvoiceId", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "Failed to load payments" };
  }
}

export async function getInvoicePaymentSummary(invoiceId: string) {
  try {
    const result = await db
      .select({ totalPaid: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const paymentSum = parseFloat(String(result[0]?.totalPaid ?? "0"));

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { ok: false as const, error: "Invoice not found" };
    }

    const invoiceTotal = parseFloat(invoice.total);
    const totalPaid = invoiceCollectedAmount(paymentSum, invoiceTotal, invoice.status);
    const amountDue = invoiceTotal - totalPaid;

    return {
      ok: true as const,
      data: {
        totalPaid,
        amountDue: Math.max(0, amountDue),
        invoiceTotal,
        paymentProgress: invoiceTotal > 0 ? (totalPaid / invoiceTotal) * 100 : 0,
      },
    };
  } catch (error) {
    console.error("getInvoicePaymentSummary", error);
    if (isDbConnectionError(error)) {
      return { ok: false as const, error: getDbErrorKey(error) };
    }
    return { ok: false as const, error: "Failed to load payment summary" };
  }
}
