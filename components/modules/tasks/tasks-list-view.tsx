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
import { Badge } from "@/components/ui/badge";
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
  return (
    <div className="rounded-md border">
      <table className="w-full text-right">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 font-medium">المهمة</th>
            <th className="p-3 font-medium">المشروع</th>
            <th className="p-3 font-medium">الأولوية</th>
            <th className="p-3 font-medium">الحالة</th>
            <th className="p-3 font-medium">تاريخ الاستحقاق</th>
            <th className="w-12 p-3 font-medium">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate);
            return (
              <tr
                key={task.id}
                className="border-b transition-colors hover:bg-muted/30"
              >
                <td className="p-3">
                  <button
                    type="button"
                    className="font-medium underline hover:no-underline"
                    onClick={() => onOpenTask(task.id)}
                  >
                    {task.title}
                  </button>
                </td>
                <td className="p-3">
                  <Link
                    href={`/dashboard/projects/${task.projectId}`}
                    className="text-muted-foreground text-sm underline hover:text-foreground"
                  >
                    {task.projectName}
                  </Link>
                </td>
                <td className="p-3">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      TASK_PRIORITY_BADGE_CLASS[task.priority] ?? ""
                    )}
                  >
                    {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                  </Badge>
                </td>
                <td className="p-3">
                  <span className="text-sm">{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
                </td>
                <td className={cn("p-3 text-sm", overdue && "text-red-600 font-medium")}>
                  {formatDate(task.dueDate)}
                  {overdue && " (متأخر)"}
                </td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenTask(task.id)}>
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">لا توجد مهام.</div>
      )}
    </div>
  );
}
