"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TASK_STATUS_LABELS, TASK_STATUS_HEADER_CLASS } from "@/types";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/actions/tasks";

const KANBAN_STATUSES = ["todo", "in_progress", "in_review", "done", "blocked"] as const;

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TasksKanbanProps = {
  tasks: TaskWithProject[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  onAddTask: (status: (typeof KANBAN_STATUSES)[number]) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

export function TasksKanban({ tasks, assigneesByTaskId, onAddTask, onOpenTask, onDeleteTask }: TasksKanbanProps) {
  const byStatus = React.useMemo(() => {
    const m: Record<string, TaskWithProject[]> = {};
    for (const s of KANBAN_STATUSES) m[s] = [];
    for (const t of tasks) {
      if (m[t.status]) m[t.status].push(t);
    }
    return m;
  }, [tasks]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ direction: "rtl" }}>
      {KANBAN_STATUSES.map((status) => (
        <Card
          key={status}
          className={cn(
            "flex min-w-[260px] max-w-[260px] shrink-0 flex-col border-2",
            TASK_STATUS_HEADER_CLASS[status] ?? ""
          )}
        >
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "todo" && "bg-blue-500",
                  status === "in_progress" && "bg-amber-500",
                  status === "in_review" && "bg-purple-500",
                  status === "done" && "bg-green-500",
                  status === "blocked" && "bg-red-500"
                )}
              />
              <span className="font-semibold">{TASK_STATUS_LABELS[status]}</span>
              <span className="text-muted-foreground text-sm">({byStatus[status].length})</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto pt-0">
            {byStatus[status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assignees={assigneesByTaskId[task.id] ?? []}
                onEdit={() => onOpenTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 justify-start gap-1"
              onClick={() => onAddTask(status)}
            >
              <Plus className="h-4 w-4" />
              إضافة مهمة
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
