"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import type { ProjectMemberRow } from "@/actions/team";
import type { ExpenseRow } from "@/actions/expenses";
import { cn, formatAmount, formatDate } from "@/lib/utils";

const PROJECT_STATUS_PILL_CLASS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  lead: "bg-blue-50 text-blue-700",
  on_hold: "bg-amber-50 text-amber-700",
  review: "bg-purple-50 text-purple-700",
  cancelled: "bg-red-50 text-red-700",
};

const PROJECT_STATUS_LABELS_EN: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  on_hold: "On Hold",
  review: "Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

function sortHeader(label: string, column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => false | "asc" | "desc" }) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      className="-ml-3 h-8 justify-start px-0 font-normal hover:bg-transparent"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span className="text-left text-xs font-medium text-neutral-400">
        {label} {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
      </span>
    </Button>
  );
}

type TeamMemberDetailTabsProps = {
  memberId: string;
  projects: ProjectMemberRow[];
  expenses: ExpenseRow[];
  totalPaid: number;
};

export function TeamMemberDetailTabs({ memberId, projects, expenses, totalPaid }: TeamMemberDetailTabsProps) {
  const projectColumns = React.useMemo<ColumnDef<ProjectMemberRow>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "clientName",
        enableSorting: true,
        header: ({ column }) => sortHeader("Client", column),
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.original.clientLogoUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">
                {(row.original.clientName ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-neutral-900">{row.original.clientName ?? "—"}</span>
          </div>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        header: ({ column }) => sortHeader("Project name", column),
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.original.projectCoverImageUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">
                {(row.original.projectName ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <Link
                href={`/dashboard/projects/${row.original.projectId}`}
                className="block truncate text-left font-medium text-primary hover:underline"
              >
                {row.original.projectName}
              </Link>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "projectStatus",
        id: "projectStatus",
        enableSorting: true,
        header: ({ column }) => sortHeader("Status", column),
        cell: ({ row }) => {
          const s = row.original.projectStatus;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                PROJECT_STATUS_PILL_CLASS[s] ?? "bg-neutral-100 text-neutral-600"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {PROJECT_STATUS_LABELS_EN[s] ?? s}
            </span>
          );
        },
      },
      {
        accessorKey: "endDate",
        enableSorting: true,
        header: ({ column }) => sortHeader("Deadline", column),
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.endDate)}</span>,
      },
      {
        accessorKey: "budget",
        enableSorting: true,
        header: ({ column }) => sortHeader("Budget", column),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {formatAmount(row.original.budget)}
            <SarCurrencyIcon className="text-neutral-500" />
          </span>
        ),
      },
    ],
    []
  );

  const salaryColumns = React.useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "date",
        enableSorting: true,
        header: ({ column }) => sortHeader("Date", column),
        cell: ({ row }) => <span className="text-sm">{row.original.date}</span>,
      },
      {
        accessorKey: "title",
        enableSorting: true,
        header: ({ column }) => sortHeader("Title", column),
        cell: ({ row }) => <span className="text-sm font-medium text-neutral-900">{row.original.title}</span>,
      },
      {
        accessorKey: "amount",
        enableSorting: true,
        header: ({ column }) => sortHeader("Amount", column),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {formatAmount(row.original.amount)}
            <SarCurrencyIcon className="text-neutral-500" />
          </span>
        ),
      },
      {
        accessorKey: "notes",
        enableSorting: true,
        header: ({ column }) => sortHeader("Notes", column),
        cell: ({ row }) => (
          <span className="max-w-[240px] truncate text-sm text-neutral-600">{row.original.notes ?? "—"}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4" dir="ltr">
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="h-9 w-fit gap-1 bg-neutral-100/80 p-1">
          <TabsTrigger value="projects" className="rounded-md px-4 text-sm">
            Assigned projects
          </TabsTrigger>
          <TabsTrigger value="salary" className="rounded-md px-4 text-sm">
            Salary history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-0 space-y-4">
          {projects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-12 text-center text-sm text-neutral-500">
              No projects assigned to this member yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
              <div className="px-6 pt-4">
                <SortableDataTable<ProjectMemberRow>
                  columns={projectColumns}
                  data={projects}
                  tableId={`team-member-projects-${memberId}`}
                  getRowId={(r) => r.id}
                  uiVariant="clients"
                  enablePagination={false}
                  enableSavedViews
                  getViewStateSnapshot={() => ({ tab: "projects" })}
                  applyViewStateSnapshot={() => {
                    /* views are sort-only on this page */
                  }}
                  columnLabels={{
                    clientName: "Client",
                    projectName: "Project name",
                    projectStatus: "Status",
                    endDate: "Deadline",
                    budget: "Budget",
                  }}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="mt-0 space-y-4">
          {expenses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 py-12 text-center text-sm text-neutral-500">
              No salary payments recorded for this member.
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
                <div className="px-6 pt-4">
                  <SortableDataTable<ExpenseRow>
                    columns={salaryColumns}
                    data={expenses}
                    tableId={`team-member-salary-${memberId}`}
                    getRowId={(r) => r.id}
                    uiVariant="clients"
                    enablePagination={false}
                    enableSavedViews
                    getViewStateSnapshot={() => ({ tab: "salary" })}
                    applyViewStateSnapshot={() => {}}
                    columnLabels={{
                      date: "Date",
                      title: "Title",
                      amount: "Amount",
                      notes: "Notes",
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end border-t border-neutral-100 pt-4 text-left">
                <p className="text-sm font-semibold text-neutral-900">
                  Total paid to this member:{" "}
                  <span className="inline-flex items-center gap-1 text-primary">
                    {formatAmount(String(totalPaid))}
                    <SarCurrencyIcon className="text-primary" />
                  </span>
                </p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
