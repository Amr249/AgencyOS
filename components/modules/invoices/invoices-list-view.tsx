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
import { deleteInvoice, deleteInvoices } from "@/actions/invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { MarkAsPaidDialog } from "./mark-as-paid-dialog";
import { toast } from "sonner";
import { cn, formatAmount, formatDate as formatDateDDMMYYYY } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId: string | null;
  status: string;
  issueDate: string;
  paidAt: Date | string | null;
  total: string;
  currency: string;
  clientName: string | null;
  clientLogoUrl: string | null;
  projectName: string | null;
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
  { value: "paid", label: "Paid" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
];

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
                {inv.status === "pending" && (
                  <>
                    <DropdownMenuItem onSelect={() => setPayDialogInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}>Mark as paid</DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/invoices/${inv.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                  </>
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
              <PlusCircledIcon className="me-2 h-4 w-4" />
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
        <Card className="border-[#e5e5e5] bg-[#ededed] text-black">
          <CardHeader className="pb-2">
            <CardTitle className="text-left text-sm font-bold text-black">
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold text-black">
              <AmountWithSarIcon
                value={String(stats.outstanding)}
                className="text-black"
                iconClassName="text-black"
              />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid w-full gap-1 sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground">Start date</span>
            <DatePickerAr
              className="w-full sm:w-[160px]"
              direction="ltr"
              locale={enUS}
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
              direction="ltr"
              locale={enUS}
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
                <p className="text-sm">{inv.clientName ?? "—"}</p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/invoices/${inv.id}`}>View</Link>
                  </Button>
                  {inv.status === "pending" && (
                    <Button variant="outline" size="sm" onClick={() => setPayDialogInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}>
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
              status: "Status",
              issueDate: "Issue date",
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
