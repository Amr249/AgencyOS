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
import { ProposalsStatusChart } from "./proposals-status-donut";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { SarMoney } from "@/components/ui/sar-money";
import { MoreHorizontal, Pencil, UserPlus, Trash2 } from "lucide-react";

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
  skillsTags: string | null;
  services: { id: string; name: string }[];
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
  { value: "all", label: "All" },
  { value: "applied", label: "Applied" },
  { value: "viewed", label: "Viewed" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
];

function BudgetRangeDisplay({
  min,
  max,
  currency,
}: {
  min: string | null;
  max: string | null;
  currency: string;
}) {
  const c = currency === "USD" ? "USD" : "SAR";
  if (min != null && min !== "" && max != null && max !== "") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <SarMoney value={min} iconClassName="h-3 w-3" currency={c} />
        <span>–</span>
        <SarMoney value={max} iconClassName="h-3 w-3" currency={c} />
      </span>
    );
  }
  if (min != null && min !== "") return <SarMoney value={min} iconClassName="h-3 w-3" currency={c} />;
  if (max != null && max !== "") return <SarMoney value={max} iconClassName="h-3 w-3" currency={c} />;
  return "—";
}

type ProposalsListViewProps = {
  proposals: ProposalRow[];
  stats: Stats;
  chartData: ChartData;
  serviceOptions: { id: string; name: string }[];
};

export function ProposalsListView({
  proposals,
  stats,
  chartData,
  serviceOptions,
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
          <Button variant="ghost" className="-ms-3 flex w-full items-center justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Title {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
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
        id: "services",
        accessorFn: (row) =>
          row.services.length > 0
            ? row.services.map((s) => s.name).sort().join(", ")
            : row.category ?? "",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full items-center justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Services {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => {
          const svcs = row.original.services;
          if (svcs.length > 0) {
            return (
              <span className="flex flex-wrap gap-1">
                {svcs.map((s) => (
                  <span key={s.id} className="rounded-full border bg-muted px-2 py-0.5 text-xs">
                    {s.name}
                  </span>
                ))}
              </span>
            );
          }
          if (row.original.category) {
            return (
              <span className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs">
                {row.original.category}
              </span>
            );
          }
          return "—";
        },
      },
      {
        id: "budget",
        enableSorting: false,
        meta: {
          headerClassName: "min-w-[210px]",
          cellClassName: "min-w-[210px]",
        },
        header: () => <span className="text-left">Budget</span>,
        cell: ({ row }) => (
          <BudgetRangeDisplay
            min={row.original.budgetMin}
            max={row.original.budgetMax}
            currency={row.original.currency}
          />
        ),
      },
      {
        accessorKey: "myBid",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full items-center justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">My bid {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <SarMoney
            value={row.original.myBid}
            iconClassName="h-3 w-3"
            currency={row.original.currency === "USD" ? "USD" : "SAR"}
          />
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full items-center justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Status {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
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
          <Button variant="ghost" className="-ms-3 flex w-full items-center justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Applied {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
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
                  <Pencil className="me-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConvertProposal({ id: p.id, title: p.title })}>
                  <UserPlus className="me-2 h-4 w-4" />
                  Convert to client
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setProposalToDelete({ id: p.id, title: p.title })}
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  Delete
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

  return (
    <div className="space-y-6" dir="ltr">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-neutral-900">Proposals</h1>
        <NewProposalDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          onSuccess={() => router.refresh()}
          serviceOptions={serviceOptions}
          trigger={
            <button
              type="button"
              className="hidden items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 sm:inline-flex"
            >
              + New proposal
            </button>
          }
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-100 bg-[rgba(164,254,25,1)] p-4 text-left">
          <p className="mb-1 text-xs font-semibold text-black">Total proposals</p>
          <p className="text-2xl font-bold text-black">{stats.total}</p>
          <p className="mt-1 text-xs text-black">All submitted proposals</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">Win rate</p>
          <p className="text-2xl font-bold text-black">{stats.won} · {stats.wonPercent}%</p>
          <p className="mt-1 text-xs text-neutral-400">Won proposals</p>
        </div>
        <div className="rounded-xl border border-black bg-black p-4 text-left">
          <p className="mb-1 text-xs font-semibold text-white">Pending</p>
          <p className="text-2xl font-semibold text-white">{stats.pending}</p>
          <p className="mt-1 text-xs text-white">Awaiting response</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">Total won value</p>
          <p className="text-2xl font-medium text-neutral-900">
            <SarMoney value={String(stats.totalWonValue)} iconClassName="h-5 w-5" />
          </p>
          <p className="mt-1 text-xs text-neutral-400">Revenue from won proposals</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            name="search"
            placeholder="Search by title…"
            defaultValue={searchParam}
            className="w-40 sm:w-48"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
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
            uiVariant="clients"
            columnLabels={{
              title: "Title",
              services: "Services",
              myBid: "My bid",
              status: "Status",
              appliedAt: "Applied",
            }}
            enablePagination={false}
          />
        </CardContent>
      </Card>

      {/* Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly win rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalsWinRateChart data={chartData.byMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposals by status</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalsStatusChart data={chartData.statusDistribution} />
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!proposalToDelete}
        onOpenChange={(open) => !open && setProposalToDelete(null)}
      >
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              {proposalToDelete
                ? `This will permanently delete "${proposalToDelete.title}".`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!proposalToDelete) return;
                const id = proposalToDelete.id;
                setProposalToDelete(null);
                const res = await deleteProposal(id);
                if (res.ok) {
                  toast.success("Proposal deleted");
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

      <EditProposalDialog
        proposal={proposalToEdit}
        open={!!proposalToEdit}
        onOpenChange={(open) => !open && setProposalToEdit(null)}
        onSuccess={() => router.refresh()}
        serviceOptions={serviceOptions}
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
