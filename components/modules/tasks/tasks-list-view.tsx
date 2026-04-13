"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortableDataTable, type TableColumnFilterMeta } from "@/components/ui/sortable-data-table";
import {
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS_EN,
  TASK_PRIORITY_BADGE_CLASS,
} from "@/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type { TaskWithProject } from "@/actions/tasks";
import { EntityTableShell } from "@/components/ui/entity-table-shell";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { ProjectSelectThumb, type ProjectPickerOption } from "@/components/entity-select-option";

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  try {
    return new Date(dueDate) < new Date(new Date().toDateString());
  } catch {
    return false;
  }
}

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export type TaskTableRow = TaskWithProject & { assigneeSortKey: string };

type ProjectFilterOption = ProjectPickerOption;

type TasksListViewProps = {
  tasks: TaskWithProject[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  /** Used for project column filter (id → label). */
  projectOptions: ProjectFilterOption[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

const ALL = "__all__";

function titleFilterMeta(): TableColumnFilterMeta {
  return { variant: "text", placeholder: "Search by task name" };
}

export function TasksListView({
  tasks,
  assigneesByTaskId,
  projectOptions,
  onOpenTask,
  onDeleteTask,
}: TasksListViewProps) {
  const rows: TaskTableRow[] = React.useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        assigneeSortKey: (assigneesByTaskId[t.id] ?? [])
          .map((a) => a.name)
          .join(", ")
          .toLowerCase(),
      })),
    [tasks, assigneesByTaskId]
  );

  const statusFilterOptions = React.useMemo(
    () =>
      (["todo", "in_progress", "in_review", "done", "blocked"] as const).map((s) => ({
        value: s,
        label: TASK_STATUS_LABELS_EN[s] ?? s,
      })),
    []
  );

  const priorityFilterOptions = React.useMemo(
    () =>
      (["low", "medium", "high", "urgent"] as const).map((p) => ({
        value: p,
        label: TASK_PRIORITY_LABELS_EN[p] ?? p,
      })),
    []
  );

  const projectFilterMeta = React.useMemo((): TableColumnFilterMeta => {
    return {
      variant: "select",
      options: projectOptions.map((p) => ({ value: p.id, label: p.name })),
      allValue: ALL,
      allLabel: "All projects",
    };
  }, [projectOptions]);

  const assigneeFilterMeta = React.useMemo((): TableColumnFilterMeta => {
    return { variant: "text", placeholder: "Assignees" };
  }, []);

  const taskTableColumns = React.useMemo<ColumnDef<TaskTableRow>[]>(
    () => [
      {
        id: "drag",
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        size: 32,
      },
      {
        accessorKey: "title",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || String(filterValue).trim() === "") return true;
          const title = String(row.original.title ?? "").toLowerCase();
          return title.includes(String(filterValue).toLowerCase());
        },
        meta: { columnFilter: titleFilterMeta() },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Task {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="block text-start font-medium underline hover:no-underline"
            onClick={() => onOpenTask(row.original.id)}
          >
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.projectId === filterValue;
        },
        meta: { columnFilter: projectFilterMeta },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Project {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/dashboard/projects/${row.original.projectId}`}
            className="text-muted-foreground inline-flex min-w-0 max-w-full items-center gap-2 text-sm underline hover:text-foreground"
          >
            <ProjectSelectThumb
              coverImageUrl={row.original.projectCoverImageUrl}
              clientLogoUrl={row.original.projectClientLogoUrl}
              fallbackName={row.original.projectName}
              className="h-6 w-6"
            />
            <span className="truncate">{row.original.projectName}</span>
          </Link>
        ),
      },
      {
        accessorKey: "priority",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.priority === filterValue;
        },
        meta: {
          columnFilter: {
            variant: "select",
            options: priorityFilterOptions,
            allValue: ALL,
            allLabel: "All priorities",
          },
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Priority {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={cn("text-xs", TASK_PRIORITY_BADGE_CLASS[row.original.priority] ?? "")}
          >
            {TASK_PRIORITY_LABELS_EN[row.original.priority] ?? row.original.priority}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.status === filterValue;
        },
        meta: {
          columnFilter: {
            variant: "select",
            options: statusFilterOptions,
            allValue: ALL,
            allLabel: "All statuses",
          },
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Status {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{TASK_STATUS_LABELS_EN[row.original.status] ?? row.original.status}</span>
        ),
      },
      {
        accessorKey: "dueDate",
        enableSorting: true,
        enableHiding: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.dueDate;
          const b = rowB.original.dueDate;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Due Date{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate);
          return (
            <span className={cn("text-sm", overdue && "font-medium text-red-600")}>
              {formatDate(row.original.dueDate)}
              {overdue && " (overdue)"}
            </span>
          );
        },
      },
      {
        accessorKey: "assigneeSortKey",
        id: "assignees",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || String(filterValue).trim() === "") return true;
          return row.original.assigneeSortKey.includes(String(filterValue).toLowerCase());
        },
        meta: { columnFilter: assigneeFilterMeta },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              Assignees {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const members = (assigneesByTaskId[row.original.id] ?? []).map((a) => ({
            id: a.userId,
            name: a.name,
            avatarUrl: a.avatarUrl,
          }));
          return (
            <AvatarStack members={members} max={3} direction="ltr" className="justify-start" />
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-start">
              <DropdownMenuItem onClick={() => onOpenTask(row.original.id)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteTask(row.original.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      onOpenTask,
      onDeleteTask,
      assigneesByTaskId,
      projectFilterMeta,
      priorityFilterOptions,
      statusFilterOptions,
      assigneeFilterMeta,
    ]
  );

  return (
    <EntityTableShell
      title=""
      dir="ltr"
      mobileContent={
        <div className="space-y-2 md:hidden">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate);
            return (
              <div key={task.id} className="flex items-center justify-between rounded-xl border p-4">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="block text-start font-medium hover:underline"
                    onClick={() => onOpenTask(task.id)}
                  >
                    {task.title}
                  </button>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
                    <ProjectSelectThumb
                      coverImageUrl={task.projectCoverImageUrl}
                      clientLogoUrl={task.projectClientLogoUrl}
                      fallbackName={task.projectName}
                      className="h-6 w-6"
                    />
                    <span className="truncate">{task.projectName}</span>
                  </p>
                  <p className={cn("mt-0.5 text-sm", overdue && "font-medium text-red-600")}>
                    {formatDate(task.dueDate)}
                    {overdue && " (overdue)"}
                  </p>
                  <div className="mt-1.5">
                    <AvatarStack
                      members={(assigneesByTaskId[task.id] ?? []).map((a) => ({
                        id: a.userId,
                        name: a.name,
                        avatarUrl: a.avatarUrl,
                      }))}
                      max={3}
                      direction="ltr"
                      className="justify-start"
                    />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "")}
                  >
                    {TASK_PRIORITY_LABELS_EN[task.priority] ?? task.priority}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-start">
                      <DropdownMenuItem onClick={() => onOpenTask(task.id)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      }
      tableContent={
        <div className="hidden p-4 md:block">
          <SortableDataTable<TaskTableRow>
            columns={taskTableColumns}
            data={rows}
            tableId="tasks-table"
            getRowId={(t) => t.id}
            columnLabels={{
              title: "Task",
              projectName: "Project",
              priority: "Priority",
              status: "Status",
              dueDate: "Due Date",
              assignees: "Assignees",
            }}
            uiVariant="clients"
            emptyStateMessage="No tasks found."
            enablePagination
            pageSizeOptions={[10, 25, 50]}
            enableColumnFilterRow
            enableColumnVisibilityControl
            persistColumnVisibility
            enableSavedViews
          />
        </div>
      }
    />
  );
}
