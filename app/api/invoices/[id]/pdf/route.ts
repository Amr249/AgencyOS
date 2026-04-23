import React from "react";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { getInvoiceWithPayments } from "@/actions/invoices";
import { getSettings } from "@/actions/settings";
import { authOptions } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { InvoicePdfDocument, type InvoicePdfStatus } from "@/components/modules/invoices/invoice-pdf-document";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [invoiceResult, settingsResult] = await Promise.all([
    getInvoiceWithPayments(id),
    getSettings(),
  ]);

  if (!invoiceResult.ok) {
    return NextResponse.json(
      { error: invoiceResult.error ?? "Invoice not found" },
      { status: 404 }
    );
  }

  const invoice = invoiceResult.data;
  const role = (session.user as { role?: string }).role;
  if (role === "client_portal") {
    const portalClientId = session.user.clientId ?? null;
    if (!portalClientId || invoice.clientId !== portalClientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const settings = settingsResult.ok ? settingsResult.data : null;

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
    settings: settings
      ? {
          agencyName: settings.agencyName,
          agencyLogoUrl: settings.agencyLogoUrl,
          agencyEmail: settings.agencyEmail,
          agencyAddress: settings.agencyAddress,
          invoiceColor: settings.invoiceColor,
          invoiceFooter: settings.invoiceFooter,
        }
      : null,
    accentColor: settings?.invoiceColor ?? undefined,
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
