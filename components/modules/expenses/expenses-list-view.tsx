"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { deleteExpense, deleteExpenses, type ExpenseRow, type ExpenseCategory } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
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
import { ExpenseCategoryBadge, CATEGORY_LABELS } from "./expense-category-badge";
import { NewExpenseDialog } from "./new-expense-dialog";
import { formatAmount } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const categoryValues: ExpenseCategory[] = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
];

type Summary = {
  totalThisMonth: number;
  totalThisYear: number;
  topCategory: { category: ExpenseCategory; total: number } | null;
};

type TeamMemberOption = { id: string; name: string; role: string | null };

type ExpensesListViewProps = {
  initialExpenses: ExpenseRow[];
  summary: Summary;
  teamMembers?: TeamMemberOption[];
};

function formatDateDDMMYYYY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function AmountWithSarIcon({ value }: { value: string | null | undefined }) {
  const formatted = formatAmount(value);
  if (formatted === "—") return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" dir="ltr">
      {formatted}
      <SarCurrencyIcon className="text-neutral-500" />
    </span>
  );
}

export function ExpensesListView({ initialExpenses, summary, teamMembers = [] }: ExpensesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editExpense, setEditExpense] = React.useState<ExpenseRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [expenses, setExpenses] = React.useState<ExpenseRow[]>(initialExpenses);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const visibleExpenseIdsKey = expenses.map((e) => e.id).join("\0");
  React.useEffect(() => {
    const visibleSet = new Set(expenses.map((e) => e.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleSet.has(id)));
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [visibleExpenseIdsKey, expenses]);

  const selectedInView = expenses.filter((e) => selectedIds.has(e.id)).length;
  const allVisibleSelected = expenses.length > 0 && selectedInView === expenses.length;

  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedInView > 0 && !allVisibleSelected;
  }, [selectedInView, allVisibleSelected, expenses.length]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) expenses.forEach((e) => next.delete(e.id));
      else expenses.forEach((e) => next.add(e.id));
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

  function handleFiltersChange(category: string, dateFrom: string, dateTo: string) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/dashboard/expenses?${params.toString()}`);
  }

  function handleSuccess() {
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await deleteExpense(id);
    if (res.ok) {
      toast.success("Expense deleted");
      setDeleteId(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to delete expense");
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    const res = await deleteExpenses(ids);
    if (res.ok) {
      toast.success("Expenses deleted");
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to delete selected expenses");
    }
  }

  const openEdit = (row: ExpenseRow) => {
    setEditExpense(row);
    setDialogOpen(true);
  };
  const openNew = () => {
    setEditExpense(null);
    setDialogOpen(true);
  };

  const expenseTableColumns = React.useMemo<ColumnDef<ExpenseRow>[]>(
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
            aria-label={row.original.title}
          />
        ),
      },
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "title",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Title {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.title}</span>
            {row.original.category === "salaries" && row.original.teamMemberName && (
              <span className="mt-1 block text-xs text-muted-foreground">👤 {row.original.teamMemberName}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "category",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Category {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <ExpenseCategoryBadge category={row.original.category} />,
      },
      {
        accessorKey: "amount",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Amount {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <AmountWithSarIcon value={row.original.amount} />,
      },
      {
        accessorKey: "date",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Date {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatDateDDMMYYYY(row.original.date),
      },
      {
        accessorKey: "notes",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Notes {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span className="block max-w-[200px] truncate text-left text-muted-foreground">{row.original.notes ?? "—"}</span>,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="me-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(row.original.id)}>
                <Trash2 className="me-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [allVisibleSelected, selectedIds]
  );

  return (
    <div className="space-y-6" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        <Button onClick={openNew}>+ New Expense</Button>
      </div>

      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Total expenses this month</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(summary.totalThisMonth)} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Total expenses this year</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(summary.totalThisYear)} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-left">Top expense category</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-2xl font-bold">
              {summary.topCategory ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>{CATEGORY_LABELS[summary.topCategory.category]} —</span>
                  <AmountWithSarIcon value={String(summary.topCategory.total)} />
                </span>
              ) : (
                "—"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={categoryParam || "all"}
          onValueChange={(v) => handleFiltersChange(v === "all" ? "" : v, dateFromParam, dateToParam)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryValues.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePickerAr
          placeholder="From date"
          className="w-[160px]"
          direction="ltr"
          locale={enUS}
          popoverAlign="start"
          value={dateFromParam ? new Date(dateFromParam + "T12:00:00") : undefined}
          onChange={(date) =>
            handleFiltersChange(
              categoryParam,
              date ? format(date, "yyyy-MM-dd") : "",
              dateToParam
            )
          }
        />
        <DatePickerAr
          placeholder="To date"
          className="w-[160px]"
          direction="ltr"
          locale={enUS}
          popoverAlign="start"
          value={dateToParam ? new Date(dateToParam + "T12:00:00") : undefined}
          onChange={(date) =>
            handleFiltersChange(
              categoryParam,
              dateFromParam,
              date ? format(date, "yyyy-MM-dd") : ""
            )
          }
        />
      </div>

      {/* Table */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
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

      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white" dir="ltr">
        <CardContent className="pt-4">
          <SortableDataTable<ExpenseRow>
            columns={expenseTableColumns}
            data={expenses}
            tableId="expenses-table"
            getRowId={(r) => r.id}
            uiVariant="clients"
            columnLabels={{
              title: "Title",
              category: "Category",
              amount: "Amount",
              date: "Date",
              notes: "Notes",
            }}
            enablePagination={false}
          />
        </CardContent>
      </div>

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editExpense={editExpense}
        teamMembers={teamMembers}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This expense will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected expenses?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently delete ${selectedIds.size} selected expenses. This action cannot be undone.`}
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
    </div>
  );
}
