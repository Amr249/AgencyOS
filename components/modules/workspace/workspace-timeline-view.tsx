"use client";

import * as React from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";

const statusColor: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  in_review: "bg-purple-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

export function WorkspaceTimelineView({
  tasks,
  projects,
}: {
  tasks: any[];
  projects: { id: string; name: string }[];
}) {
  const [mode, setMode] = React.useState<"week" | "month">("month");
  const today = new Date();
  const totalDays = mode === "week" ? 7 : 30;
  const axis = Array.from({ length: totalDays }).map((_, i) => addDays(today, i));
  const withoutDueDate = tasks.filter((task) => !task.dueDate).length;

  return (
    <div dir="ltr" className="space-y-4">
      <WorkspaceNav projects={projects} />
      <div className="flex items-center gap-2">
        <Button variant={mode === "week" ? "secondary" : "outline"} onClick={() => setMode("week")}>Week</Button>
        <Button variant={mode === "month" ? "secondary" : "outline"} onClick={() => setMode("month")}>Month</Button>
      </div>

      <div className="hidden gap-3 md:flex">
        <div className="w-[220px] space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-lg border p-2">
              <p className="truncate text-sm font-medium" dir="auto">{task.title}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span>{task.assigneeName ?? "Unassigned"}</span>
                <Badge variant="outline">{task.status}</Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="relative flex-1 overflow-x-auto rounded-xl border p-2" dir="ltr">
          <div
            className="grid min-w-[900px] gap-y-2"
            style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(32px, 1fr))` }}
          >
            {axis.map((d) => (
              <div key={d.toISOString()} className="text-center text-[11px] text-muted-foreground">
                {format(d, mode === "week" ? "dd MMM" : "dd")}
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {tasks
              .filter((task) => task.dueDate)
              .map((task) => {
                const startDate = task.createdAt ? new Date(task.createdAt) : today;
                const due = new Date(`${task.dueDate}T12:00:00`);
                const startOffset = Math.max(0, differenceInDays(startDate, today));
                const span = Math.max(1, differenceInDays(due, startDate) + 1);
                return (
                  <div
                    key={task.id}
                    className="grid min-w-[900px]"
                    style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(32px, 1fr))` }}
                  >
                    <div
                      className={`h-7 rounded px-2 text-xs text-white ${statusColor[task.status] ?? "bg-gray-500"}`}
                      style={{ gridColumn: `${Math.min(totalDays, startOffset + 1)} / span ${Math.min(totalDays, span)}` }}
                      title={`${task.title} — ${task.dueDate}`}
                    >
                      <span className="line-clamp-1">{task.title}</span>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 border-l border-red-500" style={{ left: 0 }} />
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-xl border p-3">
            <p className="font-medium" dir="auto">{task.title}</p>
            <p className="text-xs text-muted-foreground">{task.dueDate ?? "No due date"}</p>
          </div>
        ))}
      </div>

      {withoutDueDate > 0 && (
        <p className="text-sm text-muted-foreground">{withoutDueDate} tasks without due date.</p>
      )}
    </div>
  );
}
