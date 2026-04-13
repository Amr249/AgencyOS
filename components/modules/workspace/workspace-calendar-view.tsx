"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_BORDER } from "@/types";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import type { ProjectPickerOption } from "@/components/entity-select-option";

type CalendarTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeName: string | null;
  projectName: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
  description: string | null;
  assigneeId: string | null;
};

type PanelTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours?: string | null;
  description?: string | null;
  assigneeId?: string | null;
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-600",
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseMonthKey(month: string): Date {
  return parse(`${month}-01`, "yyyy-MM-dd", new Date());
}

function monthGridCells(monthDate: Date) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => ({
    date: d.getDate(),
    inMonth: isSameMonth(d, monthDate),
    key: format(d, "yyyy-MM-dd"),
    iso: format(d, "yyyy-MM-dd"),
  }));
}

function todayIsoLocal(): string {
  const t = new Date();
  return format(t, "yyyy-MM-dd");
}

function taskIsOverdue(task: CalendarTask, todayIso: string): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  return task.dueDate < todayIso;
}

function isHighPriority(p: string): boolean {
  return p === "high" || p === "urgent";
}

function toPanelTask(t: CalendarTask): PanelTask {
  return {
    id: t.id,
    title: t.title,
    status: t.status as PanelTask["status"],
    priority: t.priority as PanelTask["priority"],
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    description: t.description,
    assigneeId: t.assigneeId,
  };
}

function calendarHref(
  pathname: string,
  next: { month: string; view: "month" | "week"; weekMonday?: string | null }
) {
  if (next.view === "week" && next.weekMonday) {
    return `${pathname}?month=${encodeURIComponent(next.month)}&view=week&week=${encodeURIComponent(next.weekMonday)}`;
  }
  return `${pathname}?month=${encodeURIComponent(next.month)}`;
}

export function WorkspaceCalendarView({
  tasks,
  month,
  viewMode,
  weekAnchor,
  teamMembers,
  projects,
}: {
  tasks: CalendarTask[];
  month: string;
  viewMode: "month" | "week";
  weekAnchor?: string;
  teamMembers: { id: string; name: string; avatarUrl?: string | null; role?: string | null }[];
  projects: ProjectPickerOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  /** Must be stable across renders: `parseMonthKey` returns a new Date each call and would otherwise recreate `defaultWeekMonday` every render → useEffect loop. */
  const monthDate = React.useMemo(() => parseMonthKey(month), [month]);
  const todayIso = React.useMemo(() => todayIsoLocal(), []);

  const defaultWeekMonday = React.useCallback(() => {
    const now = new Date();
    return isSameMonth(monthDate, now)
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfWeek(monthDate, { weekStartsOn: 1 });
  }, [monthDate]);

  const [weekMonday, setWeekMonday] = React.useState<Date>(() => {
    if (weekAnchor) {
      const d = parse(`${weekAnchor}T12:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
      return startOfWeek(d, { weekStartsOn: 1 });
    }
    return defaultWeekMonday();
  });

  React.useEffect(() => {
    let next: Date;
    if (weekAnchor) {
      const d = parse(`${weekAnchor}T12:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
      next = startOfWeek(d, { weekStartsOn: 1 });
    } else {
      next = defaultWeekMonday();
    }
    setWeekMonday((prev) => (prev.getTime() === next.getTime() ? prev : next));
  }, [month, weekAnchor, defaultWeekMonday]);

  const view = viewMode;
  const monthCells = React.useMemo(() => monthGridCells(monthDate), [monthDate]);
  const weekCells = React.useMemo(() => {
    const end = endOfWeek(weekMonday, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekMonday, end }).map((d) => ({
      date: d.getDate(),
      inMonth: isSameMonth(d, monthDate),
      key: format(d, "yyyy-MM-dd"),
      iso: format(d, "yyyy-MM-dd"),
    }));
  }, [weekMonday, monthDate]);

  const cells = view === "week" ? weekCells : monthCells;

  const tasksByDate = React.useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (!map[task.dueDate]) map[task.dueDate] = [];
      map[task.dueDate].push(task);
    }
    for (const k of Object.keys(map)) {
      map[k]!.sort((a, b) => {
        const pa = ["urgent", "high", "medium", "low"].indexOf(a.priority);
        const pb = ["urgent", "high", "medium", "low"].indexOf(b.priority);
        if (pa !== pb) return pa - pb;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [tasks]);

  const [selectedTask, setSelectedTask] = React.useState<CalendarTask | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState<string | undefined>();
  const [expandedCell, setExpandedCell] = React.useState<string | null>(null);

  const MAX_VISIBLE = 4;

  function refresh() {
    router.refresh();
  }

  function navigateMonth(delta: number) {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + delta);
    const nextMonth = format(d, "yyyy-MM");
    router.push(calendarHref(pathname, { month: nextMonth, view: "month" }));
  }

  function goToday() {
    const now = new Date();
    const m = format(now, "yyyy-MM");
    const monday = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (view === "week") {
      router.push(calendarHref(pathname, { month: m, view: "week", weekMonday: monday }));
    } else {
      router.push(calendarHref(pathname, { month: m, view: "month" }));
    }
  }

  function setView(next: "month" | "week") {
    if (next === "week") {
      const monday = format(weekMonday, "yyyy-MM-dd");
      router.replace(calendarHref(pathname, { month, view: "week", weekMonday: monday }));
    } else {
      router.replace(calendarHref(pathname, { month, view: "month" }));
    }
  }

  function navigateWeek(delta: number) {
    const next = addWeeks(weekMonday, delta);
    const mondayStr = format(next, "yyyy-MM-dd");
    const nextMonthKey = format(next, "yyyy-MM");
    setWeekMonday(next);
    if (nextMonthKey !== month) {
      router.push(
        calendarHref(pathname, { month: nextMonthKey, view: "week", weekMonday: mondayStr })
      );
    } else {
      router.replace(calendarHref(pathname, { month, view: "week", weekMonday: mondayStr }));
    }
  }

  function openQuickAdd(iso: string) {
    setNewDate(iso);
    setNewOpen(true);
  }

  function handleCellPointerDown(e: React.MouseEvent, cell: { inMonth: boolean; iso: string }) {
    if (!cell.inMonth) return;
    const t = e.target as HTMLElement;
    if (t.closest("button")) return;
    openQuickAdd(cell.iso);
  }

  const monthLabel = format(monthDate, "MMMM yyyy");
  const weekLabel = `${format(weekMonday, "MMM d")} – ${format(endOfWeek(weekMonday, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  return (
    <div dir="ltr" className="space-y-4">
      <WorkspaceNav projects={[]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            onClick={() => (view === "week" ? navigateWeek(-1) : navigateMonth(-1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[200px] text-center font-semibold text-lg">
            {view === "week" ? weekLabel : monthLabel}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label={view === "week" ? "Next week" : "Next month"}
            onClick={() => (view === "week" ? navigateWeek(1) : navigateMonth(1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "month" | "week")}
            variant="outline"
            size="sm"
            spacing={0}
            className="justify-start"
          >
            <ToggleGroupItem value="month" aria-label="Month view">
              Month
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view">
              Week
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-600" />
          Urgent
        </span>
        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 dark:border-red-900 dark:bg-red-950/40">
          Overdue
        </span>
        <span className="line-through opacity-60">Done</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border" dir="ltr">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className={cn("grid grid-cols-7", view === "week" && "auto-rows-fr")}>
          {cells.map((cell, i) => {
            const dayTasks = tasksByDate[cell.iso] ?? [];
            const isToday = cell.iso === todayIso;
            const isExpanded = expandedCell === cell.key;
            const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE);
            const overflow = dayTasks.length - MAX_VISIBLE;

            return (
              <div
                key={cell.key}
                role="button"
                tabIndex={cell.inMonth ? 0 : -1}
                onKeyDown={(e) => {
                  if (!cell.inMonth) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openQuickAdd(cell.iso);
                  }
                }}
                onClick={(e) => handleCellPointerDown(e, cell)}
                className={cn(
                  "group relative min-h-[118px] border-b border-e border-border p-1.5 transition-colors hover:bg-muted/25",
                  !cell.inMonth && "bg-muted/15",
                  i % 7 === 0 && "border-s",
                  view === "week" && "min-h-[200px]"
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs tabular-nums",
                      isToday
                        ? "bg-primary font-semibold text-primary-foreground"
                        : cell.inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                    )}
                  >
                    {view === "week" ? format(parse(`${cell.iso}T12:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date()), "EEE d") : cell.date}
                  </span>
                  {cell.inMonth && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuickAdd(cell.iso);
                      }}
                      title="Add task"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                  {visibleTasks.map((task) => {
                    const overdue = taskIsOverdue(task, todayIso);
                    const done = task.status === "done";
                    const pri = task.priority ?? "medium";
                    const borderClass =
                      TASK_PRIORITY_BORDER[pri as keyof typeof TASK_PRIORITY_BORDER] ??
                      TASK_PRIORITY_BORDER.medium;

                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-md border border-transparent border-l-4 bg-muted/50 px-1.5 py-1 text-start text-[11px] leading-tight transition-colors hover:bg-muted",
                          borderClass,
                          overdue &&
                            "border-red-200 bg-red-50 border-l-red-600! dark:border-red-900 dark:bg-red-950/35 dark:border-l-red-500!",
                          done && "border-l-muted-foreground/40 bg-muted/30 text-muted-foreground line-through opacity-75",
                          isHighPriority(pri) && !done && !overdue && "ring-1 ring-amber-500/45"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                      >
                        <span
                          className={cn(
                            "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                            PRIORITY_DOT[pri] ?? PRIORITY_DOT.medium
                          )}
                          title={`Priority: ${pri}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium" dir="auto">
                          {task.title}
                        </span>
                      </button>
                    );
                  })}
                  {overflow > 0 && !isExpanded && (
                    <button
                      type="button"
                      className="w-full rounded px-1.5 py-0.5 text-start text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCell(cell.key);
                      }}
                    >
                      +{overflow} more
                    </button>
                  )}
                  {isExpanded && overflow > 0 && (
                    <button
                      type="button"
                      className="w-full rounded px-1.5 py-0.5 text-start text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCell(null);
                      }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        teamMembers={teamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
        }))}
        defaultDueDate={newDate}
        onSuccess={refresh}
      />
      <TaskDetailPanel
        task={selectedTask ? toPanelTask(selectedTask) : null}
        teamMembers={teamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl ?? null,
          role: m.role ?? null,
        }))}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={refresh}
      />
    </div>
  );
}
