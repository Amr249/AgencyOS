import React from "react";
import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  ClientProfitabilityRow,
  ClientProfitabilitySummary,
  ProfitLossExpensesByCategory,
  ProfitLossStatement,
  ProjectProfitabilityRow,
  ServiceProfitabilityAnalyticsRow,
} from "@/actions/reports";

const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#D5D7DA";
const HEADER_BG = "#F3F4F6";

function formatSar(n: number): string {
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${s} ر.س`;
}

function formatPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

function baseStyles(accent: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 56,
      paddingHorizontal: 40,
      fontSize: 9,
      fontFamily: "Helvetica",
      color: DARK,
    },
    titleBar: {
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 8,
      marginBottom: 12,
    },
    agency: {
      fontSize: 11,
      fontWeight: "bold",
      color: DARK,
    },
    reportTitle: {
      fontSize: 14,
      fontWeight: "bold",
      marginTop: 4,
    },
    meta: {
      fontSize: 8,
      color: MUTED,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "bold",
      marginTop: 14,
      marginBottom: 6,
      color: DARK,
    },
    table: {
      borderWidth: 1,
      borderColor: BORDER,
      marginTop: 4,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      minHeight: 18,
      alignItems: "center",
    },
    rowLast: {
      flexDirection: "row",
      minHeight: 18,
      alignItems: "center",
    },
    headerRow: {
      flexDirection: "row",
      backgroundColor: HEADER_BG,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      minHeight: 20,
      alignItems: "center",
    },
    cellLabel: {
      flex: 1,
      paddingVertical: 4,
      paddingHorizontal: 6,
      fontSize: 8,
    },
    cellAmount: {
      width: 88,
      paddingVertical: 4,
      paddingHorizontal: 6,
      fontSize: 8,
      textAlign: "right",
    },
    cellRight: {
      textAlign: "right",
    },
    bold: { fontWeight: "bold" },
    muted: { color: MUTED },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      fontSize: 8,
      color: MUTED,
      textAlign: "center",
    },
    twoCol: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 3,
      borderBottomWidth: 1,
      borderBottomColor: "#ECECED",
    },
    projCellProject: { width: "28%", padding: 4, fontSize: 7 },
    projCell: { width: "12%", padding: 4, fontSize: 7, textAlign: "right" },
    projCellSmall: { width: "10%", padding: 4, fontSize: 7, textAlign: "right" },
    projHeader: { fontWeight: "bold", backgroundColor: HEADER_BG },
  });
}

const EXPENSE_ORDER: (keyof ProfitLossExpensesByCategory)[] = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
];

const EXPENSE_LABELS: Record<keyof ProfitLossExpensesByCategory, string> = {
  software: "Software",
  hosting: "Hosting",
  marketing: "Marketing",
  salaries: "Salaries",
  equipment: "Equipment",
  office: "Office",
  other: "Other",
};

type PdfHeaderProps = {
  agencyName: string;
  accentColor: string;
  reportTitle: string;
  generatedAt: string;
  periodLine?: string;
};

function PdfHeader({ agencyName, accentColor, reportTitle, generatedAt, periodLine }: PdfHeaderProps) {
  const styles = baseStyles(accentColor);
  return (
    <View style={styles.titleBar}>
      <Text style={styles.agency}>{agencyName}</Text>
      <Text style={styles.reportTitle}>{reportTitle}</Text>
      <Text style={styles.meta}>Generated: {generatedAt}</Text>
      {periodLine ? <Text style={styles.meta}>{periodLine}</Text> : null}
    </View>
  );
}

type ProfitLossPdfProps = {
  data: ProfitLossStatement;
  agencyName: string;
  accentColor: string;
  generatedAt: string;
};

export function ReportsProfitLossPdfDocument({ data, agencyName, accentColor, generatedAt }: ProfitLossPdfProps) {
  const styles = baseStyles(accentColor);
  const periodLine = `Period: ${data.period.label} (${data.period.startDate} — ${data.period.endDate})`;

  return (
    <Page size="A4" style={styles.page} wrap>
      <PdfHeader
        agencyName={agencyName}
        accentColor={accentColor}
        reportTitle="Profit & Loss Statement"
        generatedAt={generatedAt}
        periodLine={periodLine}
      />

      <Text style={styles.sectionTitle}>Revenue</Text>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={[styles.cellLabel, { flex: 1 }]}>Total invoiced (issue date in period)</Text>
          <Text style={[styles.cellAmount, styles.cellRight]}>{formatSar(data.revenue.invoiced)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.cellLabel, { flex: 1 }]}>Total collected (payment date in period)</Text>
          <Text style={[styles.cellAmount, styles.cellRight]}>{formatSar(data.revenue.collected)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={[styles.cellLabel, styles.muted, { flex: 1 }]}>Outstanding (unpaid on invoices issued in period)</Text>
          <Text style={[styles.cellAmount, styles.cellRight, styles.muted]}>{formatSar(data.revenue.outstanding)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Operating expenses (by category)</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.cellLabel, styles.bold, { flex: 1 }]}>Category</Text>
          <Text style={[styles.cellAmount, styles.bold, styles.cellRight]}>Amount</Text>
        </View>
        {EXPENSE_ORDER.map((key) => (
          <View key={key} style={styles.row}>
            <Text style={[styles.cellLabel, { flex: 1 }]}>{EXPENSE_LABELS[key]}</Text>
            <Text style={[styles.cellAmount, styles.cellRight]}>{formatSar(data.expenses.byCategory[key])}</Text>
          </View>
        ))}
        <View style={styles.rowLast}>
          <Text style={[styles.cellLabel, styles.bold, { flex: 1 }]}>Total expenses</Text>
          <Text style={[styles.cellAmount, styles.cellRight, styles.bold]}>{formatSar(data.expenses.total)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Profit</Text>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={[styles.cellLabel, { flex: 1 }]}>Gross profit (collected)</Text>
          <Text style={[styles.cellAmount, styles.cellRight]}>{formatSar(data.profit.gross)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.cellLabel, styles.bold, { flex: 1 }]}>Net profit (collected − expenses)</Text>
          <Text style={[styles.cellAmount, styles.cellRight, styles.bold]}>{formatSar(data.profit.net)}</Text>
        </View>
        <View style={styles.rowLast}>
          <Text style={[styles.cellLabel, { flex: 1 }]}>Profit margin</Text>
          <Text style={[styles.cellAmount, styles.cellRight]}>{formatPct(data.profit.margin)}</Text>
        </View>
      </View>

      {data.comparison ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Period comparison</Text>
          <Text style={{ fontSize: 8, color: MUTED, lineHeight: 1.4 }}>
            vs {data.comparison.compareLabel} ({data.comparison.previousPeriod.startDate} —{" "}
            {data.comparison.previousPeriod.endDate}) · Previous net: {formatSar(data.comparison.previousNet)} · Delta:{" "}
            {formatSar(data.comparison.delta)}
            {data.comparison.percentChange !== null
              ? ` (${data.comparison.percentChange >= 0 ? "+" : ""}${data.comparison.percentChange.toFixed(1)}% net)`
              : ""}
            {data.comparison.collectedPercentChange !== null
              ? ` · Collected change: ${data.comparison.collectedPercentChange >= 0 ? "+" : ""}${data.comparison.collectedPercentChange.toFixed(1)}%`
              : ""}
          </Text>
        </View>
      ) : null}

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </Page>
  );
}

type ProjectProfitabilityPdfProps = {
  rows: ProjectProfitabilityRow[];
  agencyName: string;
  accentColor: string;
  generatedAt: string;
  periodLine?: string;
};

function projectStatusLabel(row: ProjectProfitabilityRow): string {
  const p = row.profit;
  if (p > 0.005) return "Profitable";
  if (p < -0.005) return "Loss";
  return "Break-even";
}

export function ReportsProjectProfitabilityPdfDocument({
  rows,
  agencyName,
  accentColor,
  generatedAt,
  periodLine,
}: ProjectProfitabilityPdfProps) {
  const styles = baseStyles(accentColor);
  let totalRev = 0;
  let totalExp = 0;
  for (const r of rows) {
    totalRev += r.totalRevenue;
    totalExp += r.totalExpenses;
  }
  const net = Math.round((totalRev - totalExp) * 100) / 100;

  return (
    <Page size="A4" style={styles.page} wrap>
      <PdfHeader
        agencyName={agencyName}
        accentColor={accentColor}
        reportTitle="Project profitability"
        generatedAt={generatedAt}
        periodLine={periodLine ?? "All projects (collected vs project expenses)"}
      />

      <Text style={styles.meta}>
        Projects: {rows.length} · Total revenue: {formatSar(Math.round(totalRev * 100) / 100)} · Total expenses:{" "}
        {formatSar(Math.round(totalExp * 100) / 100)} · Net: {formatSar(net)}
      </Text>

      <Text style={styles.sectionTitle}>By project</Text>
      <View style={[styles.table, { marginTop: 6 }]}>
        <View style={[styles.row, styles.projHeader]}>
          <Text style={[styles.projCellProject, styles.bold]}>Project / Client</Text>
          <Text style={[styles.projCell, styles.bold]}>Revenue</Text>
          <Text style={[styles.projCell, styles.bold]}>Expenses</Text>
          <Text style={[styles.projCell, styles.bold]}>Profit</Text>
          <Text style={[styles.projCellSmall, styles.bold]}>Margin</Text>
          <Text style={[styles.projCellSmall, styles.bold]}>Status</Text>
        </View>
        {rows.map((row) => (
          <View key={row.projectId} style={styles.row}>
            <View style={styles.projCellProject}>
              <Text style={{ fontSize: 7, fontWeight: "bold" }}>{row.projectName}</Text>
              <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>{row.clientName ?? "—"}</Text>
            </View>
            <Text style={styles.projCell}>{formatSar(row.totalRevenue)}</Text>
            <Text style={styles.projCell}>{formatSar(row.totalExpenses)}</Text>
            <Text style={styles.projCell}>{formatSar(row.profit)}</Text>
            <Text style={styles.projCellSmall}>{formatPct(row.profitMargin)}</Text>
            <Text style={styles.projCellSmall}>{projectStatusLabel(row)}</Text>
          </View>
        ))}
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </Page>
  );
}

type ClientProfitabilityPdfProps = {
  rows: ClientProfitabilityRow[];
  summary: ClientProfitabilitySummary;
  agencyName: string;
  accentColor: string;
  generatedAt: string;
  periodLine?: string;
};

export function ReportsClientProfitabilityPdfDocument({
  rows,
  summary,
  agencyName,
  accentColor,
  generatedAt,
  periodLine,
}: ClientProfitabilityPdfProps) {
  const styles = baseStyles(accentColor);

  return (
    <Page size="A4" style={styles.page} wrap>
      <PdfHeader
        agencyName={agencyName}
        accentColor={accentColor}
        reportTitle="Client profitability"
        generatedAt={generatedAt}
        periodLine={periodLine ?? "Payments on client invoices vs tagged expenses"}
      />

      <Text style={styles.meta}>
        Clients: {summary.clientCount} · Revenue: {formatSar(summary.totalRevenue)} · Expenses:{" "}
        {formatSar(summary.totalExpenses)} · Net profit: {formatSar(summary.netProfit)}
      </Text>

      <Text style={styles.sectionTitle}>By client</Text>
      <View style={[styles.table, { marginTop: 6 }]}>
        <View style={[styles.row, styles.projHeader]}>
          <Text style={[styles.projCellProject, styles.bold]}>Client</Text>
          <Text style={[styles.projCell, styles.bold]}>Proj.</Text>
          <Text style={[styles.projCell, styles.bold]}>Inv.</Text>
          <Text style={[styles.projCell, styles.bold]}>Exp. lines</Text>
          <Text style={[styles.projCell, styles.bold]}>Revenue</Text>
          <Text style={[styles.projCell, styles.bold]}>Expenses</Text>
          <Text style={[styles.projCell, styles.bold]}>Profit</Text>
          <Text style={[styles.projCellSmall, styles.bold]}>Margin</Text>
        </View>
        {rows.map((row) => (
          <View key={row.clientId} style={styles.row}>
            <Text style={styles.projCellProject}>{row.companyName ?? "—"}</Text>
            <Text style={styles.projCell}>{row.projectCount}</Text>
            <Text style={styles.projCell}>{row.invoiceCount}</Text>
            <Text style={styles.projCell}>{row.expenseCount}</Text>
            <Text style={styles.projCell}>{formatSar(row.totalRevenue)}</Text>
            <Text style={styles.projCell}>{formatSar(row.totalExpenses)}</Text>
            <Text style={styles.projCell}>{formatSar(row.profit)}</Text>
            <Text style={styles.projCellSmall}>
              {row.totalRevenue > 0.0001 ? `${row.profitMargin.toFixed(1)}%` : "—"}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </Page>
  );
}

type ServiceProfitabilityPdfProps = {
  rows: ServiceProfitabilityAnalyticsRow[];
  agencyName: string;
  accentColor: string;
  generatedAt: string;
  periodLine?: string;
};

export function ReportsServiceProfitabilityPdfDocument({
  rows,
  agencyName,
  accentColor,
  generatedAt,
  periodLine,
}: ServiceProfitabilityPdfProps) {
  const styles = baseStyles(accentColor);
  let totalRev = 0;
  let totalExp = 0;
  for (const r of rows) {
    totalRev += r.totalRevenue;
    totalExp += r.totalExpenses;
  }
  const net = Math.round((totalRev - totalExp) * 100) / 100;

  return (
    <Page size="A4" style={styles.page} wrap>
      <PdfHeader
        agencyName={agencyName}
        accentColor={accentColor}
        reportTitle="Service profitability"
        generatedAt={generatedAt}
        periodLine={periodLine ?? "Allocated from project payments and expenses"}
      />

      <Text style={styles.meta}>
        Services: {rows.length} · Total revenue: {formatSar(Math.round(totalRev * 100) / 100)} · Total expenses:{" "}
        {formatSar(Math.round(totalExp * 100) / 100)} · Net: {formatSar(net)}
      </Text>

      <Text style={styles.sectionTitle}>By service</Text>
      <View style={[styles.table, { marginTop: 6 }]}>
        <View style={[styles.row, styles.projHeader]}>
          <Text style={[styles.projCellProject, styles.bold]}>Service</Text>
          <Text style={[styles.projCell, styles.bold]}>Projects</Text>
          <Text style={[styles.projCell, styles.bold]}>Revenue</Text>
          <Text style={[styles.projCell, styles.bold]}>Expenses</Text>
          <Text style={[styles.projCell, styles.bold]}>Profit</Text>
          <Text style={[styles.projCellSmall, styles.bold]}>Margin</Text>
        </View>
        {rows.map((row) => (
          <View key={row.serviceId} style={styles.row}>
            <Text style={styles.projCellProject}>{row.serviceName}</Text>
            <Text style={styles.projCell}>{row.projectCount}</Text>
            <Text style={styles.projCell}>{formatSar(row.totalRevenue)}</Text>
            <Text style={styles.projCell}>{formatSar(row.totalExpenses)}</Text>
            <Text style={styles.projCell}>{formatSar(row.profit)}</Text>
            <Text style={styles.projCellSmall}>
              {row.totalRevenue > 0.0001 ? `${row.profitMargin.toFixed(1)}%` : "—"}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </Page>
  );
}
