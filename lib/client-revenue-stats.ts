import { invoiceCollectedAmount } from "@/lib/invoice-collected";

export type ClientRevenueRollup = {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  invoiceCount: number;
};

type InvoiceForRollup = {
  id: string;
  clientId: string;
  total: unknown;
  status: string;
  issueDate: unknown;
};

/** Per-client totals from invoices + payment sums (includes legacy paid rows without payment records). */
export function rollupRevenueByClient(
  invoiceRows: InvoiceForRollup[],
  paymentSumByInvoiceId: Map<string, number>,
): Map<string, ClientRevenueRollup> {
  const map = new Map<string, ClientRevenueRollup>();

  for (const inv of invoiceRows) {
    const cid = inv.clientId;
    const totalNum = Number(inv.total);
    const paySum = paymentSumByInvoiceId.get(inv.id) ?? 0;
    const collected = invoiceCollectedAmount(paySum, totalNum, inv.status);
    const issueStr = String(inv.issueDate);

    let row = map.get(cid);
    if (!row) {
      row = {
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        firstInvoiceDate: null,
        lastInvoiceDate: null,
        invoiceCount: 0,
      };
      map.set(cid, row);
    }
    row.totalInvoiced += totalNum;
    row.totalPaid += collected;
    row.invoiceCount += 1;
    if (!row.firstInvoiceDate || issueStr < row.firstInvoiceDate) row.firstInvoiceDate = issueStr;
    if (!row.lastInvoiceDate || issueStr > row.lastInvoiceDate) row.lastInvoiceDate = issueStr;
  }

  for (const row of map.values()) {
    row.totalOutstanding = Math.round((row.totalInvoiced - row.totalPaid) * 100) / 100;
  }

  return map;
}
