/**
 * Effective collected amount per invoice: sum of payment rows, or full invoice total
 * when status is "paid" but there are no payment rows (pre–payments-table data).
 */
export function invoiceCollectedAmount(
  paymentSum: number,
  invoiceTotal: number,
  status: string,
): number {
  if (paymentSum > 0) return paymentSum;
  if (status === "paid") return invoiceTotal;
  return 0;
}
