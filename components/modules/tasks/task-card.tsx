"use client";

import * as React from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_CLASS } from "@/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type { TaskWithProject } from "@/actions/tasks";

function formatDate(d: string | null) {
  if (!d) return null;
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

type TaskCardProps = {
  task: TaskWithProject;
  onEdit: () => void;
  onDelete: () => void;
};

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate);
  const dueStr = formatDate(task.dueDate);
  const subtaskCount = task.subtaskCount ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/50"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <p className="font-semibold leading-tight">{task.title}</p>
      <Link
        href={`/dashboard/projects/${task.projectId}`}
        className="text-muted-foreground mt-1 block text-xs underline hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {task.projectName}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-xs",
            TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "bg-muted"
          )}
        >
          {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
        {dueStr && (
          <span className={cn("text-xs", overdue && "text-red-600 font-medium")}>
            {dueStr}
            {overdue && " (متأخر)"}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="text-muted-foreground text-xs">
            {subtaskCount} مهام فرعية
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={(e) => (e.stopPropagation(), onEdit())}>
            تعديل
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => (e.stopPropagation(), onDelete())}
          >
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
