import React from "react";
import path from "path";
import { Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/types";

type AddressJson = { street?: string; city?: string; country?: string; postal?: string };

type InvoiceItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  amount: string;
};

export type InvoicePdfStatus = "pending" | "partial" | "paid";

type InvoiceData = {
  invoiceNumber: string;
  issueDate: string;
  issueDateFormatted: string;
  dueDate: string | null;
  dueDateFormatted: string | null;
  status: InvoicePdfStatus;
  clientName: string | null;
  clientAddress: AddressJson | null;
  clientPhone: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  notes: string | null;
  /** Comma-separated project names when invoice spans multiple projects */
  relatedProjectsLabel?: string | null;
  items: InvoiceItem[];
};

type SettingsData = {
  agencyName: string | null;
  agencyLogoUrl: string | null;
  agencyEmail: string | null;
  agencyAddress: AddressJson | null;
  invoiceColor: string | null;
  invoiceFooter: string | null;
};

function formatAddress(addr: AddressJson | null): string {
  if (!addr) return "—";
  const parts = [addr.street, addr.city, addr.postal, addr.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

const SAR_PNG_PATH = path.join(process.cwd(), "public", "Saudi_Riyal_Symbol.png");

function PdfMoney({
  value,
  currency,
  textStyle,
  wrapperStyle,
}: {
  value: string;
  currency: string;
  textStyle?: Style | Style[];
  wrapperStyle?: Style | Style[];
}) {
  const n = Number(value);
  const formatted = Number.isNaN(n) ? value : n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (currency !== "SAR") {
    return <Text style={textStyle}>{`${formatted} ${currency}`}</Text>;
  }
  const rowStyles: Style[] = [
    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
    ...(wrapperStyle == null ? [] : Array.isArray(wrapperStyle) ? wrapperStyle : [wrapperStyle]),
  ];
  return (
    <View style={rowStyles}>
      <Text style={textStyle}>{formatted}</Text>
      <Image src={SAR_PNG_PATH} style={{ width: 8, height: 8 }} />
    </View>
  );
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (method == null || method === "") return "—";
  if (method in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS];
  }
  return method;
}

function statusLabel(status: InvoicePdfStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partially Paid";
    default:
      return "Pending";
  }
}

function statusColors(status: InvoicePdfStatus): { bg: string; fg: string } {
  switch (status) {
    case "paid":
      return { bg: "#D1FAE5", fg: "#065F46" };
    case "partial":
      return { bg: "#DBEAFE", fg: "#1E40AF" };
    default:
      return { bg: "#FEF3C7", fg: "#92400E" };
  }
}

const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const DEFAULT_ACCENT = "#4F46E5";
const ROW_ALT = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 40,
    paddingBottom: 100,
    fontSize: 9,
    color: DARK,
    backgroundColor: "#FFFFFF",
  },
  topAccent: {
    height: 4,
    marginBottom: 20,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
    flexGrow: 1,
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    minWidth: 140,
  },
  docTitle: {
    fontFamily: "Helvetica",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontFamily: "Helvetica",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    fontWeight: "bold",
  },
  metaLabel: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: MUTED,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: "Helvetica",
    fontSize: 10,
    fontWeight: "bold",
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colFrom: {
    width: "48%",
  },
  colTo: {
    width: "48%",
  },
  sectionLabel: {
    fontFamily: "Helvetica",
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bodyText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 3,
  },
  logo: {
    maxHeight: 48,
    maxWidth: 160,
    objectFit: "contain",
    marginBottom: 8,
  },
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  th: {
    fontFamily: "Helvetica",
    fontSize: 8,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  td: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: DARK,
  },
  tdRight: { textAlign: "right" },
  tdCenter: { textAlign: "center" },
  colIdx: { width: "6%" },
  colDesc: { width: "34%" },
  colQty: { width: "8%" },
  colUnit: { width: "16%" },
  colTax: { width: "10%" },
  colAmt: { width: "26%" },
  totalsWrap: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  totalsBox: {
    width: 240,
    padding: 12,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: "#FAFAFA",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalLineFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontFamily: "Helvetica",
    fontSize: 9,
    fontWeight: "bold",
  },
  totalFinalLabel: {
    fontFamily: "Helvetica",
    fontSize: 11,
    fontWeight: "bold",
  },
  totalFinalValue: {
    fontFamily: "Helvetica",
    fontSize: 11,
    fontWeight: "bold",
  },
  paymentBlock: {
    marginBottom: 14,
  },
  paymentTitle: {
    fontFamily: "Helvetica",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
  },
  payHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  payRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  payColDate: { width: "28%" },
  payColAmt: { width: "28%" },
  payColMethod: { width: "44%" },
  paySummary: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  paySummaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 4,
  },
  amountDueBox: {
    marginTop: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountDueLabel: {
    fontFamily: "Helvetica",
    fontSize: 11,
    fontWeight: "bold",
  },
  amountDueValue: {
    fontFamily: "Helvetica",
    fontSize: 14,
    fontWeight: "bold",
  },
  notesBlock: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: ROW_ALT,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  notesTitle: {
    fontFamily: "Helvetica",
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesBody: {
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerTitle: {
    fontFamily: "Helvetica",
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footerText: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  footerContact: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: DARK,
  },
  thankYou: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: MUTED,
    fontStyle: "italic",
  },
});

type PaymentRow = {
  paymentDate: string;
  amount: string;
  paymentMethod: string | null;
  reference?: string | null;
};

export function InvoicePdfDocument({
  invoice,
  settings,
  accentColor,
  payments = [],
  totalPaid = 0,
  amountDue = 0,
}: {
  invoice: InvoiceData;
  settings: SettingsData | null;
  accentColor?: string;
  payments?: PaymentRow[];
  totalPaid?: number;
  amountDue?: number;
}) {
  const accent = accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : DEFAULT_ACCENT;
  const st = statusColors(invoice.status);
  const currency = invoice.currency || "SAR";

  const dynamic = StyleSheet.create({
    accentBar: { ...styles.topAccent, backgroundColor: accent },
    docTitle: { ...styles.docTitle, color: accent },
    tableHeader: { ...styles.tableHeader, backgroundColor: accent },
    payHeader: { ...styles.payHeader, backgroundColor: accent },
    totalsBorder: { borderColor: accent },
    amountDueBox: {
      ...styles.amountDueBox,
      backgroundColor: "#FFFBEB",
      borderColor: "#F59E0B",
    },
    amountDueValue: { ...styles.amountDueValue, color: "#B45309" },
    footerTop: { ...styles.footer, borderTopColor: accent },
  });

  const hasPayments = payments.length > 0;
  const showAmountDue = amountDue > 0.005;

  return (
    <Page size="A4" style={styles.page}>
      <View style={dynamic.accentBar} />

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={dynamic.docTitle}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusBadgeText, { color: st.fg }]}>{statusLabel(invoice.status)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.metaLabel}>Issue Date</Text>
          <Text style={styles.metaValue}>{invoice.issueDateFormatted}</Text>
          <Text style={[styles.metaLabel, { marginTop: 8 }]}>Due Date</Text>
          <Text style={styles.metaValue}>{invoice.dueDateFormatted ?? "—"}</Text>
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={styles.colFrom}>
          <Text style={[styles.sectionLabel, { color: accent }]}>From</Text>
          {settings?.agencyLogoUrl ? <Image src={settings.agencyLogoUrl} style={styles.logo} /> : null}
          <Text style={styles.bodyText}>{settings?.agencyName ?? "Agency"}</Text>
          <Text style={styles.bodyText}>{formatAddress(settings?.agencyAddress ?? null)}</Text>
          {settings?.agencyEmail ? (
            <Text style={styles.bodyText}>{settings.agencyEmail}</Text>
          ) : null}
        </View>
        <View style={styles.colTo}>
          <Text style={[styles.sectionLabel, { color: accent }]}>Bill To</Text>
          <Text style={styles.bodyText}>{invoice.clientName ?? "—"}</Text>
          <Text style={styles.bodyText}>{formatAddress(invoice.clientAddress)}</Text>
          {invoice.clientPhone ? <Text style={styles.bodyText}>{invoice.clientPhone}</Text> : null}
        </View>
      </View>

      {invoice.relatedProjectsLabel ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.sectionLabel}>Related projects</Text>
          <Text style={styles.bodyText}>{invoice.relatedProjectsLabel}</Text>
        </View>
      ) : null}

      <View style={styles.table}>
        <View style={dynamic.tableHeader}>
          <Text style={[styles.th, styles.colIdx]}>#</Text>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colQty, styles.tdCenter]}>Qty</Text>
          <Text style={[styles.th, styles.colUnit, styles.tdRight]}>Unit Price</Text>
          <Text style={[styles.th, styles.colTax, styles.tdCenter]}>Tax %</Text>
          <Text style={[styles.th, styles.colAmt, styles.tdRight]}>Amount</Text>
        </View>
        {invoice.items.map((item, i) => (
          <View
            key={i}
            style={[styles.tr, i % 2 === 1 ? { backgroundColor: ROW_ALT } : {}]}
            wrap={false}
          >
            <Text style={[styles.td, styles.colIdx]}>{i + 1}</Text>
            <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.td, styles.colQty, styles.tdCenter]}>{Number(item.quantity)}</Text>
            <View style={[styles.td, styles.colUnit, styles.tdRight]}>
              <PdfMoney value={item.unitPrice} currency={currency} textStyle={[styles.td, styles.tdRight]} />
            </View>
            <Text style={[styles.td, styles.colTax, styles.tdCenter]}>{Number(item.taxRate)}%</Text>
            <View style={[styles.td, styles.colAmt, styles.tdRight]}>
              <PdfMoney value={item.amount} currency={currency} textStyle={[styles.td, styles.tdRight]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.totalsWrap}>
        <View style={[styles.totalsBox, dynamic.totalsBorder]}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <PdfMoney value={invoice.subtotal} currency={currency} textStyle={styles.totalValue} />
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Tax</Text>
            <PdfMoney value={invoice.taxAmount} currency={currency} textStyle={styles.totalValue} />
          </View>
          <View style={[styles.totalLineFinal, { borderTopColor: accent }]}>
            <Text style={[styles.totalFinalLabel, { color: accent }]}>Grand Total</Text>
            <PdfMoney
              value={invoice.total}
              currency={currency}
              textStyle={[styles.totalFinalValue, { color: accent }]}
            />
          </View>
        </View>
      </View>

      {hasPayments ? (
        <View style={styles.paymentBlock}>
          <Text style={[styles.paymentTitle, { color: accent }]}>Payment History</Text>
          <View style={dynamic.payHeader}>
            <Text style={[styles.th, styles.payColDate]}>Date</Text>
            <Text style={[styles.th, styles.payColAmt, styles.tdRight]}>Amount</Text>
            <Text style={[styles.th, styles.payColMethod]}>Method</Text>
          </View>
          {[...payments]
            .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
            .map((p, i) => (
              <View
                key={`${p.paymentDate}-${i}`}
                style={[styles.payRow, i % 2 === 1 ? { backgroundColor: ROW_ALT } : {}]}
              >
                <Text style={[styles.td, styles.payColDate]}>{formatDate(p.paymentDate)}</Text>
                <View style={[styles.td, styles.payColAmt, styles.tdRight]}>
                  <PdfMoney value={p.amount} currency={currency} textStyle={[styles.td, styles.tdRight]} />
                </View>
                <Text style={[styles.td, styles.payColMethod]}>
                  {paymentMethodLabel(p.paymentMethod)}
                  {p.reference ? ` · Ref: ${p.reference}` : ""}
                </Text>
              </View>
            ))}
          <View style={styles.paySummary}>
            <View style={styles.paySummaryRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <PdfMoney value={String(totalPaid)} currency={currency} textStyle={styles.totalValue} />
            </View>
          </View>
        </View>
      ) : null}

      {showAmountDue ? (
        <View style={dynamic.amountDueBox}>
          <Text style={styles.amountDueLabel}>Amount Due</Text>
          <PdfMoney value={String(amountDue)} currency={currency} textStyle={dynamic.amountDueValue} />
        </View>
      ) : null}

      {invoice.notes ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesBody}>{invoice.notes}</Text>
        </View>
      ) : null}

      <Text style={styles.thankYou}>Thank you for your business.</Text>

      <View style={dynamic.footerTop} wrap={false}>
        {settings?.invoiceFooter ? (
          <>
            <Text style={styles.footerTitle}>Payment instructions</Text>
            <Text style={styles.footerText}>{settings.invoiceFooter}</Text>
          </>
        ) : null}
        {settings?.agencyEmail ? (
          <Text style={styles.footerContact}>Contact: {settings.agencyEmail}</Text>
        ) : null}
      </View>
    </Page>
  );
}
