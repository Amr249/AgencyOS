import React from "react";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";
import { Document, Font, renderToBuffer } from "@react-pdf/renderer";
import { getInvoiceById } from "@/actions/invoices";
import { getSettings } from "@/actions/settings";
import { formatDate } from "@/lib/utils";
import { InvoicePdfDocument } from "@/components/modules/invoices/invoice-pdf-document";

type Params = { params: Promise<{ id: string }> };

const cwd = process.cwd();

// Prefer @fontsource/cairo (Arabic WOFF), then public/fonts TTF, then base64 fallback
const cairoRegularNpm = path.join(cwd, "node_modules", "@fontsource", "cairo", "files", "cairo-arabic-400-normal.woff");
const cairoBoldNpm = path.join(cwd, "node_modules", "@fontsource", "cairo", "files", "cairo-arabic-700-normal.woff");
const cairoRegularPublic = path.join(cwd, "public", "fonts", "Cairo-Regular.ttf");
const cairoBoldPublic = path.join(cwd, "public", "fonts", "Cairo-Bold.ttf");

function registerCairoFont() {
  if (fs.existsSync(cairoRegularNpm) && fs.existsSync(cairoBoldNpm)) {
    Font.register({
      family: "Cairo",
      fonts: [
        { src: cairoRegularNpm, fontWeight: "normal" },
        { src: cairoBoldNpm, fontWeight: "bold" },
      ],
    });
    return;
  }
  if (fs.existsSync(cairoRegularPublic)) {
    if (fs.existsSync(cairoBoldPublic)) {
      Font.register({
        family: "Cairo",
        fonts: [
          { src: cairoRegularPublic, fontWeight: "normal" },
          { src: cairoBoldPublic, fontWeight: "bold" },
        ],
      });
    } else {
      Font.register({ family: "Cairo", src: cairoRegularPublic });
    }
    return;
  }
  // Base64 fallback when file paths exist but may be unreliable (e.g. serverless)
  const fallbackPath = fs.existsSync(cairoRegularNpm) ? cairoRegularNpm : cairoRegularPublic;
  if (fs.existsSync(fallbackPath)) {
    try {
      const buf = fs.readFileSync(fallbackPath);
      const base64 = `data:font/woff;base64,${buf.toString("base64")}`;
      Font.register({ family: "Cairo", src: base64 });
    } catch {
      console.warn("Cairo: base64 font registration failed.");
    }
  } else {
    console.warn(
      "Cairo font not found. Install @fontsource/cairo or add public/fonts/Cairo-Regular.ttf for Arabic PDF."
    );
  }
}

registerCairoFont();

// Disable hyphenation for Arabic (react-pdf would otherwise break words incorrectly)
Font.registerHyphenationCallback((word) => [word]);

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const [invoiceResult, settingsResult] = await Promise.all([
    getInvoiceById(id),
    getSettings(),
  ]);

  if (!invoiceResult.ok) {
    return NextResponse.json(
      { error: invoiceResult.error ?? "Invoice not found" },
      { status: 404 }
    );
  }

  const invoice = invoiceResult.data;
  const settings = settingsResult.ok ? settingsResult.data : null;

  const pdfProps = {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      issueDateFormatted: formatDate(invoice.issueDate),
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress,
      clientPhone: invoice.clientPhone ?? null,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      currency: invoice.currency,
      notes: invoice.notes,
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
        }
      : null,
    accentColor: settings?.invoiceColor ?? undefined,
  };

  const buffer = await renderToBuffer(
    React.createElement(
      Document,
      { title: `Invoice ${invoice.invoiceNumber}` },
      React.createElement(InvoicePdfDocument, {
        invoice: pdfProps.invoice,
        settings: pdfProps.settings,
        accentColor: pdfProps.accentColor,
      })
    )
  );

  // Encode the filename for Content-Disposition to support Arabic/Unicode
  const rawFilename = `فاتورة-${invoice.invoiceNumber}.pdf`;
  const encodedFilename = encodeURIComponent(rawFilename);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice.pdf"; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
