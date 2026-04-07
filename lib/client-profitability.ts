import type { ClientProfitabilityRow, ClientProfitabilitySummary } from "@/actions/reports";

/** Aggregate totals from {@link getClientProfitability} rows for KPI cards. */
export function summarizeClientProfitability(rows: ClientProfitabilityRow[]): ClientProfitabilitySummary {
  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const r of rows) {
    totalRevenue += r.totalRevenue;
    totalExpenses += r.totalExpenses;
  }
  totalRevenue = Math.round(totalRevenue * 100) / 100;
  totalExpenses = Math.round(totalExpenses * 100) / 100;
  const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
  return {
    clientCount: rows.length,
    totalRevenue,
    totalExpenses,
    netProfit,
  };
}
