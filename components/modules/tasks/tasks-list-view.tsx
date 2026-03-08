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
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_CLASS } from "@/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type { TaskWithProject } from "@/actions/tasks";

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("ar-EG", {
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

type TasksListViewProps = {
  tasks: TaskWithProject[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

export function TasksListView({ tasks, onOpenTask, onDeleteTask }: TasksListViewProps) {
  const taskTableColumns = React.useMemo<ColumnDef<TaskWithProject>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "title",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">المهمة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <button type="button" className="font-medium underline hover:no-underline text-right block" onClick={() => onOpenTask(row.original.id)}>
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">المشروع {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/dashboard/projects/${row.original.projectId}`} className="text-muted-foreground text-sm underline hover:text-foreground">
            {row.original.projectName}
          </Link>
        ),
      },
      {
        accessorKey: "priority",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الأولوية {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className={cn("text-xs", TASK_PRIORITY_BADGE_CLASS[row.original.priority] ?? "")}>
            {TASK_PRIORITY_LABELS[row.original.priority] ?? row.original.priority}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الحالة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span className="text-sm">{TASK_STATUS_LABELS[row.original.status] ?? row.original.status}</span>,
      },
      {
        accessorKey: "dueDate",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">تاريخ الاستحقاق {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate);
          return (
            <span className={cn("text-sm", overdue && "text-red-600 font-medium")}>
              {formatDate(row.original.dueDate)}
              {overdue && " (متأخر)"}
            </span>
          );
        },
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
              <DropdownMenuItem onClick={() => onOpenTask(row.original.id)}>تعديل</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteTask(row.original.id)}>حذف</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onOpenTask, onDeleteTask]
  );

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {tasks.map((task) => {
          const overdue = isOverdue(task.dueDate);
          return (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-xl border p-4"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  className="font-medium text-right block hover:underline"
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.title}
                </button>
                <p className="text-muted-foreground text-sm mt-0.5">{task.projectName}</p>
                <p className={cn("text-sm mt-0.5", overdue && "text-red-600 font-medium")}>
                  {formatDate(task.dueDate)}
                  {overdue && " (متأخر)"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className={cn("text-xs", TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "")}>
                  {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenTask(task.id)}>تعديل</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteTask(task.id)}>حذف</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden md:block rounded-md border p-4">
        <SortableDataTable<TaskWithProject>
          columns={taskTableColumns}
          data={tasks}
          tableId="tasks-table"
          getRowId={(t) => t.id}
          columnLabels={{
            title: "المهمة",
            projectName: "المشروع",
            priority: "الأولوية",
            status: "الحالة",
            dueDate: "تاريخ الاستحقاق",
          }}
          enablePagination={false}
        />
      </div>
    </>
  );
}
