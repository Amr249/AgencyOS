"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TASK_STATUS_LABELS_EN, TASK_STATUS_LABELS, TASK_STATUS_HEADER_CLASS } from "@/types";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/actions/tasks";

export const KANBAN_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

const COLUMN_PREFIX = "column:" as const;
const TASK_PREFIX = "task:" as const;

function columnDroppableId(status: KanbanStatus, scope?: string): string {
  return scope ? `${COLUMN_PREFIX}${scope}:${status}` : `${COLUMN_PREFIX}${status}`;
}

function parseColumnDropId(id: string): KanbanStatus | null {
  const s = String(id);
  if (!s.startsWith(COLUMN_PREFIX)) return null;
  const rest = s.slice(COLUMN_PREFIX.length);
  const last = rest.split(":").pop() ?? "";
  return KANBAN_STATUSES.includes(last as KanbanStatus) ? (last as KanbanStatus) : null;
}

const taskDragId = (taskId: string) => `${TASK_PREFIX}${taskId}` as const;

const kanbanCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const col = hits.find((h) => String(h.id).startsWith(COLUMN_PREFIX));
  return col ? [col] : hits;
};

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TasksKanbanProps = {
  tasks: TaskWithProject[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  onAddTask: (status: KanbanStatus) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, newStatus: KanbanStatus) => void | Promise<void>;
  /** When set, droppable ids include this scope (multiple boards on one page). */
  dndColumnScope?: string;
  memberView?: boolean;
};

function KanbanDroppableColumn({
  status,
  count,
  onAddTask,
  dndColumnScope,
  statusLabel,
  addTaskLabel,
  children,
}: {
  status: KanbanStatus;
  count: number;
  onAddTask: (status: KanbanStatus) => void;
  dndColumnScope?: string;
  statusLabel: string;
  addTaskLabel: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status, dndColumnScope),
    data: { type: "column" as const, status },
  });

  return (
    <div ref={setNodeRef} className="min-w-[300px] max-w-[300px] shrink-0">
      <Card
        className={cn(
          "flex h-full min-h-[min(70vh,520px)] flex-col gap-0 border-2 py-0 shadow-sm transition-[box-shadow,ring]",
          TASK_STATUS_HEADER_CLASS[status] ?? "",
          isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
      >
        <CardHeader className="border-b border-border/30 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
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
            <span className="font-semibold tracking-tight">{statusLabel}</span>
            <span className="text-muted-foreground text-sm tabular-nums">({count})</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 pt-3">
          {children}
          <Button
            variant="ghost"
            size="sm"
            className="mt-auto justify-start gap-2 rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground"
            onClick={() => onAddTask(status)}
          >
            <Plus className="h-4 w-4" />
            {addTaskLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function KanbanDraggableTask({
  task,
  assignees,
  onOpenTask,
  onDeleteTask,
  memberView,
}: {
  task: TaskWithProject;
  assignees: AssigneeForCard[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  memberView: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(task.id),
    data: {
      type: "task" as const,
      taskId: task.id,
      status: task.status as KanbanStatus,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <TaskCard
        task={task}
        assignees={assignees}
        copyLocale={memberView ? "ar" : "en"}
        hideProjectLink={memberView}
        onEdit={() => onOpenTask(task.id)}
        onDelete={() => onDeleteTask(task.id)}
      />
    </div>
  );
}

export function TasksKanban({
  tasks,
  assigneesByTaskId,
  onAddTask,
  onOpenTask,
  onDeleteTask,
  onTaskStatusChange,
  dndColumnScope,
  memberView = false,
}: TasksKanbanProps) {
  const statusLabels = memberView ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;
  const addTaskLabel = memberView ? "+ إضافة مهمة" : "+ Add Task";
  const [activeTask, setActiveTask] = React.useState<TaskWithProject | null>(null);

  const byStatus = React.useMemo(() => {
    const m: Record<string, TaskWithProject[]> = {};
    for (const s of KANBAN_STATUSES) m[s] = [];
    for (const t of tasks) {
      if (m[t.status]) m[t.status].push(t);
    }
    return m;
  }, [tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (!id.startsWith(TASK_PREFIX)) return;
    const taskId = id.slice(TASK_PREFIX.length);
    const task = tasks.find((t) => t.id === taskId);
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const newStatus = parseColumnDropId(String(over.id));
    if (!newStatus) return;

    const activeStr = String(active.id);
    if (!activeStr.startsWith(TASK_PREFIX)) return;
    const taskId = activeStr.slice(TASK_PREFIX.length);

    const data = active.data.current as { status?: KanbanStatus } | undefined;
    const fromStatus = data?.status;
    if (fromStatus === newStatus) return;

    void onTaskStatusChange(taskId, newStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex gap-5 overflow-x-auto pb-2 pt-1">
        {KANBAN_STATUSES.map((status) => (
          <KanbanDroppableColumn
            key={status}
            status={status}
            count={byStatus[status].length}
            onAddTask={onAddTask}
            dndColumnScope={dndColumnScope}
            statusLabel={statusLabels[status] ?? status}
            addTaskLabel={addTaskLabel}
          >
            {byStatus[status].map((task) => (
              <KanbanDraggableTask
                key={task.id}
                task={task}
                assignees={assigneesByTaskId[task.id] ?? []}
                onOpenTask={onOpenTask}
                onDeleteTask={onDeleteTask}
                memberView={memberView}
              />
            ))}
          </KanbanDroppableColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
        {activeTask ? (
          <div className="w-[300px] cursor-grabbing">
            <TaskCard
              task={activeTask}
              assignees={assigneesByTaskId[activeTask.id] ?? []}
              copyLocale={memberView ? "ar" : "en"}
              hideProjectLink={memberView}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
