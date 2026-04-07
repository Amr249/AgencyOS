"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import {
  deleteInvoice,
  deleteInvoices,
  getInvoicesExportData,
  type InvoiceExportRow,
  type InvoicesExportFilters,
} from "@/actions/invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { MarkAsPaidDialog } from "./mark-as-paid-dialog";
import { toast } from "sonner";
import { cn, formatAmount, formatDate as formatDateDDMMYYYY } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { ChevronDown, Download, MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { format } from "date-fns";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
  paidAt: Date | string | null;
  total: string;
  currency: string;
  clientName: string | null;
  clientLogoUrl: string | null;
  projectName: string | null;
  totalPaid?: number;
  amountDue?: number;
};

type Stats = { totalInvoiced: number; collected: number; outstanding: number };

type ClientsOption = { id: string; companyName: string | null };
type SettingsData = {
  invoicePrefix: string | null;
  invoiceNextNumber: number | null;
  defaultCurrency: string | null;
  defaultPaymentTerms: number | null;
  invoiceFooter: string | null;
};

type InvoicesListViewProps = {
  invoices: InvoiceRow[];
  stats: Stats;
  clients: ClientsOption[];
  settings: SettingsData | null;
  nextInvoiceNumber: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

function isDueDateOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (status === "paid" || !dueDate) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  return dueDate < todayStr;
}

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
];

const EXPORT_COLUMNS: { key: keyof InvoiceExportRow; header: string }[] = [
  { key: "invoiceNumber", header: "Invoice number" },
  { key: "clientName", header: "Client name" },
  { key: "projectName", header: "Project name" },
  { key: "status", header: "Status" },
  { key: "issueDate", header: "Issue date" },
  { key: "dueDate", header: "Due date" },
  { key: "subtotal", header: "Subtotal" },
  { key: "taxAmount", header: "Tax amount" },
  { key: "total", header: "Total" },
  { key: "paidAmount", header: "Paid amount" },
  { key: "outstandingAmount", header: "Outstanding amount" },
  { key: "paidAt", header: "Paid at" },
  { key: "paymentMethod", header: "Payment method" },
];

function escapeCsvCell(val: string | number): string {
  if (typeof val === "number" && Number.isFinite(val)) {
    return String(val);
  }
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function invoicesToCsv(rows: InvoiceExportRow[]): string {
  const header = EXPORT_COLUMNS.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((r) =>
    EXPORT_COLUMNS.map((c) => escapeCsvCell(r[c.key])).join(",")
  );
  return [header, ...lines].join("\n");
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function invoicesToXlsxBuffer(rows: InvoiceExportRow[]): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [
    EXPORT_COLUMNS.map((c) => c.header),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => r[c.key])),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  const u8 = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function AmountWithSarIcon({
  value,
  className,
  iconClassName,
  imageStyle,
}: {
  value: string | null | undefined;
  className?: string;
  iconClassName?: string;
  imageStyle?: React.CSSProperties;
}) {
  const formatted = formatAmount(value);
  if (formatted === "—") return <span>—</span>;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}
      dir="ltr"
    >
      {formatted}
      <SarCurrencyIcon
        className={iconClassName ?? "text-neutral-500"}
        imageStyle={imageStyle}
      />
    </span>
  );
}

export function InvoicesListView({
  invoices,
  stats,
  clients,
  settings,
  nextInvoiceNumber,
}: InvoicesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<{
    id: string;
    invoiceNumber: string;
    status: string;
  } | null>(null);
  const [payDialogInvoice, setPayDialogInvoice] = React.useState<{
    id: string;
    invoiceNumber: string;
    amountDue?: number;
  } | null>(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = React.useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

  const statusParam = searchParams.get("status") ?? "all";
  const dateRangeParam = searchParams.get("dateRange") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const hasCustomDateRange = Boolean(dateFromParam || dateToParam);
  const searchParam = searchParams.get("search") ?? "";

  const selectedInView = invoices.filter((inv) => selectedIds.has(inv.id)).length;
  const allVisibleSelected = invoices.length > 0 && selectedInView === invoices.length;

  const [exporting, setExporting] = React.useState(false);

  const buildExportFilters = React.useCallback((): InvoicesExportFilters => {
    const f: InvoicesExportFilters = {};
    if (statusParam !== "all") f.status = statusParam;
    if (hasCustomDateRange) {
      if (dateFromParam) f.dateFrom = dateFromParam;
      if (dateToParam) f.dateTo = dateToParam;
    } else if (dateRangeParam !== "all") {
      f.dateRange = dateRangeParam;
    }
    const q = searchParam.trim();
    if (q) f.search = q;
    return f;
  }, [
    statusParam,
    hasCustomDateRange,
    dateFromParam,
    dateToParam,
    dateRangeParam,
    searchParam,
  ]);

  const handleExportCsv = React.useCallback(async () => {
    setExporting(true);
    try {
      const res = await getInvoicesExportData(buildExportFilters());
      if (!res.ok) {
        toast.error(typeof res.error === "string" ? res.error : "Export failed");
        return;
      }
      if (res.data.length === 0) {
        toast.info("No invoices match your filters.");
        return;
      }
      const stamp = format(new Date(), "yyyy-MM-dd");
      const csv = `\uFEFF${invoicesToCsv(res.data)}`;
      triggerFileDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `invoices-${stamp}.csv`);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }, [buildExportFilters]);

  const handleExportExcel = React.useCallback(async () => {
    setExporting(true);
    try {
      const res = await getInvoicesExportData(buildExportFilters());
      if (!res.ok) {
        toast.error(typeof res.error === "string" ? res.error : "Export failed");
        return;
      }
      if (res.data.length === 0) {
        toast.info("No invoices match your filters.");
        return;
      }
      const stamp = format(new Date(), "yyyy-MM-dd");
      const buffer = await invoicesToXlsxBuffer(res.data);
      triggerFileDownload(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `invoices-${stamp}.xlsx`
      );
      toast.success("Excel file downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }, [buildExportFilters]);

  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedInView > 0 && !allVisibleSelected;
  }, [selectedInView, allVisibleSelected, invoices.length]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) invoices.forEach((inv) => next.delete(inv.id));
      else invoices.forEach((inv) => next.add(inv.id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateParams = React.useCallback(
    (updates: {
      status?: string;
      dateRange?: string;
      search?: string;
      dateFrom?: string | null;
      dateTo?: string | null;
    }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined)
        updates.status && updates.status !== "all" ? next.set("status", updates.status) : next.delete("status");
      if (updates.dateRange !== undefined) {
        if (updates.dateRange && updates.dateRange !== "all") {
          next.set("dateRange", updates.dateRange);
          next.delete("dateFrom");
          next.delete("dateTo");
        } else {
          next.delete("dateRange");
        }
      }
      if (updates.search !== undefined)
        updates.search ? next.set("search", updates.search) : next.delete("search");
      if (updates.dateFrom !== undefined) {
        if (updates.dateFrom) {
          next.set("dateFrom", updates.dateFrom);
          next.delete("dateRange");
        } else {
          next.delete("dateFrom");
        }
      }
      if (updates.dateTo !== undefined) {
        if (updates.dateTo) {
          next.set("dateTo", updates.dateTo);
          next.delete("dateRange");
        } else {
          next.delete("dateTo");
        }
      }
      router.push(`/dashboard/invoices?${next.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("search") as HTMLInputElement)?.value?.trim() ?? "";
    updateParams({ search: q || undefined });
  };

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    const res = await deleteInvoices(ids);
    if (res.ok) {
      toast.success("Invoices deleted");
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete selected invoices");
    }
  }

  const invoiceTableColumns = React.useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-neutral-900"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-neutral-900"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleRow(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={row.original.invoiceNumber}
          />
        ),
      },
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "invoiceNumber",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Invoice # {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/dashboard/invoices/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.invoiceNumber}
          </Link>
        ),
      },
      {
        accessorKey: "clientName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Client {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={row.original.clientLogoUrl ?? undefined} />
              <AvatarFallback className="text-xs">{(row.original.clientName ?? "?").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span>{row.original.clientName ?? "—"}</span>
          </div>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Project {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => row.original.projectName ?? "—",
      },
      {
        accessorKey: "total",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Amount {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => <AmountWithSarIcon value={row.original.total} />,
      },
      {
        accessorKey: "amountDue",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">
              Amount Due {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const amountDue = row.original.amountDue ?? 0;
          const status = row.original.status;
          if (status === "paid") {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center justify-end gap-1">
              <span className={amountDue > 0 ? "font-medium text-amber-600" : ""}>
                {amountDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <SarCurrencyIcon className="h-3 w-3 text-neutral-500" />
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Status {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-0.5">
            <InvoiceStatusBadge
              invoiceId={row.original.id}
              status={row.original.status}
              invoiceNumber={row.original.invoiceNumber}
              amountDue={row.original.amountDue}
              onRequestMarkAsPaid={(invoice) => setPayDialogInvoice(invoice)}
            />
            {row.original.status === "paid" && row.original.paidAt && (
              <span className="text-xs text-muted-foreground">
                Paid on:{" "}
                {formatDateDDMMYYYY(row.original.paidAt instanceof Date ? row.original.paidAt.toISOString().slice(0, 10) : String(row.original.paidAt).slice(0, 10))}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "issueDate",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Issue date {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => formatDateDDMMYYYY(row.original.issueDate),
      },
      {
        accessorKey: "dueDate",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">
              Due date {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const dueDate = row.original.dueDate;
          const status = row.original.status;
          const isOverdue = isDueDateOverdue(dueDate, status);
          return (
            <span className={isOverdue ? "font-medium text-red-600" : ""}>
              {dueDate ? formatDateDDMMYYYY(dueDate) : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/invoices/${inv.id}`}>View</Link>
                </DropdownMenuItem>
                {(inv.status === "pending" || inv.status === "partial") && (
                  <DropdownMenuItem
                    onSelect={() =>
                      setPayDialogInvoice({
                        id: inv.id,
                        invoiceNumber: inv.invoiceNumber,
                        amountDue: inv.amountDue,
                      })
                    }
                  >
                    Mark as paid
                  </DropdownMenuItem>
                )}
                {inv.status === "pending" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/invoices/${inv.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setInvoiceToDelete({ id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status });
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [allVisibleSelected, selectedIds]
  );

  return (
    <div className="space-y-6" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <NewInvoiceDialog
          clients={clients}
          settings={settings}
          nextInvoiceNumber={nextInvoiceNumber}
          open={newInvoiceOpen}
          onOpenChange={setNewInvoiceOpen}
          trigger={
            <Button variant="secondary" className="w-full sm:w-auto">
              <PlusCircle className="me-2 h-4 w-4" />
              New invoice
            </Button>
          }
          onSuccess={() => router.refresh()}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#e5e5e5] bg-[rgba(164,254,25,1)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-bold">Total invoiced</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(stats.totalInvoiced)} />
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e5e5]">
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-bold">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(stats.collected)} />
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-[#e5e5e5] bg-[#ededed] p-4 text-black shadow-sm">
          <CardHeader className="p-0 pb-0">
            <CardTitle className="text-left text-sm font-normal text-black">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-black">
                {stats.outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <SarCurrencyIcon className="h-5 w-5 text-black" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <form onSubmit={handleSearchSubmit} className="w-full flex-1 sm:max-w-sm">
              <Input name="search" placeholder="Search by invoice # or client…" defaultValue={searchParam} className="w-full text-left" dir="ltr" />
            </form>
            <Select
              value={hasCustomDateRange ? "__custom__" : dateRangeParam || "all"}
              onValueChange={(v) => {
                if (v === "__custom__") return;
                updateParams({ dateRange: v, dateFrom: null, dateTo: null });
              }}
            >
              <SelectTrigger className="w-full text-left sm:w-[180px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" disabled className="text-muted-foreground">
                  Custom range (use dates below)
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusParam} onValueChange={(v) => updateParams({ status: v })}>
              <SelectTrigger className="w-full text-left sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                disabled={exporting}
                aria-busy={exporting}
              >
                {exporting ? (
                  <span className="text-muted-foreground">Exporting…</span>
                ) : (
                  <>
                    <Download className="me-2 h-4 w-4" />
                    Export
                    <ChevronDown className="ms-1 h-4 w-4 opacity-70" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={exporting}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleExportCsv();
                }}
              >
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exporting}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleExportExcel();
                }}
              >
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid w-full gap-1 sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground">Start date</span>
            <DatePickerAr
              className="w-full sm:w-[160px]"
              popoverAlign="start"
              placeholder="From"
              value={dateFromParam ? new Date(`${dateFromParam}T12:00:00`) : undefined}
              onChange={(date) =>
                updateParams({
                  dateFrom: date ? format(date, "yyyy-MM-dd") : null,
                })
              }
            />
          </div>
          <div className="grid w-full gap-1 sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground">End date</span>
            <DatePickerAr
              className="w-full sm:w-[160px]"
              popoverAlign="start"
              placeholder="To"
              value={dateToParam ? new Date(`${dateToParam}T12:00:00`) : undefined}
              onChange={(date) =>
                updateParams({
                  dateTo: date ? format(date, "yyyy-MM-dd") : null,
                })
              }
            />
          </div>
          {hasCustomDateRange ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground sm:mb-0.5"
              onClick={() => updateParams({ dateFrom: null, dateTo: null })}
            >
              Clear dates
            </Button>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-800">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="md:hidden">
        {invoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No invoices match your filters.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <InvoiceStatusBadge
                    invoiceId={inv.id}
                    status={inv.status}
                    invoiceNumber={inv.invoiceNumber}
                    amountDue={inv.amountDue}
                    onRequestMarkAsPaid={(invoice) => setPayDialogInvoice(invoice)}
                  />
                  <span className="font-bold">{inv.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{formatDateDDMMYYYY(inv.issueDate)}</span>
                  <span className="font-medium">
                    <AmountWithSarIcon value={inv.total} />
                  </span>
                </div>
                {inv.status !== "paid" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount due</span>
                    <span className={cn("font-medium", (inv.amountDue ?? 0) > 0 && "text-amber-600")}>
                      {(inv.amountDue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                      <SarCurrencyIcon className="inline h-3 w-3 align-middle text-neutral-500" />
                    </span>
                  </div>
                )}
                <p className="text-sm">{inv.clientName ?? "—"}</p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/invoices/${inv.id}`}>View</Link>
                  </Button>
                  {(inv.status === "pending" || inv.status === "partial") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPayDialogInvoice({
                          id: inv.id,
                          invoiceNumber: inv.invoiceNumber,
                          amountDue: inv.amountDue,
                        })
                      }
                    >
                      Mark as paid
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-neutral-100 bg-white md:block" dir="ltr">
        <CardContent className="pt-4">
          <SortableDataTable<InvoiceRow>
            columns={invoiceTableColumns}
            data={invoices}
            tableId="invoices-table"
            getRowId={(inv) => inv.id}
            uiVariant="clients"
            columnLabels={{
              invoiceNumber: "Invoice #",
              clientName: "Client",
              projectName: "Project",
              total: "Amount",
              amountDue: "Amount Due",
              status: "Status",
              issueDate: "Issue date",
              dueDate: "Due date",
            }}
            enablePagination={false}
          />
        </CardContent>
      </div>

      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `This will permanently delete invoice ${invoiceToDelete.invoiceNumber}. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!invoiceToDelete) return;
                const id = invoiceToDelete.id;
                setInvoiceToDelete(null);
                const res = await deleteInvoice(id);
                if (res.ok) {
                  toast.success("Invoice deleted");
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently delete ${selectedIds.size} selected invoices. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleBulkDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarkAsPaidDialog
        invoiceId={payDialogInvoice?.id ?? ""}
        invoiceNumber={payDialogInvoice?.invoiceNumber}
        remainingAmountSar={payDialogInvoice?.amountDue}
        open={!!payDialogInvoice}
        onOpenChange={(open) => !open && setPayDialogInvoice(null)}
        onSuccess={() => router.refresh()}
      />

      <button
        type="button"
        className="fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg md:hidden"
        aria-label="New invoice"
        onClick={() => setNewInvoiceOpen(true)}
      >
        +
      </button>
    </div>
  );
}
