import React from "react";
import { NextResponse } from "next/server";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import { getSettings } from "@/actions/settings";
import {
  getProfitLossStatement,
  getProjectProfitability,
  getClientProfitability,
  getServiceProfitability,
  type ProfitabilityDateRange,
} from "@/actions/reports";
import { PROFIT_LOSS_PERIODS, type ProfitLossPeriodKey } from "@/lib/reports-constants";
import { summarizeClientProfitability } from "@/lib/client-profitability";
import {
  ReportsProfitLossPdfDocument,
  ReportsProjectProfitabilityPdfDocument,
  ReportsClientProfitabilityPdfDocument,
  ReportsServiceProfitabilityPdfDocument,
} from "@/components/reports/reports-pdf-document";

const REPORT_TYPES = [
  "profit-loss",
  "project-profitability",
  "client-profitability",
  "service-profitability",
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(s: string): s is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(s);
}

function isProfitLossPeriod(s: string): s is ProfitLossPeriodKey {
  return (PROFIT_LOSS_PERIODS as readonly string[]).includes(s);
}

function safeAccent(hex: string | null | undefined): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return "#4F46E5";
}

function parseProfitabilityRange(searchParams: URLSearchParams): ProfitabilityDateRange | undefined {
  const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
  const dateTo = searchParams.get("dateTo")?.trim() || undefined;
  if (!dateFrom && !dateTo) return undefined;
  return { dateFrom, dateTo };
}

function profitabilityPeriodLine(range: ProfitabilityDateRange | undefined): string | undefined {
  if (!range?.dateFrom && !range?.dateTo) return undefined;
  if (range.dateFrom && range.dateTo) return `Filtered: ${range.dateFrom} — ${range.dateTo}`;
  if (range.dateFrom) return `From ${range.dateFrom}`;
  return `Through ${range.dateTo}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const period = searchParams.get("period") ?? "";
  const profitabilityRange = parseProfitabilityRange(searchParams);

  if (!isReportType(type)) {
    return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
  }

  if (type === "profit-loss") {
    if (!period || !isProfitLossPeriod(period)) {
      return NextResponse.json({ error: "Invalid or missing period for profit-loss" }, { status: 400 });
    }
  }

  const [settingsResult, generatedAt] = await Promise.all([
    getSettings(),
    Promise.resolve(format(new Date(), "yyyy-MM-dd HH:mm")),
  ]);

  const settings = settingsResult.ok ? settingsResult.data : null;
  const agencyName = settings?.agencyName?.trim() || "Agency";
  const accentColor = safeAccent(settings?.invoiceColor ?? undefined);
  const dateSlug = format(new Date(), "yyyy-MM-dd");

  try {
    let buffer: Buffer;
    let rawFilename: string;

    if (type === "profit-loss") {
      const pl = await getProfitLossStatement(period);
      if (!pl.ok) {
        return NextResponse.json({ error: "Failed to load statement" }, { status: 500 });
      }
      rawFilename = `profit-loss-${dateSlug}.pdf`;
      buffer = await renderToBuffer(
        React.createElement(
          Document,
          { title: "Profit & Loss" },
          React.createElement(ReportsProfitLossPdfDocument, {
            data: pl.data,
            agencyName,
            accentColor,
            generatedAt,
          })
        )
      );
    } else if (type === "project-profitability") {
      const res = await getProjectProfitability(profitabilityRange);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to load project profitability" }, { status: 500 });
      }
      rawFilename = `project-profitability-${dateSlug}.pdf`;
      const periodLine = profitabilityPeriodLine(profitabilityRange);
      buffer = await renderToBuffer(
        React.createElement(
          Document,
          { title: "Project profitability" },
          React.createElement(ReportsProjectProfitabilityPdfDocument, {
            rows: res.data,
            agencyName,
            accentColor,
            generatedAt,
            ...(periodLine ? { periodLine } : {}),
          })
        )
      );
    } else if (type === "client-profitability") {
      const res = await getClientProfitability(profitabilityRange);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to load client profitability" }, { status: 500 });
      }
      const rows = res.data;
      const summary = summarizeClientProfitability(rows);
      rawFilename = `client-profitability-${dateSlug}.pdf`;
      const periodLine = profitabilityPeriodLine(profitabilityRange);
      buffer = await renderToBuffer(
        React.createElement(
          Document,
          { title: "Client profitability" },
          React.createElement(ReportsClientProfitabilityPdfDocument, {
            rows,
            summary,
            agencyName,
            accentColor,
            generatedAt,
            ...(periodLine ? { periodLine } : {}),
          })
        )
      );
    } else {
      const res = await getServiceProfitability(profitabilityRange);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to load service profitability" }, { status: 500 });
      }
      rawFilename = `service-profitability-${dateSlug}.pdf`;
      const periodLine = profitabilityPeriodLine(profitabilityRange);
      buffer = await renderToBuffer(
        React.createElement(
          Document,
          { title: "Service profitability" },
          React.createElement(ReportsServiceProfitabilityPdfDocument, {
            rows: res.data,
            agencyName,
            accentColor,
            generatedAt,
            periodLine,
          })
        )
      );
    }

    const encodedFilename = encodeURIComponent(rawFilename);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (e) {
    console.error("reports/pdf", e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
