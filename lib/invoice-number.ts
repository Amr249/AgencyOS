/**
 * Sequential invoice numbers: INV-001, INV-027, INV-1000 (minimum 3 digit width).
 */
export function formatInvoiceSerial(prefix: string, nextNum: number): string {
  const p = (prefix ?? "INV").trim() || "INV";
  const n = Math.max(1, Math.floor(Number(nextNum)) || 1);
  const width = Math.max(3, String(n).length);
  return `${p}-${String(n).padStart(width, "0")}`;
}
