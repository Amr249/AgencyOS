import React from "react";
import {
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

type AddressJson = { street?: string; city?: string; country?: string; postal?: string };

type InvoiceItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  amount: string;
};

type InvoiceData = {
  invoiceNumber: string;
  issueDate: string;
  issueDateFormatted: string;
  clientName: string | null;
  clientAddress: AddressJson | null;
  clientPhone: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  notes: string | null;
  items: InvoiceItem[];
};

type SettingsData = {
  agencyName: string | null;
  agencyLogoUrl: string | null;
  agencyEmail: string | null;
  agencyAddress: AddressJson | null;
  invoiceColor: string | null;
};

function formatMoney(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  const formatted = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${formatted} ر.س`;
}

const DARK = "#1F2937";
const MUTED = "#6B7280";
const DEFAULT_ACCENT = "#4F46E5";
const ROW_ALT = "#F9FAFB";

// RTL: use flexDirection: 'row-reverse' and textAlign: 'right' — react-pdf does not support direction: 'rtl'
const styles = StyleSheet.create({
  page: {
    fontFamily: "Cairo",
    padding: 40,
    paddingBottom: 120,
    fontSize: 10,
    backgroundColor: "#FFFFFF",
  },
  header: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerRight: {
    fontFamily: "Cairo",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  titleMain: {
    fontFamily: "Cairo",
    fontSize: 48,
    fontWeight: "bold",
    color: DEFAULT_ACCENT,
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "right",
  },
  titleNumber: {
    fontFamily: "Cairo",
    fontSize: 18,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 4,
    textAlign: "right",
  },
  titleDate: {
    fontFamily: "Cairo",
    fontSize: 11,
    color: MUTED,
    textAlign: "right",
  },
  logoWrap: {
    maxHeight: 60,
    width: "auto",
  },
  logo: {
    maxHeight: 60,
    width: "auto",
    objectFit: "contain",
  },
  separator: {
    height: 1,
    backgroundColor: DEFAULT_ACCENT,
    marginVertical: 16,
  },
  billTo: {
    fontFamily: "Cairo",
    marginBottom: 16,
  },
  billToRow: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    marginBottom: 4,
    alignItems: "center",
  },
  billToLabel: {
    fontFamily: "Cairo",
    fontSize: 10,
    fontWeight: "bold",
    color: DARK,
    marginLeft: 8,
    minWidth: 100,
    textAlign: "right",
  },
  billToValue: {
    fontFamily: "Cairo",
    fontSize: 10,
    color: DARK,
    textAlign: "right",
  },
  table: {
    fontFamily: "Cairo",
    marginTop: 8,
    marginBottom: 16,
  },
  tableHeader: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    backgroundColor: DARK,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontFamily: "Cairo",
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "right",
  },
  tableHeaderCellCenter: {
    fontFamily: "Cairo",
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  tableRow: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  tableRowAlt: {
    backgroundColor: ROW_ALT,
  },
  tableCell: {
    fontFamily: "Cairo",
    fontSize: 9,
    color: DARK,
    textAlign: "right",
  },
  tableCellCenter: {
    fontFamily: "Cairo",
    fontSize: 9,
    color: DARK,
    textAlign: "center",
  },
  colNo: { width: "8%" },
  colDesc: { width: "42%" },
  colQty: { width: "15%" },
  colUnit: { width: "17%" },
  colTotal: { width: "18%" },
  totals: {
    fontFamily: "Cairo",
    marginTop: 8,
    alignItems: "flex-end",
    width: "100%",
  },
  totalsRow: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
    marginBottom: 4,
    gap: 24,
  },
  totalsLabel: {
    fontFamily: "Cairo",
    fontSize: 10,
    color: DARK,
    textAlign: "right",
    minWidth: 100,
  },
  totalsValue: {
    fontFamily: "Cairo",
    fontSize: 10,
    color: DARK,
    textAlign: "left",
  },
  totalsFinal: {
    fontFamily: "Cairo",
    flexDirection: "row-reverse",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DARK,
    gap: 24,
  },
  totalsFinalLabel: {
    fontFamily: "Cairo",
    fontSize: 12,
    fontWeight: "bold",
    color: DARK,
    textAlign: "right",
    minWidth: 100,
  },
  totalsFinalValue: {
    fontFamily: "Cairo",
    fontSize: 12,
    fontWeight: "bold",
    color: DARK,
    textAlign: "left",
  },
  thankYou: {
    fontFamily: "Cairo",
    marginTop: 24,
    marginBottom: 24,
    alignItems: "center",
  },
  thankYouText: {
    fontFamily: "Cairo",
    fontSize: 16,
    color: MUTED,
    letterSpacing: 3,
    textAlign: "right",
  },
  footer: {
    fontFamily: "Cairo",
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerRight: {
    fontFamily: "Cairo",
    flexDirection: "column",
    alignItems: "flex-end",
    maxWidth: "70%",
  },
  footerLabel: {
    fontFamily: "Cairo",
    fontSize: 10,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 4,
    textAlign: "right",
  },
  footerNotes: {
    fontFamily: "Cairo",
    fontSize: 9,
    color: MUTED,
    textAlign: "right",
    lineHeight: 1.4,
  },
  footerContact: {
    fontFamily: "Cairo",
    fontSize: 9,
    color: MUTED,
    textAlign: "left",
  },
});

export function InvoicePdfDocument({
  invoice,
  settings,
  accentColor,
}: {
  invoice: InvoiceData;
  settings: SettingsData | null;
  accentColor?: string;
}) {
  const color = accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : DEFAULT_ACCENT;

  const pageStyles = StyleSheet.create({
    separator: { ...styles.separator, backgroundColor: color },
    titleMain: { ...styles.titleMain, color },
    tableHeader: { ...styles.tableHeader, backgroundColor: color },
    footer: { ...styles.footer, borderTopColor: color },
  });

  return (
    <Page size="A4" style={styles.page}>
      {/* Header: logo left, title + number + date right (RTL: first column right, second left) */}
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <Text style={pageStyles.titleMain}>فـــاتـورة</Text>
          <Text style={styles.titleNumber}># {invoice.invoiceNumber}</Text>
          <Text style={styles.titleDate}>
            {invoice.issueDateFormatted.replace(/\//g, " / ")}
          </Text>
        </View>
        <View style={styles.logoWrap}>
          {settings?.agencyLogoUrl ? (
            <Image src={settings.agencyLogoUrl} style={styles.logo} />
          ) : null}
        </View>
      </View>

      <View style={pageStyles.separator} />

      {/* Bill To */}
      <View style={styles.billTo}>
        <View style={styles.billToRow}>
          <Text style={styles.billToValue}>{invoice.clientName ?? "—"}</Text>
          <Text style={styles.billToLabel}>فـاتورة إلى:</Text>
        </View>
        <View style={styles.billToRow}>
          <Text style={styles.billToValue}>{invoice.clientPhone ?? "—"}</Text>
          <Text style={styles.billToLabel}>رقم الهاتف:</Text>
        </View>
      </View>

      <View style={pageStyles.separator} />

      {/* Line items table — RTL: NO | الخدمة/الوصف | الكمية | سعر الوحدة | الإجمالي */}
      <View style={styles.table}>
        <View style={pageStyles.tableHeader}>
          <Text style={[styles.tableHeaderCellCenter, styles.colNo]}>NO</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>الخدمة / الوصف</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>الكمية</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>سعر الوحدة (ر.س)</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>الإجمالي (ر.س)</Text>
        </View>
        {invoice.items.map((item, i) => (
          <View
            key={i}
            style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : [styles.tableRow]}
          >
            <Text style={[styles.tableCellCenter, styles.colNo]}>{i + 1}</Text>
            <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.tableCell, styles.colQty]}>{Number(item.quantity)}</Text>
            <Text style={[styles.tableCell, styles.colUnit]}>{formatMoney(item.unitPrice)}</Text>
            <Text style={[styles.tableCell, styles.colTotal]}>{formatMoney(item.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Totals — right-aligned */}
      <View style={styles.totals}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsValue}>{formatMoney(invoice.subtotal)}</Text>
          <Text style={styles.totalsLabel}>المجموع الفرعي:</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsValue}>{formatMoney(invoice.taxAmount)}</Text>
          <Text style={styles.totalsLabel}>الضريبة:</Text>
        </View>
        <View style={styles.totalsFinal}>
          <Text style={styles.totalsFinalValue}>{formatMoney(invoice.total)}</Text>
          <Text style={styles.totalsFinalLabel}>الإجمالي الكلي:</Text>
        </View>
      </View>

      <View style={pageStyles.separator} />

      {/* Thank you */}
      <View style={styles.thankYou}>
        <Text style={styles.thankYouText}>مـــــــع خـــــالص الشـــــكر</Text>
      </View>

      {/* Footer */}
      <View style={pageStyles.footer}>
        <View style={styles.footerRight}>
          <Text style={styles.footerLabel}>الشـــروط والتعـــليمات</Text>
          <Text style={styles.footerNotes}>
            {invoice.notes ?? "—"}
          </Text>
        </View>
        <Text style={styles.footerContact}>
          {settings?.agencyEmail ? `للتواصل: ${settings.agencyEmail}` : ""}
        </Text>
      </View>
    </Page>
  );
}
