import React from "react";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { getInvoiceWithPayments } from "@/actions/invoices";
import { auth } from "@/lib/auth";
import { db, settings } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { InvoicePdfDocument, type InvoicePdfStatus } from "@/components/modules/invoices/invoice-pdf-document";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoiceResult = await getInvoiceWithPayments(id);

  if (!invoiceResult.ok) {
    return NextResponse.json(
      { error: invoiceResult.error ?? "Invoice not found" },
      { status: 404 }
    );
  }

  const invoice = invoiceResult.data;
  if (invoice.organizationId !== orgId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const role = (session.user as { role?: string }).role;
  if (role === "client_portal") {
    const portalClientId = session.user.clientId ?? null;
    if (!portalClientId || invoice.clientId !== portalClientId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
  }

  const [settingsRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, orgId))
    .limit(1);

  const client = invoice.client;

  const paymentRows = invoice.payments.map((p) => ({
    paymentDate: p.paymentDate,
    amount: String(p.amount),
    paymentMethod: p.paymentMethod,
    reference: p.reference,
  }));

  const pdfProps = {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      issueDateFormatted: formatDate(invoice.issueDate),
      dueDate: invoice.dueDate ?? null,
      dueDateFormatted: invoice.dueDate ? formatDate(invoice.dueDate) : null,
      status: invoice.status as InvoicePdfStatus,
      clientName: client?.companyName ?? null,
      clientAddress: client?.address ?? null,
      clientPhone: client?.contactPhone ?? null,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      currency: invoice.currency,
      notes: invoice.notes,
      relatedProjectsLabel:
        invoice.linkedProjects && invoice.linkedProjects.length > 0
          ? invoice.linkedProjects.map((p) => p.name).join(", ")
          : null,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        amount: i.amount,
      })),
    },
    settings: settingsRow
      ? {
          agencyName: settingsRow.agencyName,
          agencyLogoUrl: settingsRow.agencyLogoUrl,
          agencyEmail: settingsRow.agencyEmail,
          agencyAddress: settingsRow.agencyAddress,
          invoiceColor: settingsRow.invoiceColor,
          invoiceFooter: settingsRow.invoiceFooter,
        }
      : null,
    accentColor: settingsRow?.invoiceColor ?? undefined,
    payments: paymentRows,
    totalPaid: invoice.totalPaid,
    amountDue: invoice.amountDue,
  };

  const buffer = await renderToBuffer(
    React.createElement(
      Document,
      { title: `Invoice ${invoice.invoiceNumber}` },
      React.createElement(InvoicePdfDocument, {
        invoice: pdfProps.invoice,
        settings: pdfProps.settings,
        accentColor: pdfProps.accentColor,
        payments: pdfProps.payments,
        totalPaid: pdfProps.totalPaid,
        amountDue: pdfProps.amountDue,
      })
    )
  );

  const rawFilename = `invoice-${invoice.invoiceNumber}.pdf`;
  const encodedFilename = encodeURIComponent(rawFilename);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice.pdf"; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
