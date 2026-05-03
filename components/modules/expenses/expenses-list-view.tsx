"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  deleteExpense,
  deleteExpenses,
  getExpensesExportData,
  type ExpenseRow,
  type ExpenseCategory,
  type ExpenseExportRow,
} from "@/actions/expenses";
import { Badge } from "@/components/ui/badge";
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
import { ExpenseCategoryBadge } from "./expense-category-badge";
import { NewExpenseDialog, type ExpenseDialogClient, type ExpenseDialogProject, type ExpenseDialogService } from "./new-expense-dialog";
import { formatAmount } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ChevronDown, Download, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { stringifyCsv, triggerTextDownload, type CsvColumn } from "@/lib/export-tabular";
import { ClientSelectOptionRow, ProjectSelectOptionRow } from "@/components/entity-select-option";

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

type TeamMemberOption = { id: string; name: string; role: string | null; avatarUrl?: string | null };

type ExpensesListViewProps = {
  initialExpenses: ExpenseRow[];
  summary: Summary;
  teamMembers?: TeamMemberOption[];
  projects?: ExpenseDialogProject[];
  clients?: ExpenseDialogClient[];
  services?: ExpenseDialogService[];
};

function formatDateDDMMYYYY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function avatarInitial(name: string | null | undefined): string {
  const t = (name ?? "?").trim();
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

function buildExpenseExportFilters(
  categoryParam: string,
  dateFromParam: string,
  dateToParam: string,
  projectIdParam: string,
  clientIdParam: string
): {
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  clientId?: string;
} {
  const filters: {
    category?: ExpenseCategory;
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
    clientId?: string;
  } = {};
  if (categoryParam && categoryValues.includes(categoryParam as ExpenseCategory)) {
    filters.category = categoryParam as ExpenseCategory;
  }
  if (dateFromParam) filters.dateFrom = dateFromParam;
  if (dateToParam) filters.dateTo = dateToParam;
  if (projectIdParam && /^[0-9a-f-]{36}$/i.test(projectIdParam)) filters.projectId = projectIdParam;
  if (clientIdParam && /^[0-9a-f-]{36}$/i.test(clientIdParam)) filters.clientId = clientIdParam;
  return filters;
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

export function ExpensesListView({
  initialExpenses,
  summary,
  teamMembers = [],
  projects = [],
  clients = [],
  services = [],
}: ExpensesListViewProps) {
  const t = useTranslations("expenses");
  const tCategories = useTranslations("expenses.categories");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const expenseCsvColumns = React.useMemo(
    (): CsvColumn<ExpenseExportRow>[] => [
      { key: "title", header: t("csvTitle") },
      { key: "amount", header: t("csvAmount") },
      { key: "category", header: t("csvCategory") },
      { key: "date", header: t("csvDate") },
      { key: "projectName", header: t("csvProject") },
      { key: "clientName", header: t("csvClient") },
      { key: "teamMemberName", header: t("csvTeamMember") },
      { key: "isBillable", header: t("csvBillable") },
      { key: "notes", header: t("csvNotes") },
    ],
    [t]
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const projectIdParam = searchParams.get("projectId") ?? "";
  const clientIdParam = searchParams.get("clientId") ?? "";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editExpense, setEditExpense] = React.useState<ExpenseRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [expenses, setExpenses] = React.useState<ExpenseRow[]>(initialExpenses);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = React.useState(false);
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
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set("category", category);
    else params.delete("category");
    if (dateFrom) params.set("dateFrom", dateFrom);
    else params.delete("dateFrom");
    if (dateTo) params.set("dateTo", dateTo);
    else params.delete("dateTo");
    const qs = params.toString();
    router.push(qs ? `/dashboard/expenses?${qs}` : "/dashboard/expenses");
  }

  function handleProjectFilterChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("projectId");
    else params.set("projectId", value);
    const qs = params.toString();
    router.push(qs ? `/dashboard/expenses?${qs}` : "/dashboard/expenses");
  }

  function handleClientFilterChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("clientId");
    else params.set("clientId", value);
    const qs = params.toString();
    router.push(qs ? `/dashboard/expenses?${qs}` : "/dashboard/expenses");
  }

  const hasActiveFilters =
    Boolean(categoryParam) ||
    Boolean(dateFromParam) ||
    Boolean(dateToParam) ||
    Boolean(projectIdParam) ||
    Boolean(clientIdParam);

  function handleSuccess() {
    router.refresh();
  }

  const exportFilenameDate = format(new Date(), "yyyy-MM-dd");

  async function runExportCsv() {
    setExporting(true);
    try {
      const result = await getExpensesExportData(
        buildExpenseExportFilters(
          categoryParam,
          dateFromParam,
          dateToParam,
          projectIdParam,
          clientIdParam
        )
      );
      if (!result.ok) {
        toast.error(t("toastExportFail"));
        return;
      }
      const csv = stringifyCsv(result.data, expenseCsvColumns);
      triggerTextDownload(csv, `expenses-${exportFilenameDate}.csv`);
      toast.success(t("toastCsvOk"));
    } finally {
      setExporting(false);
    }
  }

  async function runExportExcel() {
    setExporting(true);
    try {
      const result = await getExpensesExportData(
        buildExpenseExportFilters(
          categoryParam,
          dateFromParam,
          dateToParam,
          projectIdParam,
          clientIdParam
        )
      );
      if (!result.ok) {
        toast.error(t("toastExportFail"));
        return;
      }
      const XLSX = await import("xlsx");
      const sheetRows = result.data.map((r) => ({
        [t("csvTitle")]: r.title,
        [t("csvAmount")]: r.amount,
        [t("csvCategory")]: r.category,
        [t("csvDate")]: r.date,
        [t("csvProject")]: r.projectName,
        [t("csvClient")]: r.clientName,
        [t("csvTeamMember")]: r.teamMemberName,
        [t("csvBillable")]: r.isBillable,
        [t("csvNotes")]: r.notes,
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t("sheetName"));
      XLSX.writeFile(wb, `expenses-${exportFilenameDate}.xlsx`);
      toast.success(t("toastExcelOk"));
    } catch {
      toast.error(t("toastExcelFail"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteExpense(id);
    if (res.ok) {
      toast.success(t("toastDeleted"));
      setDeleteId(null);
      router.refresh();
    } else {
      toast.error(res.error ?? t("toastDeleteFail"));
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
      toast.success(t("toastBulkDeleted"));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? t("toastBulkFail"));
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
            aria-label={t("selectAllRows")}
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
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnTitle")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <div>
            <Link
              href={`/dashboard/expenses/${row.original.id}`}
              className="font-medium text-neutral-900 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.title}
            </Link>
            {row.original.category === "salaries" && row.original.teamMemberName ? (
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={row.original.teamMemberAvatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {avatarInitial(row.original.teamMemberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{row.original.teamMemberName}</span>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Project {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => {
          const projectId = row.original.projectId;
          const projectName = row.original.projectName;
          if (projectId && projectName) {
            const projectImageSrc =
              row.original.projectCoverUrl ??
              row.original.projectClientLogoUrl ??
              row.original.clientLogoUrl ??
              undefined;
            return (
              <div className="flex min-w-0 max-w-[220px] items-center gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={projectImageSrc} alt="" />
                  <AvatarFallback className="text-xs">{avatarInitial(projectName)}</AvatarFallback>
                </Avatar>
                <Link
                  href={`/dashboard/projects/${projectId}`}
                  className="truncate font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {projectName}
                </Link>
              </div>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "clientName",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnClient")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const clientId = row.original.clientId;
          const clientName = row.original.clientName;
          if (clientId && clientName) {
            return (
              <div className="flex min-w-0 max-w-[220px] items-center gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={row.original.clientLogoUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-xs">{avatarInitial(clientName)}</AvatarFallback>
                </Avatar>
                <Link
                  href={`/dashboard/clients/${clientId}`}
                  className="truncate font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {clientName}
                </Link>
              </div>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "category",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnCategory")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => <ExpenseCategoryBadge category={row.original.category} />,
      },
      {
        accessorKey: "amount",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnAmount")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => <AmountWithSarIcon value={row.original.amount} />,
      },
      {
        accessorKey: "isBillable",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnBillable")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) =>
          row.original.isBillable ? (
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              {t("billableYes")}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "date",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnDate")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => formatDateDDMMYYYY(row.original.date),
      },
      {
        accessorKey: "notes",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-end justify-start gap-1 rtl:flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {t("columnNotes")}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-start text-muted-foreground">{row.original.notes ?? "—"}</span>
        ),
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
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/expenses/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
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
    [allVisibleSelected, selectedIds, t]
  );

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/expenses/recurring" className="inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0" />
              {t("recurring")}
            </Link>
          </Button>
          <Button onClick={openNew}>{t("newExpense")}</Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-start">{t("summaryMonth")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(summary.totalThisMonth)} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-start">{t("summaryYear")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <p className="text-2xl font-bold">
              <AmountWithSarIcon value={String(summary.totalThisYear)} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-start">{t("topCategory")}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <p className="text-2xl font-bold">
              {summary.topCategory ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>{tCategories(summary.topCategory.category)} —</span>
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
            <SelectValue placeholder={t("categoryFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categoryValues.map((c) => (
              <SelectItem key={c} value={c}>
                {tCategories(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectIdParam || "all"} onValueChange={handleProjectFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allProjects")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allProjects")}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id} textValue={project.name}>
                <ProjectSelectOptionRow
                  coverImageUrl={project.coverImageUrl}
                  clientLogoUrl={project.clientLogoUrl}
                  name={project.name}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientIdParam || "all"} onValueChange={handleClientFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allClients")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allClients")}</SelectItem>
            {clients.map((client) => {
              const label = client.companyName?.trim() ? client.companyName : t("unnamedClient");
              return (
                <SelectItem key={client.id} value={client.id} textValue={label}>
                  <ClientSelectOptionRow logoUrl={client.logoUrl} label={label} />
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <DatePickerAr
          placeholder={t("fromDate")}
          className="w-[160px]"
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
          placeholder={t("toDate")}
          className="w-[160px]"
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
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/expenses")}>
            {t("clearFilters")}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={exporting} className="gap-1">
              <Download className="h-4 w-4" />
              {t("export")}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void runExportCsv()}>{t("exportCsv")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExportExcel()}>{t("exportExcel")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
        <CardContent className="pt-4">
          <SortableDataTable<ExpenseRow>
            columns={expenseTableColumns}
            data={expenses}
            tableId="expenses-table"
            getRowId={(r) => r.id}
            uiVariant="clients"
            columnLabels={{
              title: t("columnTitle"),
              projectName: t("columnProject"),
              clientName: t("columnClient"),
              category: t("columnCategory"),
              amount: t("columnAmount"),
              isBillable: t("columnBillable"),
              date: t("columnDate"),
              notes: t("columnNotes"),
            }}
            enablePagination={false}
          />
        </CardContent>
      </div>

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        expense={editExpense}
        teamMembers={teamMembers}
        projects={projects}
        clients={clients}
        services={services}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "flex-row-reverse sm:flex-row-reverse" : undefined}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bulkDeleteDescription", { count: selectedIds.size })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "flex-row-reverse sm:flex-row-reverse" : undefined}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleBulkDelete();
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
