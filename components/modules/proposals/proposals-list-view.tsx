"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { deleteProposal } from "@/actions/proposals";
import { NewProposalDialog } from "./new-proposal-dialog";
import { EditProposalDialog } from "./edit-proposal-dialog";
import { ConvertToClientDialog } from "./convert-to-client-dialog";
import { ProposalStatusBadge } from "./proposal-status-badge";
import { ProposalsWinRateChart } from "./proposals-win-rate-chart";
import { ProposalsStatusDonut } from "./proposals-status-donut";
import { toast } from "sonner";
import { formatBudgetSAR, formatDate } from "@/lib/utils";
import { CirclePlus, MoreHorizontal, Pencil, UserPlus, Trash2 } from "lucide-react";

type ProposalRow = {
  id: string;
  title: string;
  url: string | null;
  platform: string;
  budgetMin: string | null;
  budgetMax: string | null;
  currency: string;
  category: string | null;
  description: string | null;
  myBid: string | null;
  status: string;
  appliedAt: string;
  notes: string | null;
  clientId: string | null;
  projectId: string | null;
  createdAt: Date | string;
};

type Stats = {
  total: number;
  won: number;
  wonPercent: number;
  pending: number;
  totalWonValue: number;
};

type ChartData = {
  byMonth: { monthKey: string; monthLabel: string; won: number; total: number; ratio: number }[];
  statusDistribution: { status: string; count: number }[];
};

const STATUS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "applied", label: "مُقدَّم" },
  { value: "viewed", label: "تمت المشاهدة" },
  { value: "shortlisted", label: "في القائمة المختصرة" },
  { value: "won", label: "تم الفوز" },
  { value: "lost", label: "لم يُكسب" },
  { value: "cancelled", label: "ملغي" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "this_month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "this_year", label: "هذه السنة" },
];

function formatBudgetRange(min: string | null, max: string | null): string {
  if (min != null && min !== "" && max != null && max !== "") {
    return `${formatBudgetSAR(min)} - ${formatBudgetSAR(max)}`;
  }
  if (min != null && min !== "") return formatBudgetSAR(min);
  if (max != null && max !== "") return formatBudgetSAR(max);
  return "—";
}

type ProposalsListViewProps = {
  proposals: ProposalRow[];
  stats: Stats;
  chartData: ChartData;
};

export function ProposalsListView({
  proposals,
  stats,
  chartData,
}: ProposalsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [proposalToDelete, setProposalToDelete] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [proposalToEdit, setProposalToEdit] = React.useState<ProposalRow | null>(null);
  const [convertProposal, setConvertProposal] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);

  const proposalTableColumns = React.useMemo<ColumnDef<ProposalRow>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "title",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">العنوان {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) =>
          row.original.url ? (
            <a href={row.original.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" dir="ltr">
              {row.original.title}
            </a>
          ) : (
            <span className="font-medium">{row.original.title}</span>
          ),
      },
      {
        accessorKey: "category",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الفئة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) =>
          row.original.category ? (
            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs">{row.original.category}</span>
          ) : (
            "—"
          ),
      },
      {
        id: "budget",
        enableSorting: false,
        header: () => <span className="text-right">الميزانية</span>,
        cell: ({ row }) => formatBudgetRange(row.original.budgetMin, row.original.budgetMax),
      },
      {
        accessorKey: "myBid",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">عرضي {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatBudgetSAR(row.original.myBid),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الحالة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <ProposalStatusBadge
            proposalId={row.original.id}
            status={row.original.status}
            onStatusChange={() => router.refresh()}
          />
        ),
      },
      {
        accessorKey: "appliedAt",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">تاريخ التقديم {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.appliedAt),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setProposalToEdit({ ...p, appliedAt: p.appliedAt })}>
                  <Pencil className="me-2 h-4 w-4" />تعديل
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConvertProposal({ id: p.id, title: p.title })}>
                  <UserPlus className="me-2 h-4 w-4" />تحويل لعميل
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setProposalToDelete({ id: p.id, title: p.title })}
                >
                  <Trash2 className="me-2 h-4 w-4" />حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router]
  );

  const statusParam = searchParams.get("status") ?? "all";
  const dateRangeParam = searchParams.get("dateRange") ?? "all";
  const searchParam = searchParams.get("search") ?? "";

  const updateParams = React.useCallback(
    (updates: { status?: string; dateRange?: string; search?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined)
        updates.status && updates.status !== "all"
          ? next.set("status", updates.status)
          : next.delete("status");
      if (updates.dateRange !== undefined)
        updates.dateRange && updates.dateRange !== "all"
          ? next.set("dateRange", updates.dateRange)
          : next.delete("dateRange");
      if (updates.search !== undefined)
        updates.search ? next.set("search", updates.search) : next.delete("search");
      router.push(`/dashboard/proposals?${next.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("search") as HTMLInputElement)?.value?.trim() ?? "";
    updateParams({ search: q || undefined });
  };

  const totalWonFormatted = `${Number(stats.totalWonValue).toLocaleString("ar-SA")} ر.س`;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">العروض المقدمة</h1>
        <NewProposalDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          onSuccess={() => router.refresh()}
          trigger={
            <Button variant="secondary" className="w-full sm:w-auto">
              <CirclePlus className="me-2 h-4 w-4" />
              إضافة عرض
            </Button>
          }
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العروض</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تم الفوز</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.won} · %{stats.wonPercent}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي قيمة المشاريع المكسوبة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWonFormatted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:flex-wrap sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            name="search"
            placeholder="البحث بالعنوان..."
            defaultValue={searchParam}
            className="w-40 sm:w-48"
          />
          <Button type="submit" variant="secondary" size="sm">
            بحث
          </Button>
        </form>
        <Select
          value={statusParam}
          onValueChange={(v) => updateParams({ status: v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={dateRangeParam}
          onValueChange={(v) => updateParams({ dateRange: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <SortableDataTable<ProposalRow>
            columns={proposalTableColumns}
            data={proposals}
            tableId="proposals-table"
            getRowId={(p) => p.id}
            columnLabels={{
              title: "العنوان",
              category: "الفئة",
              myBid: "عرضي",
              status: "الحالة",
              appliedAt: "تاريخ التقديم",
            }}
            enablePagination={false}
          />
        </CardContent>
      </Card>

      {/* Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نسبة الفوز شهرياً</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalsWinRateChart data={chartData.byMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع العروض حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalsStatusDonut data={chartData.statusDistribution} />
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!proposalToDelete}
        onOpenChange={(open) => !open && setProposalToDelete(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {proposalToDelete
                ? `سيتم حذف العرض "${proposalToDelete.title}" نهائياً.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!proposalToDelete) return;
                const id = proposalToDelete.id;
                setProposalToDelete(null);
                const res = await deleteProposal(id);
                if (res.ok) {
                  toast.success("تم حذف العرض");
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditProposalDialog
        proposal={proposalToEdit}
        open={!!proposalToEdit}
        onOpenChange={(open) => !open && setProposalToEdit(null)}
        onSuccess={() => router.refresh()}
      />

      <ConvertToClientDialog
        proposalId={convertProposal?.id ?? null}
        proposalTitle={convertProposal?.title ?? ""}
        open={!!convertProposal}
        onOpenChange={(open) => !open && setConvertProposal(null)}
      />
    </div>
  );
}
