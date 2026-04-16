"use client";

import * as React from "react";
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
import { ProjectSelectThumb } from "@/components/entity-select-option";
import type { MemberSalaryExpenseRow, MemberExpenseFileRow } from "@/actions/member-dashboard";
import { getMemberExpenseFiles } from "@/actions/member-dashboard";

function formatTableDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const base = String(dateStr).slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy");
}

function AmountCell({ value }: { value: string | null | undefined }) {
  const formatted = formatAmount(value);
  if (formatted === "—") return <span>—</span>;
  return (
    <span className="flex items-center gap-1 tabular-nums">
      <SarCurrencyIcon className="h-3.5 w-3.5" />
      <span>{formatted}</span>
    </span>
  );
}

function sortHeader(
  label: string,
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void },
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
  transactionFile: "ملف المعاملة",
  receiptFile: "إيصال الدفع",
  noFiles: "لا توجد ملفات مرفقة.",
  openFile: "فتح الملف",
  downloadFile: "تحميل",
};

type PaymentsTableProps = {
  data: MemberSalaryExpenseRow[];
  emptyMessage: string;
};

export function MemberPaymentsDataTable({ data, emptyMessage }: PaymentsTableProps) {
  const [detailRow, setDetailRow] = React.useState<MemberSalaryExpenseRow | null>(null);
  const [detailFiles, setDetailFiles] = React.useState<MemberExpenseFileRow[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const openDetail = React.useCallback(async (row: MemberSalaryExpenseRow) => {
    setDetailRow(row);
    setDetailLoading(true);
    setDetailFiles([]);
    const res = await getMemberExpenseFiles(row.id);
    if (res.ok) setDetailFiles(res.data);
    setDetailLoading(false);
  }, []);

  const columns = React.useMemo<ColumnDef<MemberSalaryExpenseRow>[]>(
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
        cell: ({ row }) => <AmountCell value={row.original.amount} />,
      },
      {
        id: "details",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80 px-2 text-xs font-medium"
              onClick={() => openDetail(r)}
            >
              {AR.details}
            </Button>
          );
        },
      },
    ],
    [openDetail],
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
        <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
          <div className="p-4">
            <SortableDataTable<MemberSalaryExpenseRow>
              columns={columns}
              data={data}
              tableId="member-payments"
              getRowId={(row) => row.id}
              uiVariant="clients"
              tableDir="rtl"
              columnLabels={{
                projectName: AR.project,
                serviceNames: AR.service,
                date: AR.date,
                amount: AR.amount,
              }}
              enablePagination={false}
              enableSavedViews={false}
              enableRowOrderPersistence={false}
              emptyStateMessage={emptyMessage}
            />
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent dir="rtl" lang="ar" className="sm:max-w-lg text-start">
          <DialogHeader>
            <DialogTitle>{AR.paymentDetails}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-5 py-2">
              {/* Payment info */}
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
                  <p className={`font-medium ${detailRow.serviceNames.length > 0 ? "" : "text-muted-foreground"}`}>
                    {detailRow.serviceNames.length > 0 ? detailRow.serviceNames.join("، ") : AR.noService}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{AR.date}</p>
                  <p className="font-medium">{formatTableDate(detailRow.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{AR.amount}</p>
                  <p className="inline-flex items-center gap-1 font-semibold tabular-nums">
                    <SarCurrencyIcon className="h-3.5 w-3.5" />
                    {formatAmount(detailRow.amount)}
                  </p>
                </div>
              </div>

              {/* Receipt / transaction files */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{AR.transactionFile}</h3>

                {detailRow.receiptUrl && (
                  <a
                    href={detailRow.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <span className="flex-1 truncate">{AR.receiptFile}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                )}

                {detailLoading ? (
                  <p className="text-muted-foreground text-sm">جارٍ التحميل…</p>
                ) : detailFiles.length > 0 ? (
                  <div className="space-y-2">
                    {detailFiles.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                      >
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{f.name}</p>
                          {f.sizeBytes != null && (
                            <p className="text-xs text-muted-foreground">
                              {(f.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : !detailRow.receiptUrl ? (
                  <p className="text-muted-foreground text-sm">{AR.noFiles}</p>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
