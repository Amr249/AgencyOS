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
import {
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS_EN,
  TASK_PRIORITY_BADGE_CLASS,
} from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { PlusIcon } from "@radix-ui/react-icons";

const KANBAN_COLUMNS: { id: "todo" | "in_progress" | "in_review" | "done" | "blocked"; label: string }[] = [
  { id: "todo", label: TASK_STATUS_LABELS_EN.todo },
  { id: "in_progress", label: TASK_STATUS_LABELS_EN.in_progress },
  { id: "in_review", label: TASK_STATUS_LABELS_EN.in_review },
  { id: "done", label: TASK_STATUS_LABELS_EN.done },
  { id: "blocked", label: TASK_STATUS_LABELS_EN.blocked },
];

type TaskRow = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  milestoneId: string | null;
};

type MilestoneFilterOption = { id: string; name: string };

type ProjectTasksTabProps = {
  projectId: string;
  initialTasks: TaskRow[];
  milestones?: MilestoneFilterOption[];
};

export function ProjectTasksTab({
  projectId,
  initialTasks,
  milestones = [],
}: ProjectTasksTabProps) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);
  const [addingColumn, setAddingColumn] = React.useState<string | null>(null);
  const [newTitle, setNewTitle] = React.useState("");
  const [milestoneFilter, setMilestoneFilter] = React.useState<string>("all");

  const filteredTasks = React.useMemo(() => {
    if (milestoneFilter === "all") return tasks;
    if (milestoneFilter === "none") return tasks.filter((t) => !t.milestoneId);
    return tasks.filter((t) => t.milestoneId === milestoneFilter);
  }, [tasks, milestoneFilter]);

  const tasksByStatus = React.useMemo(() => {
    const m: Record<string, TaskRow[]> = {};
    for (const col of KANBAN_COLUMNS) m[col.id] = [];
    for (const t of filteredTasks) {
      if (m[t.status]) m[t.status].push(t);
    }
    return m;
  }, [filteredTasks]);

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
      setTasks((prev) => [
        ...prev,
        {
          id: result.data.id,
          projectId: result.data.projectId,
          title: result.data.title,
          status: result.data.status,
          priority: result.data.priority,
          dueDate: result.data.dueDate,
          milestoneId: result.data.milestoneId ?? null,
        },
      ]);
      setNewTitle("");
      setAddingColumn(null);
      router.refresh();
    }
  };

  const handleMoveTask = async (taskId: string, newStatus: string) => {
    const result = await updateTask({ id: taskId, status: newStatus as "todo" | "in_progress" | "in_review" | "done" | "blocked" });
    if (result.ok) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                milestoneId: result.data.milestoneId ?? t.milestoneId,
              }
            : t
        )
      );
      router.refresh();
    }
  };

  return (
    <div className="space-y-3" dir="ltr" lang="en">
      {milestones.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium">Milestone</span>
          <Select value={milestoneFilter} onValueChange={setMilestoneFilter}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Filter by milestone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="none">No milestone</SelectItem>
              {milestones.map((ms) => (
                <SelectItem key={ms.id} value={ms.id}>
                  {ms.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
      {KANBAN_COLUMNS.map((col) => (
        <Card key={col.id} className="min-w-[260px] flex-1 shrink-0">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <h3 className="text-left font-semibold">{col.label}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => setAddingColumn(addingColumn === col.id ? null : col.id)}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="text-xs font-medium">Add Task</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {addingColumn === col.id && (
              <div className="flex gap-2">
                <input
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Task title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTask(col.id);
                    if (e.key === "Escape") setAddingColumn(null);
                  }}
                />
                <Button size="sm" onClick={() => handleAddTask(col.id)}>
                  Add
                </Button>
              </div>
            )}
            {tasksByStatus[col.id]?.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border bg-card p-3 shadow-sm"
              >
                <p className="text-left font-medium leading-tight">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-xs",
                      TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "bg-muted"
                    )}
                  >
                    {TASK_PRIORITY_LABELS_EN[task.priority] ?? task.priority}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Due {formatDate(task.dueDate)}
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
            {(!tasksByStatus[col.id] || tasksByStatus[col.id].length === 0) &&
              addingColumn !== col.id && (
                <p className="text-muted-foreground py-2 text-center text-xs">No tasks yet.</p>
              )}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}
