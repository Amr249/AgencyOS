"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";

type CalendarTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeName: string | null;
  projectName: string | null;
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  in_review: "bg-purple-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

const PRIORITY_CHIP: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  medium: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: Array<{ date: number; inMonth: boolean; key: string; iso: string }> = [];

  const prevMonth = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonth.getDate() - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({
      date: d,
      inMonth: false,
      key: `prev-${d}`,
      iso: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  for (let d = 1; d <= totalDays; d++) {
    cells.push({
      date: d,
      inMonth: true,
      key: `cur-${d}`,
      iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({
        date: d,
        inMonth: false,
        key: `next-${d}`,
        iso: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }
  }

  return cells;
}

export function WorkspaceCalendarView({
  tasks,
  month,
  teamMembers,
  projects,
}: {
  tasks: CalendarTask[];
  month: string;
  teamMembers: any[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();

  const [year, mo] = month.split("-").map(Number);
  const cells = getMonthGrid(year, mo - 1);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const tasksByDate = React.useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (!map[task.dueDate]) map[task.dueDate] = [];
      map[task.dueDate].push(task);
    }
    return map;
  }, [tasks]);

  const [selectedTask, setSelectedTask] = React.useState<any>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState<string | undefined>();
  const [expandedCell, setExpandedCell] = React.useState<string | null>(null);

  const MAX_VISIBLE = 3;

  function navigate(delta: number) {
    const d = new Date(year, mo - 1 + delta, 1);
    const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/dashboard/workspace/calendar?month=${nextMonth}`);
  }

  function goToday() {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/dashboard/workspace/calendar?month=${m}`);
  }

  const monthLabel = new Date(year, mo - 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div dir="ltr" className="space-y-4">
      <WorkspaceNav projects={[]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
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

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const dayTasks = tasksByDate[cell.iso] ?? [];
            const isToday = cell.iso === todayIso;
            const isExpanded = expandedCell === cell.key;
            const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE);
            const overflow = dayTasks.length - MAX_VISIBLE;

            return (
              <div
                key={cell.key}
                className={cn(
                  "group relative min-h-[110px] border-b border-e border-border p-1.5 transition-colors hover:bg-muted/30",
                  !cell.inMonth && "bg-muted/10",
                  i % 7 === 0 && "border-s"
                )}
                onDoubleClick={() => {
                  if (cell.inMonth) {
                    setNewDate(cell.iso);
                    setNewOpen(true);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-primary text-primary-foreground font-semibold"
                        : cell.inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                    )}
                  >
                    {cell.date}
                  </span>
                  {cell.inMonth && (
                    <button
                      className="invisible rounded p-0.5 text-muted-foreground hover:bg-muted group-hover:visible"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewDate(cell.iso);
                        setNewOpen(true);
                      }}
                      title="Add task"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {visibleTasks.map((task) => (
                    <button
                      key={task.id}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-start text-[11px] leading-tight transition-colors hover:bg-accent",
                        PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.medium
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          STATUS_DOT[task.status] ?? STATUS_DOT.todo
                        )}
                      />
                      <span className="truncate" dir="auto">{task.title}</span>
                    </button>
                  ))}
                  {overflow > 0 && !isExpanded && (
                    <button
                      className="w-full px-1.5 text-start text-[10px] text-muted-foreground hover:text-foreground"
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
                      className="w-full px-1.5 text-start text-[10px] text-muted-foreground hover:text-foreground"
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
        teamMembers={teamMembers.map((m: any) => ({ id: m.id, name: m.name }))}
        defaultDueDate={newDate}
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
