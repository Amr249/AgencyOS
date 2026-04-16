"use client";

import * as React from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TASK_STATUS_BADGE_CLASS, TASK_PRIORITY_BADGE_CLASS } from "@/types";
import type { TaskWithProject } from "@/actions/tasks";

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TasksTimesheetViewProps = {
  tasks: TaskWithProject[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  onOpenTask: (taskId: string) => void;
  memberView?: boolean;
};

type TimesheetRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** per-day list of task cells */
  daily: TaskWithProject[][];
};

function parseIsoDate(s: string | null): Date | null {
  if (!s) return null;
  try {
    return startOfDay(parseISO(s));
  } catch {
    return null;
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function taskOverlaps(task: TaskWithProject, day: Date): boolean {
  const start = parseIsoDate(task.startDate);
  const due = parseIsoDate(task.dueDate);
  if (start && due) return isWithinInterval(day, { start, end: due });
  if (due) return isSameDay(day, due);
  if (start) return isSameDay(day, start);
  return false;
}

export function TasksTimesheetView({
  tasks,
  assigneesByTaskId,
  onOpenTask,
  memberView = false,
}: TasksTimesheetViewProps) {
  const locale = memberView ? arSA : enUS;
  const weekStartsOn: 0 | 1 | 6 = memberView ? 6 : 0;
  const [cursor, setCursor] = React.useState<Date>(() =>
    startOfWeek(startOfDay(new Date()), { weekStartsOn })
  );

  const weekStart = startOfWeek(cursor, { weekStartsOn });
  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = days[6];

  const rows: TimesheetRow[] = React.useMemo(() => {
    const map = new Map<string, TimesheetRow>();
    const unassignedKey = "__unassigned__";

    function pushRow(
      key: string,
      name: string,
      avatarUrl: string | null,
      dayIndex: number,
      task: TaskWithProject
    ) {
      let row = map.get(key);
      if (!row) {
        row = {
          userId: key,
          name,
          avatarUrl,
          daily: Array.from({ length: 7 }, () => [] as TaskWithProject[]),
        };
        map.set(key, row);
      }
      row.daily[dayIndex].push(task);
    }

    for (const t of tasks) {
      const assignees = assigneesByTaskId[t.id] ?? [];
      for (let i = 0; i < 7; i++) {
        const day = days[i];
        if (!taskOverlaps(t, day)) continue;
        if (assignees.length === 0) {
          pushRow(unassignedKey, memberView ? "بدون تعيين" : "Unassigned", null, i, t);
        } else {
          for (const a of assignees) {
            pushRow(a.userId, a.name, a.avatarUrl, i, t);
          }
        }
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.userId === "__unassigned__") return 1;
      if (b.userId === "__unassigned__") return -1;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [tasks, assigneesByTaskId, days, memberView]);

  const dir = memberView ? "rtl" : "ltr";
  const today = startOfDay(new Date());

  const rangeLabel = `${format(weekStart, "dd MMM", { locale })} – ${format(weekEnd, "dd MMM yyyy", { locale })}`;

  return (
    <div dir={dir} className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(subWeeks(cursor, 1))}
            aria-label={memberView ? "الأسبوع السابق" : "Previous week"}
          >
            {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(addWeeks(cursor, 1))}
            aria-label={memberView ? "الأسبوع التالي" : "Next week"}
          >
            {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfWeek(startOfDay(new Date()), { weekStartsOn }))}
          >
            {memberView ? "هذا الأسبوع" : "This week"}
          </Button>
        </div>
        <h3 className="text-base font-semibold capitalize">{rangeLabel}</h3>
        <div className="w-24 shrink-0" aria-hidden />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky start-0 z-10 w-56 border-e border-b bg-muted/40 p-2 text-start text-xs font-medium uppercase text-muted-foreground">
                {memberView ? "الشخص" : "Person"}
              </th>
              {days.map((d) => {
                const isToday = isSameDay(d, today);
                return (
                  <th
                    key={d.toISOString()}
                    className={cn(
                      "border-b border-e p-2 text-center text-xs font-medium last:border-e-0",
                      isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className="uppercase">{format(d, "EEE", { locale })}</div>
                    <div
                      className={cn(
                        "text-sm",
                        isToday ? "font-bold text-primary" : "text-foreground font-semibold"
                      )}
                    >
                      {format(d, "dd", { locale })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  {memberView
                    ? "لا توجد مهام ضمن هذا الأسبوع."
                    : "No scheduled tasks for this week."}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const weekTaskCount = new Set(r.daily.flat().map((t) => t.id)).size;
                return (
                  <tr key={r.userId} className="align-top">
                    <th className="sticky start-0 z-10 border-e border-b bg-card p-2 text-start font-normal">
                      <div className="flex items-center gap-2">
                        {r.userId === "__unassigned__" ? (
                          <div className="text-muted-foreground inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-xs">
                            ?
                          </div>
                        ) : (
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={r.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {weekTaskCount}{" "}
                            {memberView ? (weekTaskCount === 1 ? "مهمة" : "مهام") : weekTaskCount === 1 ? "task" : "tasks"}
                          </div>
                        </div>
                      </div>
                    </th>
                    {days.map((d, i) => {
                      const dayTasks = r.daily[i];
                      const isToday = isSameDay(d, today);
                      return (
                        <td
                          key={d.toISOString()}
                          className={cn(
                            "border-e border-b p-1.5 align-top last:border-e-0",
                            isToday && "bg-primary/5"
                          )}
                        >
                          <div className="space-y-1">
                            {dayTasks.length === 0 ? (
                              <div className="text-muted-foreground/40 text-center text-xs">—</div>
                            ) : (
                              dayTasks.map((t) => (
                                <button
                                  key={`${t.id}-${i}`}
                                  type="button"
                                  onClick={() => onOpenTask(t.id)}
                                  title={`${t.title} · ${t.projectName}`}
                                  className={cn(
                                    "block w-full truncate rounded-md px-1.5 py-1 text-start text-[11px] leading-tight transition-colors hover:brightness-95",
                                    TASK_PRIORITY_BADGE_CLASS[t.priority] ?? ""
                                  )}
                                >
                                  <span className="font-medium">{t.title}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t p-2">
        <span className="text-muted-foreground me-1 text-xs">
          {memberView ? "الأولوية:" : "Priority:"}
        </span>
        {(["urgent", "high", "medium", "low"] as const).map((p) => (
          <Badge
            key={p}
            variant="secondary"
            className={cn("text-[10px]", TASK_PRIORITY_BADGE_CLASS[p] ?? "")}
          >
            {p}
          </Badge>
        ))}
        <span className="text-muted-foreground ms-auto text-xs">
          {memberView
            ? "المهام تظهر في الأيام بين تاريخ البدء وتاريخ الاستحقاق (أو في يوم الاستحقاق فقط)."
            : "Tasks appear on days from start date through due date (or on the due date only)."}
        </span>
        <span className="sr-only">{TASK_STATUS_BADGE_CLASS.todo}</span>
      </div>
    </div>
  );
}
