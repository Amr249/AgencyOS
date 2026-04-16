"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_BADGE_CLASS,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
  TASK_STATUS_LABELS_EN,
} from "@/types";
import type { TaskWithProject } from "@/actions/tasks";

type TasksCalendarViewProps = {
  tasks: TaskWithProject[];
  onOpenTask: (taskId: string) => void;
  memberView?: boolean;
};

function parseIsoOrNull(s: string | null): Date | null {
  if (!s) return null;
  try {
    return startOfDay(parseISO(s));
  } catch {
    return null;
  }
}

function taskFallsOnDay(task: TaskWithProject, day: Date): boolean {
  const due = parseIsoOrNull(task.dueDate);
  if (!due) return false;
  return isSameDay(day, due);
}

export function TasksCalendarView({ tasks, onOpenTask, memberView = false }: TasksCalendarViewProps) {
  const [cursor, setCursor] = React.useState<Date>(() => startOfDay(new Date()));
  const locale = memberView ? arSA : enUS;
  const weekStartsOn: 0 | 1 | 6 = memberView ? 6 : 0; // Saturday for Arabic locale, Sunday otherwise
  const statusLabels = memberView ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days: Date[] = React.useMemo(() => {
    const list: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      list.push(d);
      d = addDays(d, 1);
    }
    return list;
  }, [gridStart, gridEnd]);

  const tasksByDay = React.useMemo(() => {
    const map = new Map<string, TaskWithProject[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const list: TaskWithProject[] = [];
      for (const t of tasks) {
        if (taskFallsOnDay(t, day)) list.push(t);
      }
      // Sort by priority: urgent > high > medium > low, then by title
      list.sort((a, b) => {
        const order = ["urgent", "high", "medium", "low"];
        const ai = order.indexOf(a.priority);
        const bi = order.indexOf(b.priority);
        if (ai !== bi) return ai - bi;
        return a.title.localeCompare(b.title);
      });
      map.set(key, list);
    }
    return map;
  }, [days, tasks]);

  const weekDayLabels = React.useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), "EEE", { locale }));
  }, [locale, weekStartsOn]);

  const today = startOfDay(new Date());
  const monthTitle = format(cursor, "MMMM yyyy", { locale });
  const dir = memberView ? "rtl" : "ltr";

  return (
    <div dir={dir} className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(subMonths(cursor, 1))}
            aria-label={memberView ? "الشهر السابق" : "Previous month"}
          >
            {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label={memberView ? "الشهر التالي" : "Next month"}
          >
            {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            {memberView ? "اليوم" : "Today"}
          </Button>
        </div>
        <h3 className="text-base font-semibold capitalize">{monthTitle}</h3>
        <div className="text-muted-foreground text-xs">
          {memberView
            ? `${tasks.length} مهمة`
            : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium">
        {weekDayLabels.map((label) => (
          <div key={label} className="p-2 text-center uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[120px] border-b border-e p-1.5 align-top last:border-e-0",
                !inMonth && "bg-muted/30 text-muted-foreground",
                isToday && "bg-primary/5"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {format(day, "d", { locale })}
                </span>
                {dayTasks.length > 3 ? (
                  <span className="text-muted-foreground text-[10px]">
                    +{dayTasks.length - 3}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    title={`${t.title} · ${t.projectName}`}
                    className={cn(
                      "group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start text-xs transition-colors hover:brightness-95",
                      TASK_PRIORITY_BADGE_CLASS[t.priority] ?? ""
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        t.priority === "urgent" && "bg-red-500",
                        t.priority === "high" && "bg-amber-500",
                        t.priority === "medium" && "bg-blue-500",
                        t.priority === "low" && "bg-gray-400"
                      )}
                    />
                    <span className="truncate font-medium">{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t p-2">
        {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map((s) => (
          <Badge
            key={s}
            variant="secondary"
            className={cn("text-[10px]", TASK_STATUS_BADGE_CLASS[s] ?? "")}
          >
            {statusLabels[s] ?? s}
          </Badge>
        ))}
      </div>
    </div>
  );
}
