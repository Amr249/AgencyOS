"use client";

import * as React from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { updateTaskSortOrder } from "@/actions/workspace";
import { TASK_PRIORITY_BORDER } from "@/types";
import { cn } from "@/lib/utils";

type Column = { status: string; label: string; tasks: any[] };

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
};

function SortableTaskCard({ task, onOpen }: { task: any; onOpen: (task: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "cursor-pointer border border-border p-3 shadow-sm",
        TASK_PRIORITY_BORDER[task.priority as keyof typeof TASK_PRIORITY_BORDER]
      )}
      onClick={() => onOpen(task)}
      {...attributes}
      {...listeners}
    >
      <p className="mb-2 text-sm font-medium" dir="auto">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{task.assigneeName ?? "Unassigned"}</span>
        {task.totalLoggedHours > 0 && <span>⏱ {task.totalLoggedHours}h</span>}
      </div>
    </Card>
  );
}

export function WorkspaceBoardView({
  columns,
  projects,
  projectId,
  teamMembers,
}: {
  columns: Column[];
  projects: { id: string; name: string }[];
  projectId: string;
  teamMembers: any[];
}) {
  const [localColumns, setLocalColumns] = React.useState(columns);
  const [newOpen, setNewOpen] = React.useState(false);
  const [defaultStatus, setDefaultStatus] = React.useState<any>("todo");
  const [selectedTask, setSelectedTask] = React.useState<any | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceColIndex = localColumns.findIndex((c) => c.tasks.some((t) => t.id === active.id));
    const targetColIndex = localColumns.findIndex((c) => c.tasks.some((t) => t.id === over.id));
    if (sourceColIndex === -1 || targetColIndex === -1) return;

    const sourceCol = localColumns[sourceColIndex];
    const targetCol = localColumns[targetColIndex];
    const oldIndex = sourceCol.tasks.findIndex((t) => t.id === active.id);
    const newIndex = targetCol.tasks.findIndex((t) => t.id === over.id);

    const updated = [...localColumns];
    if (sourceColIndex === targetColIndex) {
      updated[sourceColIndex] = {
        ...sourceCol,
        tasks: arrayMove(sourceCol.tasks, oldIndex, newIndex),
      };
    } else {
      const moved = sourceCol.tasks[oldIndex];
      updated[sourceColIndex] = { ...sourceCol, tasks: sourceCol.tasks.filter((t) => t.id !== active.id) };
      const targetTasks = [...targetCol.tasks];
      targetTasks.splice(newIndex, 0, { ...moved, status: targetCol.status });
      updated[targetColIndex] = { ...targetCol, tasks: targetTasks };
    }

    setLocalColumns(updated);

    const payload = updated.flatMap((col) =>
      col.tasks.map((task, index) => ({
        id: task.id,
        sortOrder: index,
        status: col.status,
      }))
    );
    const result = await updateTaskSortOrder(payload);
    if (!result.ok) toast.error("Failed to save task order.");
  }

  return (
    <div dir="ltr" className="space-y-4">
      <WorkspaceNav projects={projects} />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {localColumns.map((column) => (
            <div key={column.status} className="min-w-[280px] flex-1 rounded-xl border border-border bg-muted/20 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary/60" />
                  <h3 className="text-sm font-semibold">{STATUS_LABELS[column.status] ?? column.status}</h3>
                  <Badge variant="secondary">{column.tasks.length}</Badge>
                </div>
              </div>
              <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="max-h-[65vh] space-y-2 overflow-y-auto">
                  {column.tasks.map((task) => (
                    <SortableTaskCard key={task.id} task={task} onOpen={setSelectedTask} />
                  ))}
                </div>
              </SortableContext>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start text-muted-foreground"
                onClick={() => {
                  setDefaultStatus(column.status);
                  setNewOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add task
              </Button>
            </div>
          ))}
        </div>
      </DndContext>

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        teamMembers={teamMembers.map((m: any) => ({ id: m.id, name: m.name }))}
        defaultStatus={defaultStatus}
        onSuccess={() => window.location.reload()}
      />
      <TaskDetailPanel
        task={selectedTask}
        teamMembers={teamMembers}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={() => window.location.reload()}
      />
    </div>
  );
}
