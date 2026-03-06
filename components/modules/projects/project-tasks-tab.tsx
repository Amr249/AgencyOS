"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTasksByProjectId,
  createTask,
  updateTask,
} from "@/actions/tasks";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_CLASS } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { PlusIcon } from "@radix-ui/react-icons";

const KANBAN_COLUMNS: { id: "todo" | "in_progress" | "in_review" | "done" | "blocked"; label: string }[] = [
  { id: "todo", label: "قيد الانتظار" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "in_review", label: "قيد المراجعة" },
  { id: "done", label: "مكتمل" },
  { id: "blocked", label: "موقوف" },
];

type TaskRow = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
};

type ProjectTasksTabProps = {
  projectId: string;
  initialTasks: TaskRow[];
};

export function ProjectTasksTab({ projectId, initialTasks }: ProjectTasksTabProps) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [addingColumn, setAddingColumn] = React.useState<string | null>(null);
  const [newTitle, setNewTitle] = React.useState("");

  const tasksByStatus = React.useMemo(() => {
    const m: Record<string, TaskRow[]> = {};
    for (const col of KANBAN_COLUMNS) m[col.id] = [];
    for (const t of tasks) {
      if (m[t.status]) m[t.status].push(t);
    }
    return m;
  }, [tasks]);

  const handleAddTask = async (status: string) => {
    const title = newTitle.trim();
    if (!title) return;
    const result = await createTask({
      projectId,
      title,
      status: status as "todo" | "in_progress" | "in_review" | "done" | "blocked",
      priority: "medium",
    });
    if (result.ok) {
      setTasks((prev) => [...prev, result.data]);
      setNewTitle("");
      setAddingColumn(null);
      router.refresh();
    }
  };

  const handleMoveTask = async (taskId: string, newStatus: string) => {
    const result = await updateTask({ id: taskId, status: newStatus as "todo" | "in_progress" | "in_review" | "done" | "blocked" });
    if (result.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      router.refresh();
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => (
        <Card key={col.id} className="min-w-[260px] flex-1 shrink-0">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <h3 className="font-semibold">{col.label}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setAddingColumn(addingColumn === col.id ? null : col.id)}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {addingColumn === col.id && (
              <div className="flex gap-2">
                <input
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="عنوان المهمة"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTask(col.id);
                    if (e.key === "Escape") setAddingColumn(null);
                  }}
                />
                <Button size="sm" onClick={() => handleAddTask(col.id)}>
                  إضافة
                </Button>
              </div>
            )}
            {tasksByStatus[col.id]?.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <p className="font-medium leading-tight">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-xs",
                      TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "bg-muted"
                    )}
                  >
                    {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    استحقاق {formatDate(task.dueDate)}
                  </span>
                </div>
                <Select
                  value={task.status}
                  onValueChange={(v) => handleMoveTask(task.id, v)}
                >
                  <SelectTrigger className="mt-2 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
