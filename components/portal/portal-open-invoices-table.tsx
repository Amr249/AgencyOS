"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { ProjectSelectThumb } from "@/components/entity-select-option";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";
import { isSarCurrency } from "@/lib/utils";

export type PortalOpenInvoiceTableRow = {
  id: string;
  invoiceNumber: string;
  projectId: string | null;
  projectName: string | null;
  projectCoverImageUrl: string | null;
  projectClientLogoUrl: string | null;
  issueDate: string;
  status: string;
  total: string;
  amountDue: number;
  currency: string;
};

const INVOICE_BADGE_STATUSES = new Set([
  "paid",
  "draft",
  "sent",
  "partial",
  "overdue",
  "cancelled",
  "void",
]);

function formatIssueDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const base = String(dateStr).slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy");
}

function MoneyCell({ value, currency }: { value: string | number; currency: string }) {
  const formatted = formatAmount(String(value));
  if (formatted === "—") return <span>—</span>;
  if (isSarCurrency(currency)) {
    return (
      <span className="flex items-center gap-1 tabular-nums">
        <SarCurrencyIcon className="h-3.5 w-3.5" />
        <span>{formatted}</span>
      </span>
    );
  }
  return (
    <span className="tabular-nums">
      {currency} {formatted}
    </span>
  );
}

function sortHeader(
  label: string,
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  },
) {
  return (
    <Button
      variant="ghost"
      className="-me-3 flex h-8 w-full items-center justify-start gap-1 px-0 font-normal hover:bg-transparent"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span className="text-start">
        {label}{" "}
        {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "\u2195"}
      </span>
    </Button>
  );
}

type Props = {
  data: PortalOpenInvoiceTableRow[];
  showDue: boolean;
  emptyMessage: string;
};

export function PortalOpenInvoicesTable({ data, showDue, emptyMessage }: Props) {
  const t = useTranslations("clientPortal");

  const columns = React.useMemo<ColumnDef<PortalOpenInvoiceTableRow>[]>(() => {
    const statusLabel = (status: string) =>
      INVOICE_BADGE_STATUSES.has(status)
        ? t(`invoiceStatuses.${status}` as "invoiceStatuses.paid")
        : status;

    const cols: ColumnDef<PortalOpenInvoiceTableRow>[] = [
      {
        accessorKey: "projectName",
        header: ({ column }) => sortHeader(t("colProject"), column),
        cell: ({ row }) => {
          const r = row.original;
          if (!r.projectId || !r.projectName) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <ProjectSelectThumb
                coverImageUrl={r.projectCoverImageUrl}
                clientLogoUrl={r.projectClientLogoUrl}
                fallbackName={r.projectName}
                className="h-7 w-7"
              />
              <span className="truncate text-sm font-medium">{r.projectName}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "invoiceNumber",
        header: ({ column }) => sortHeader(t("colInvoice"), column),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.invoiceNumber}</span>
        ),
      },
      {
        accessorKey: "issueDate",
        header: ({ column }) => sortHeader(t("colIssueDate"), column),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatIssueDate(row.original.issueDate)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => sortHeader(t("colStatus"), column),
        cell: ({ row }) => (
          <Badge variant="secondary" className="normal-case">
            {statusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "totalAmount",
        accessorFn: (row) => parseFloat(String(row.total)),
        header: ({ column }) => sortHeader(t("colTotal"), column),
        cell: ({ row }) => (
          <MoneyCell value={row.original.total} currency={row.original.currency} />
        ),
      },
    ];

    if (showDue) {
      cols.push({
        accessorKey: "amountDue",
        header: ({ column }) => sortHeader(t("colDue"), column),
        cell: ({ row }) => (
          <MoneyCell value={row.original.amountDue} currency={row.original.currency} />
        ),
      });
    }

    cols.push({
      id: "pdf",
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 px-2 text-xs font-medium" asChild>
          <Link href={`/api/invoices/${row.original.id}/pdf`} target="_blank" rel="noopener noreferrer">
            {t("pdf")}
          </Link>
        </Button>
      ),
    });

    return cols;
  }, [t, showDue]);

  const columnLabels = React.useMemo(
    () => ({
      projectName: t("colProject"),
      invoiceNumber: t("colInvoice"),
      issueDate: t("colIssueDate"),
      status: t("colStatus"),
      totalAmount: t("colTotal"),
      ...(showDue ? { amountDue: t("colDue") } : {}),
    }),
    [t, showDue],
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-start" dir="rtl">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div dir="rtl" lang="ar">
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="p-4">
          <SortableDataTable<PortalOpenInvoiceTableRow>
            columns={columns}
            data={data}
            tableId="portal-open-invoices"
            getRowId={(row) => row.id}
            uiVariant="clients"
            tableDir="rtl"
            columnLabels={columnLabels}
            sortToolbarLabels={{
              none: "بدون ترتيب",
              sortPlaceholder: "فرز",
              sortedBy: "مرتب حسب:",
              clearSortAria: "إزالة الترتيب",
            }}
            enablePagination={false}
            enableSavedViews={false}
            enableRowOrderPersistence={false}
            emptyStateMessage={emptyMessage}
          />
        </div>
      </div>
    </div>
  );
}
