/**
 * Client-safe helpers for CSV download (UTF-8 BOM for Excel).
 */

export type CsvColumn<T extends Record<string, string | number>> = {
  key: keyof T;
  header: string;
};

export function stringifyCsv<T extends Record<string, string | number>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const escape = (val: string | number): string => {
    if (typeof val === "number" && Number.isFinite(val)) return String(val);
    const s = String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const headerLine = columns.map((c) => `"${String(c.header).replace(/"/g, '""')}"`).join(",");
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c.key])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function triggerTextDownload(content: string, filename: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
