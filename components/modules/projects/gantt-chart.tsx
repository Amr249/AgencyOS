"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskDetailModal } from "@/components/modules/tasks/task-detail-modal";
import { updateTask } from "@/actions/tasks";
import { getCriticalPath } from "@/actions/task-dependencies";

type GanttTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string | Date;
};

type DependencyRow = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
  status: string;
};

type ZoomLevel = "day" | "week" | "month";
type DragMode = "move" | "resize-start" | "resize-end";

const ROW_HEIGHT = 44;
const LEFT_COL = 280;
const HEADER_HEIGHT = 40;

function parseDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const raw = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(raw.getTime())) return null;
  return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function formatIsoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function statusClass(status: string): string {
  if (status === "done") return "bg-emerald-500/80";
  if (status === "in_progress") return "bg-blue-500/80";
  if (status === "blocked") return "bg-red-500/80";
  if (status === "in_review") return "bg-violet-500/80";
  return "bg-slate-500/75";
}

function dayWidthByZoom(zoom: ZoomLevel): number {
  if (zoom === "month") return 10;
  if (zoom === "week") return 18;
  return 30;
}

function isMilestoneTask(task: GanttTask): boolean {
  if (!task.startDate || !task.dueDate) return false;
  const start = parseDate(task.startDate);
  const end = parseDate(task.dueDate);
  if (!start || !end) return false;
  return diffDays(end, start) === 0;
}

type PreparedTask = {
  task: GanttTask;
  start: Date;
  end: Date;
};

export function GanttChart({
  projectId,
  tasks,
  dependencies,
  teamMembers,
}: {
  projectId: string;
  tasks: GanttTask[];
  dependencies: DependencyRow[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const [zoom, setZoom] = React.useState<ZoomLevel>("week");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [showCriticalPath, setShowCriticalPath] = React.useState(false);
  const [criticalPathTaskIds, setCriticalPathTaskIds] = React.useState<string[]>([]);
  const [localTasks, setLocalTasks] = React.useState(tasks);
  const [isSavingTaskId, setIsSavingTaskId] = React.useState<string | null>(null);
  const [dragState, setDragState] = React.useState<{
    taskId: string;
    mode: DragMode;
    startClientX: number;
    originalStart: Date;
    originalEnd: Date;
    previewStart: Date;
    previewEnd: Date;
  } | null>(null);
  const draggingRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);

  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  React.useEffect(() => {
    if (!showCriticalPath) return;
    getCriticalPath(projectId).then((res) => {
      if (!res.ok) {
        setCriticalPathTaskIds([]);
        toast.error("Failed to load critical path.");
        return;
      }
      setCriticalPathTaskIds(res.data.taskIds ?? []);
    });
  }, [projectId, showCriticalPath]);

  const prepared = React.useMemo<PreparedTask[]>(() => {
    return localTasks.map((t) => {
      const fallback = parseDate(t.createdAt) ?? new Date();
      const start = parseDate(t.startDate) ?? parseDate(t.dueDate) ?? fallback;
      const end = parseDate(t.dueDate) ?? parseDate(t.startDate) ?? start;
      return {
        task: t,
        start: start <= end ? start : end,
        end: end >= start ? end : start,
      };
    });
  }, [localTasks]);

  const minDate = React.useMemo(() => {
    if (prepared.length === 0) return addDays(parseDate(new Date()) ?? new Date(), -3);
    return addDays(
      prepared.reduce((acc, p) => (p.start < acc ? p.start : acc), prepared[0]!.start),
      -3
    );
  }, [prepared]);

  const maxDate = React.useMemo(() => {
    if (prepared.length === 0) return addDays(parseDate(new Date()) ?? new Date(), 7);
    return addDays(
      prepared.reduce((acc, p) => (p.end > acc ? p.end : acc), prepared[0]!.end),
      7
    );
  }, [prepared]);

  const totalDays = Math.max(1, diffDays(maxDate, minDate) + 1);
  const dayWidth = dayWidthByZoom(zoom);
  const timelineWidth = totalDays * dayWidth;

  const dayTicks = React.useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));
  }, [minDate, totalDays]);

  const taskIndex = React.useMemo(() => {
    const m = new Map<string, number>();
    prepared.forEach((p, idx) => m.set(p.task.id, idx));
    return m;
  }, [prepared]);

  const today = parseDate(new Date())!;
  const todayOffset = diffDays(today, minDate) * dayWidth;
  const showToday = todayOffset >= 0 && todayOffset <= timelineWidth;

  const linePaths = React.useMemo(() => {
    const criticalSet = new Set(criticalPathTaskIds);
    return dependencies
      .map((d) => {
        const toIdx = taskIndex.get(d.taskId);
        const fromIdx = taskIndex.get(d.dependsOnTaskId);
        if (toIdx == null || fromIdx == null) return null;

        const fromTask = prepared[fromIdx]!;
        const toTask = prepared[toIdx]!;
        const fromX = (diffDays(fromTask.end, minDate) + 1) * dayWidth;
        const toX = diffDays(toTask.start, minDate) * dayWidth;
        const fromY = HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const toY = HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const midX = Math.max(fromX + 12, (fromX + toX) / 2);

        return {
          id: d.id,
          taskId: d.taskId,
          dependsOnTaskId: d.dependsOnTaskId,
          path: `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`,
          arrowX: toX,
          arrowY: toY,
          isCritical:
            showCriticalPath && criticalSet.has(d.taskId) && criticalSet.has(d.dependsOnTaskId),
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
  }, [dependencies, dayWidth, minDate, prepared, taskIndex, criticalPathTaskIds, showCriticalPath]);

  const preparedById = React.useMemo(() => {
    const map = new Map<string, PreparedTask>();
    prepared.forEach((p) => map.set(p.task.id, p));
    return map;
  }, [prepared]);

  const beginDrag = React.useCallback(
    (taskId: string, mode: DragMode, clientX: number) => {
      const p = preparedById.get(taskId);
      if (!p) return;
      draggingRef.current = false;
      setDragState({
        taskId,
        mode,
        startClientX: clientX,
        originalStart: p.start,
        originalEnd: p.end,
        previewStart: p.start,
        previewEnd: p.end,
      });
    },
    [preparedById]
  );

  React.useEffect(() => {
    if (!dragState) return;

    const onMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - dragState.startClientX;
      const deltaDays = Math.round(deltaPx / dayWidth);
      if (Math.abs(deltaPx) > 3) draggingRef.current = true;

      let nextStart = dragState.originalStart;
      let nextEnd = dragState.originalEnd;

      if (dragState.mode === "move") {
        nextStart = addDays(dragState.originalStart, deltaDays);
        nextEnd = addDays(dragState.originalEnd, deltaDays);
      } else if (dragState.mode === "resize-start") {
        nextStart = addDays(dragState.originalStart, deltaDays);
        if (nextStart > nextEnd) nextStart = nextEnd;
      } else {
        nextEnd = addDays(dragState.originalEnd, deltaDays);
        if (nextEnd < nextStart) nextEnd = nextStart;
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              previewStart: nextStart,
              previewEnd: nextEnd,
            }
          : prev
      );
    };

    const violatesDependencies = (taskId: string, candidateStart: Date, candidateEnd: Date): string | null => {
      for (const dep of dependencies) {
        if (dep.taskId !== taskId) continue;
        const blocking = preparedById.get(dep.dependsOnTaskId);
        if (!blocking) continue;
        const bStart = blocking.start;
        const bEnd = blocking.end;

        if (dep.type === "finish_to_start" && candidateStart < bEnd) {
          return "finish-to-start";
        }
        if (dep.type === "start_to_start" && candidateStart < bStart) {
          return "start-to-start";
        }
        if (dep.type === "finish_to_finish" && candidateEnd < bEnd) {
          return "finish-to-finish";
        }
        if (dep.type === "start_to_finish" && candidateEnd < bStart) {
          return "start-to-finish";
        }
      }
      return null;
    };

    const onUp = async () => {
      const moved = draggingRef.current;
      const current = dragState;
      setDragState(null);
      draggingRef.current = false;
      if (!moved) return;
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);

      const v = violatesDependencies(current.taskId, current.previewStart, current.previewEnd);
      if (v) {
        toast.warning(`Move blocked: would violate ${v} dependency.`);
        return;
      }

      const payload = {
        id: current.taskId,
        startDate: formatIsoDateUtc(current.previewStart),
        dueDate: formatIsoDateUtc(current.previewEnd),
      };

      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === current.taskId ? { ...t, startDate: payload.startDate, dueDate: payload.dueDate } : t
        )
      );
      setIsSavingTaskId(current.taskId);
      const res = await updateTask(payload);
      setIsSavingTaskId(null);
      if (!res.ok) {
        toast.error("Could not update task dates.");
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id === current.taskId
              ? {
                  ...t,
                  startDate: formatIsoDateUtc(current.originalStart),
                  dueDate: formatIsoDateUtc(current.originalEnd),
                }
              : t
          )
        );
        return;
      }
      toast.success("Task dates updated.");
      router.refresh();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dayWidth, dependencies, dragState, preparedById, router]);

  return (
    <div className="space-y-3" dir="ltr" lang="en">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Project Gantt</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showCriticalPath ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCriticalPath((v) => !v)}
          >
            Show Critical Path
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => (z === "day" ? "day" : z === "week" ? "day" : "week"))}
          >
            <ZoomIn className="h-4 w-4" />
            Zoom In
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => (z === "month" ? "month" : z === "week" ? "month" : "week"))}
          >
            <ZoomOut className="h-4 w-4" />
            Zoom Out
          </Button>
        </div>
      </div>
      {dragState ? (
        <div className="text-muted-foreground text-xs">
          Preview: {formatIsoDateUtc(dragState.previewStart)} → {formatIsoDateUtc(dragState.previewEnd)}
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="sticky top-0 z-10 flex border-b bg-card">
              <div
                className="text-muted-foreground border-r px-3 py-2 text-sm font-medium"
                style={{ width: LEFT_COL }}
              >
                Task
              </div>
              <div className="relative" style={{ width: timelineWidth, height: HEADER_HEIGHT }}>
                {dayTicks.map((d, i) => (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "absolute top-0 h-full border-r px-1 pt-2 text-[10px] text-muted-foreground",
                      zoom === "day" ? "text-[11px]" : "text-[10px]"
                    )}
                    style={{ left: i * dayWidth, width: dayWidth }}
                  >
                    {zoom === "month"
                      ? `${d.getUTCDate()}`
                      : zoom === "week"
                        ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
                        : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex">
              <div className="border-r" style={{ width: LEFT_COL }}>
                {prepared.map((p) => (
                  <button
                    type="button"
                    key={p.task.id}
                    className="hover:bg-muted/50 flex h-11 w-full items-center border-b px-3 text-left text-sm"
                    onClick={() => setSelectedTaskId(p.task.id)}
                  >
                    <span className="truncate font-medium">{p.task.title}</span>
                  </button>
                ))}
              </div>

              <div className="relative" style={{ width: timelineWidth, minHeight: prepared.length * ROW_HEIGHT }}>
                {showToday ? (
                  <div
                    className="absolute top-0 z-20 h-full w-[2px] bg-amber-500/80"
                    style={{ left: todayOffset }}
                    aria-label="Today"
                  />
                ) : null}

                {prepared.map((p, idx) => {
                  const dragForThis = dragState?.taskId === p.task.id ? dragState : null;
                  const effectiveStart = dragForThis ? dragForThis.previewStart : p.start;
                  const effectiveEnd = dragForThis ? dragForThis.previewEnd : p.end;
                  const start = diffDays(effectiveStart, minDate) * dayWidth;
                  const len = Math.max(1, diffDays(effectiveEnd, effectiveStart) + 1);
                  const width = len * dayWidth;
                  const isCritical = showCriticalPath && criticalPathTaskIds.includes(p.task.id);
                  const isMilestone = isMilestoneTask(p.task);
                  return (
                    <div
                      key={p.task.id}
                      className="absolute left-0 w-full border-b"
                      style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      {isMilestone ? (
                        <button
                          type="button"
                          className={cn(
                            "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-violet-500 shadow",
                            "hover:bg-violet-400",
                            isCritical && "ring-2 ring-orange-500 ring-offset-1",
                            isSavingTaskId === p.task.id && "opacity-70"
                          )}
                          style={{ left: start + Math.max(6, dayWidth / 2) }}
                          title={p.task.title}
                          onClick={() => {
                            if (suppressClickRef.current || dragState) return;
                            setSelectedTaskId(p.task.id);
                          }}
                          aria-label={`Milestone: ${p.task.title}`}
                        />
                      ) : (
                        <div
                          className={cn(
                            "absolute top-1/2 h-6 -translate-y-1/2 rounded-md px-2 text-left text-[11px] text-white shadow",
                            statusClass(p.task.status),
                            isCritical && "ring-2 ring-orange-500 ring-offset-1",
                            dragForThis && "ring-2 ring-amber-300/80",
                            isSavingTaskId === p.task.id && "opacity-70"
                          )}
                          style={{ left: start, width }}
                          onPointerDown={(e) => {
                            if (isSavingTaskId) return;
                            beginDrag(p.task.id, "move", e.clientX);
                          }}
                          onClick={() => {
                            if (suppressClickRef.current || dragState) return;
                            setSelectedTaskId(p.task.id);
                          }}
                          role="button"
                          tabIndex={0}
                          title={p.task.title}
                        >
                          <span
                            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md bg-black/20"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              beginDrag(p.task.id, "resize-start", e.clientX);
                            }}
                          />
                          <span className="block truncate">{p.task.title}</span>
                          <span
                            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/20"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              beginDrag(p.task.id, "resize-end", e.clientX);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <svg
                  className="pointer-events-none absolute left-0 top-0 z-10"
                  width={timelineWidth}
                  height={HEADER_HEIGHT + prepared.length * ROW_HEIGHT}
                >
                  {linePaths.map((ln) => (
                    <g key={ln.id}>
                      <path
                        d={ln.path}
                        fill="none"
                        stroke={ln.isCritical ? "hsl(12 95% 55%)" : "hsl(var(--muted-foreground))"}
                        strokeWidth={ln.isCritical ? 2.5 : 1.25}
                      />
                      <polygon
                        points={`${ln.arrowX},${ln.arrowY} ${ln.arrowX - 5},${ln.arrowY - 3} ${ln.arrowX - 5},${ln.arrowY + 3}`}
                        fill={ln.isCritical ? "hsl(12 95% 55%)" : "hsl(var(--muted-foreground))"}
                      />
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        teamMembers={teamMembers}
        onClose={() => setSelectedTaskId(null)}
        onSuccess={() => {
          setSelectedTaskId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
