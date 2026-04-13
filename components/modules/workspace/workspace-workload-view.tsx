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
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { updateTask } from "@/actions/tasks";
import {
  getWorkspaceWorkloadCapacity,
  type WorkloadCapacityRow,
  type WorkloadCapacityTaskRow,
} from "@/actions/workspace";
function loadLabelFromUtil(utilizationPercent: number): WorkloadCapacityRow["loadLabel"] {
  if (utilizationPercent > 100) return "overloaded";
  if (utilizationPercent >= 80) return "assigned";
  return "available";
}

function recomputeRowMetrics(row: WorkloadCapacityRow): WorkloadCapacityRow {
  const assignedSum = row.tasks.reduce((s, t) => s + t.hours, 0);
  const capacity = row.capacityHours;
  const assignedHours = Number(assignedSum.toFixed(2));
  const utilizationPercent =
    capacity > 0 ? Math.round((assignedHours / capacity) * 1000) / 10 : 0;
  const availableHours = Math.max(0, Number((capacity - assignedHours).toFixed(2)));
  return {
    ...row,
    assignedHours,
    availableHours,
    utilizationPercent,
    loadLabel: loadLabelFromUtil(utilizationPercent),
  };
}

function overloadHoursOverCapacity(row: WorkloadCapacityRow): number {
  return Number((row.assignedHours - row.capacityHours).toFixed(2));
}

function overloadedByLabel(hours: number): string {
  const h = Math.max(0, hours);
  if (h === 1) return "Overloaded by 1 hour";
  return `Overloaded by ${h} hours`;
}

function taskUpdateErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "_form" in error) {
    const f = (error as { _form?: string[] })._form;
    if (f?.[0]) return f[0];
  }
  if (error && typeof error === "object") {
    const vals = Object.values(error as Record<string, string[] | undefined>).flatMap(
      (v) => v ?? []
    );
    if (vals[0]) return vals[0];
  }
  return "Could not reassign task.";
}

const droppableId = (memberId: string) => `wm:${memberId}` as const;
const draggableId = (taskId: string) => `wt:${taskId}` as const;

const workloadCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const column = hits.find((h) => String(h.id).startsWith("wm:"));
  return column ? [column] : hits;
};

function DraggableWorkloadTask({
  task,
  memberId,
}: {
  task: WorkloadCapacityTaskRow;
  memberId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId(task.id),
    data: {
      type: "task" as const,
      taskId: task.id,
      fromMemberId: memberId,
      title: task.title,
      hours: task.hours,
    },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <Card
        className={cn(
          "cursor-grab border p-2.5 shadow-sm active:cursor-grabbing",
          isDragging && "opacity-50 ring-2 ring-primary/40"
        )}
        {...listeners}
        {...attributes}
      >
        <p className="line-clamp-3 text-sm font-medium" dir="auto">
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 text-muted-foreground text-xs tabular-nums">
          {task.dueDate ? <span>Due {task.dueDate}</span> : null}
          <span>{task.hours}h</span>
        </div>
      </Card>
    </div>
  );
}

function MemberDropColumn({ row }: { row: WorkloadCapacityRow }) {
  const { member, tasks } = row;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId(member.id),
    data: { type: "member" as const, memberId: member.id },
  });

  const overloaded = row.loadLabel === "overloaded";
  const overBy = overloaded ? overloadHoursOverCapacity(row) : 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[220px] max-w-[280px] flex-1 flex-col rounded-xl border bg-muted/15 transition-colors",
        isOver && "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background",
        overloaded &&
          !isOver &&
          "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/25"
      )}
    >
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar in workspace tool
          <img
            src={member.avatarUrl}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover"
            width={36}
            height={36}
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-semibold">
            {(member.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate font-semibold text-sm">{member.name}</div>
            {overloaded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-destructive hover:text-destructive/90 shrink-0 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={overloadedByLabel(overBy)}
                  >
                    <AlertTriangle className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{overloadedByLabel(overBy)}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="truncate text-muted-foreground text-xs">{member.role ?? "—"}</div>
        </div>
      </div>

      <div className="space-y-1.5 border-b px-3 py-2">
        <div className="flex justify-between text-xs tabular-nums">
          <span className="text-muted-foreground">Load</span>
          <span className="font-medium">
            {row.assignedHours}h / {row.capacityHours}h ({row.utilizationPercent}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full min-w-0 rounded-full transition-all",
              row.loadLabel === "overloaded" && "bg-red-500 dark:bg-red-600",
              row.loadLabel === "assigned" && "bg-amber-500 dark:bg-amber-600",
              row.loadLabel === "available" && "bg-emerald-500 dark:bg-emerald-600"
            )}
            style={{
              width: `${Math.min(100, row.utilizationPercent)}%`,
            }}
          />
        </div>
      </div>

      <div className="flex max-h-[min(52vh,420px)] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-center text-xs">Drop tasks here</p>
        ) : (
          tasks.map((task) => <DraggableWorkloadTask key={task.id} task={task} memberId={member.id} />)
        )}
      </div>
    </div>
  );
}

export function WorkspaceWorkloadView({ rows: initialRows }: { rows: WorkloadCapacityRow[] }) {
  const [rows, setRows] = React.useState<WorkloadCapacityRow[]>(initialRows);
  const [activeDrag, setActiveDrag] = React.useState<{ title: string; hours: number } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [overloadedOnly, setOverloadedOnly] = React.useState(false);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const weekLabel =
    rows[0] != null ? `${rows[0].weekStart} — ${rows[0].weekEnd}` : null;

  const overloadedCount = rows.filter((r) => r.loadLabel === "overloaded").length;
  const displayRows = overloadedOnly
    ? rows.filter((r) => r.loadLabel === "overloaded")
    : rows;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;

    const activeData = active.data.current as
      | { type?: string; taskId?: string; fromMemberId?: string }
      | undefined;
    const overData = over.data.current as { type?: string; memberId?: string } | undefined;

    if (activeData?.type !== "task" || !activeData.taskId || !activeData.fromMemberId) return;
    if (overData?.type !== "member" || !overData.memberId) return;
    if (activeData.fromMemberId === overData.memberId) return;

    const taskId = activeData.taskId;
    const newMemberId = overData.memberId;
    const snapshot = rows;

    setRows((prev) => {
      const fromIdx = prev.findIndex((r) => r.member.id === activeData.fromMemberId);
      const toIdx = prev.findIndex((r) => r.member.id === newMemberId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const taskIndex = prev[fromIdx]!.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return prev;
      const moved = { ...prev[fromIdx]!.tasks[taskIndex]!, assigneeId: newMemberId };
      const next = prev.map((r) => ({
        ...r,
        tasks: [...r.tasks],
      }));
      next[fromIdx]!.tasks.splice(taskIndex, 1);
      next[toIdx]!.tasks.push(moved);
      next[fromIdx] = recomputeRowMetrics(next[fromIdx]!);
      next[toIdx] = recomputeRowMetrics(next[toIdx]!);
      return next;
    });

    setPending(true);
    try {
      const result = await updateTask({ id: taskId, assigneeId: newMemberId });
      if (!result.ok) {
        setRows(snapshot);
        toast.error(taskUpdateErrorMessage(result.error));
        return;
      }
      const fresh = await getWorkspaceWorkloadCapacity();
      if (fresh.ok) {
        setRows(fresh.data);
      }
      toast.success("Task reassigned");
    } catch {
      setRows(snapshot);
      toast.error("Could not reassign task.");
    } finally {
      setPending(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { type?: string; title?: string; hours?: number }
      | undefined;
    if (data?.type === "task" && data.title != null) {
      setActiveDrag({ title: data.title, hours: typeof data.hours === "number" ? data.hours : 0 });
    }
  }

  if (!rows.length) {
    return (
      <div dir="ltr" className="space-y-4">
        <WorkspaceNav />
        <p className="text-sm text-muted-foreground">Add team members first.</p>
      </div>
    );
  }

  return (
    <div dir="ltr" lang="en" className="space-y-4">
        <WorkspaceNav />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workload</h1>
        <p className="text-sm text-muted-foreground">
          Capacity for the current week
          {weekLabel ? ` (${weekLabel})` : ""}. Drag tasks between members to reassign. Capacity hours are reduced
          when team members have weekday time off (see Availability).
        </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p
              className={cn(
                "text-sm font-medium tabular-nums",
                overloadedCount > 0 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {overloadedCount === 1
                ? "1 team member overloaded"
                : `${overloadedCount} team members overloaded`}
            </p>
            <Button
              type="button"
              variant={overloadedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setOverloadedOnly((v) => !v)}
            >
              {overloadedOnly ? "Show all members" : "Overloaded only"}
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-emerald-500" aria-hidden />
              Under 80%
            </span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-amber-500" aria-hidden />
              80–100%
            </span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-red-500" aria-hidden />
              Over 100%
            </span>
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={workloadCollision}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={() => setActiveDrag(null)}
        >
          {displayRows.length === 0 && overloadedOnly ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
              <p className="text-muted-foreground text-sm">No overloaded members this week.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setOverloadedOnly(false)}
              >
                Show all members
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "flex gap-3 overflow-x-auto pb-2",
                pending && "pointer-events-none opacity-70"
              )}
            >
              {displayRows.map((row) => (
                <MemberDropColumn key={row.member.id} row={row} />
              ))}
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <Card className="max-w-[260px] cursor-grabbing border-2 border-primary p-3 shadow-lg">
                <p className="line-clamp-3 text-sm font-medium">{activeDrag.title}</p>
                <p className="mt-1 text-muted-foreground text-xs tabular-nums">{activeDrag.hours}h</p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
    </div>
  );
}
