"use client";

import { format } from "date-fns";

export type ReportPdfType =
  | "profit-loss"
  | "project-profitability"
  | "client-profitability"
  | "service-profitability";

/**
 * Fetches `/api/reports/pdf` and triggers a file save. Filename: `{type}-{yyyy-MM-dd}.pdf`.
 */
export async function downloadReportPdf(params: {
  type: ReportPdfType;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<void> {
  const sp = new URLSearchParams({ type: params.type });
  if (params.period) sp.set("period", params.period);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  const res = await fetch(`/api/reports/pdf?${sp.toString()}`);
  if (!res.ok) {
    let message = "Could not generate PDF.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.type}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
