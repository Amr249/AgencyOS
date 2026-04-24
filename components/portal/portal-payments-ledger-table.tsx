"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";
import { isSarCurrency } from "@/lib/utils";
import { ProjectSelectThumb } from "@/components/entity-select-option";
import type { PortalClientPaymentLedgerRow } from "@/actions/portal-dashboard";

function formatTableDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const base = String(dateStr).slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy");
}

function AmountCell({
  value,
  currency,
}: {
  value: string | null | undefined;
  currency: string;
}) {
  const formatted = formatAmount(value);
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

const AR = {
  project: "المشروع",
  service: "الخدمة",
  date: "التاريخ",
  amount: "المبلغ",
  details: "التفاصيل",
  noProject: "بدون مشروع",
  noService: "—",
  paymentDetails: "تفاصيل الدفعة",
  invoice: "الفاتورة",
  paymentMethod: "طريقة الدفع",
  reference: "المرجع",
  notes: "ملاحظات",
  openPdf: "عرض PDF",
  none: "—",
};

type Props = {
  data: PortalClientPaymentLedgerRow[];
  emptyMessage: string;
};

export function PortalPaymentsLedgerTable({ data, emptyMessage }: Props) {
  const [detailRow, setDetailRow] = React.useState<PortalClientPaymentLedgerRow | null>(null);

  const columns = React.useMemo<ColumnDef<PortalClientPaymentLedgerRow>[]>(
    () => [
      {
        accessorKey: "projectName",
        header: ({ column }) => sortHeader(AR.project, column),
        cell: ({ row }) => {
          const r = row.original;
          if (!r.projectId || !r.projectName) {
            return <span className="text-muted-foreground text-sm">{AR.noProject}</span>;
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
        id: "serviceNames",
        accessorFn: (row) => row.serviceNames.join(", "),
        header: ({ column }) => sortHeader(AR.service, column),
        cell: ({ row }) => {
          const names = row.original.serviceNames;
          return (
            <span className={`text-sm ${names.length > 0 ? "" : "text-muted-foreground"}`}>
              {names.length > 0 ? names.join("، ") : AR.noService}
            </span>
          );
        },
      },
      {
        accessorKey: "date",
        header: ({ column }) => sortHeader(AR.date, column),
        cell: ({ row }) => (
          <span className="text-sm">{formatTableDate(row.original.date)}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => sortHeader(AR.amount, column),
        cell: ({ row }) => (
          <AmountCell value={row.original.amount} currency={row.original.currency} />
        ),
      },
      {
        id: "details",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 px-2 text-xs font-medium"
            onClick={() => setDetailRow(row.original)}
          >
            {AR.details}
          </Button>
        ),
      },
    ],
    [],
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-start" dir="rtl">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div dir="rtl" lang="ar">
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="p-4">
            <SortableDataTable<PortalClientPaymentLedgerRow>
              columns={columns}
              data={data}
              tableId="portal-payments-ledger"
              getRowId={(row) => row.id}
              uiVariant="clients"
              tableDir="rtl"
              columnLabels={{
                projectName: AR.project,
                serviceNames: AR.service,
                date: AR.date,
                amount: AR.amount,
              }}
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

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent dir="rtl" lang="ar" className="sm:max-w-lg text-start">
          <DialogHeader>
            <DialogTitle>{AR.paymentDetails}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">{AR.project}</p>
                  {detailRow.projectId && detailRow.projectName ? (
                    <div className="flex items-center gap-2 font-medium">
                      <ProjectSelectThumb
                        coverImageUrl={detailRow.projectCoverImageUrl}
                        clientLogoUrl={detailRow.projectClientLogoUrl}
                        fallbackName={detailRow.projectName}
                        className="h-6 w-6"
                      />
                      <span>{detailRow.projectName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{AR.noProject}</span>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{AR.service}</p>
                  <p
                    className={`font-medium ${detailRow.serviceNames.length > 0 ? "" : "text-muted-foreground"}`}
                  >
                    {detailRow.serviceNames.length > 0
                      ? detailRow.serviceNames.join("، ")
                      : AR.noService}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{AR.date}</p>
                  <p className="font-medium">{formatTableDate(detailRow.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{AR.amount}</p>
                  <p className="inline-flex items-center gap-1 font-semibold tabular-nums">
                    {isSarCurrency(detailRow.currency) ? (
                      <>
                        <SarCurrencyIcon className="h-3.5 w-3.5" />
                        {formatAmount(detailRow.amount)}
                      </>
                    ) : (
                      <>
                        {detailRow.currency} {formatAmount(detailRow.amount)}
                      </>
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">{AR.invoice}</p>
                  <p className="font-medium">{detailRow.invoiceNumber}</p>
                </div>
                {detailRow.paymentMethod ? (
                  <div>
                    <p className="text-muted-foreground mb-1">{AR.paymentMethod}</p>
                    <p className="font-medium">{detailRow.paymentMethod}</p>
                  </div>
                ) : null}
                {detailRow.reference ? (
                  <div>
                    <p className="text-muted-foreground mb-1">{AR.reference}</p>
                    <p className="font-medium break-all">{detailRow.reference}</p>
                  </div>
                ) : null}
                {detailRow.notes ? (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-1">{AR.notes}</p>
                    <p className="font-medium whitespace-pre-wrap">{detailRow.notes}</p>
                  </div>
                ) : null}
              </div>

              <Link
                href={`/api/invoices/${detailRow.invoiceId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
              >
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="flex-1 font-medium">{AR.openPdf}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
