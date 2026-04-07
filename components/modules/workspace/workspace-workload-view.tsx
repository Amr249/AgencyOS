"use client";

import * as React from "react";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { cn } from "@/lib/utils";

type WorkloadRow = {
  member: { id: string; name: string; avatarUrl: string | null; role: string | null };
  weeks: Array<{
    weekStart: string;
    taskCount: number;
    estimatedHours: number;
    loggedHours: number;
    tasks?: string[];
  }>;
};

function getCellClass(taskCount: number, hours: number) {
  if (taskCount === 0) return "bg-transparent";
  if (taskCount <= 2 || hours < 4) return "bg-green-50 dark:bg-green-950/30";
  if (taskCount <= 5 || hours < 8) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-red-50 dark:bg-red-950/30";
}

export function WorkspaceWorkloadView({ rows }: { rows: WorkloadRow[] }) {
  const [selected, setSelected] = React.useState<{ member: string; week: string; tasks: string[] } | null>(null);

  if (!rows.length) {
    return (
      <div dir="ltr" className="space-y-4">
        <WorkspaceNav />
        <p className="text-sm text-muted-foreground">Add team members first.</p>
      </div>
    );
  }

  const weeks = rows[0]?.weeks ?? [];

  return (
    <div dir="ltr" className="space-y-4">
      <WorkspaceNav />
      <div>
        <h1 className="text-xl font-semibold text-foreground">Workload</h1>
        <p className="text-sm text-muted-foreground">Team task distribution for the next 8 weeks</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-[220px] p-3 text-left">Team Member</th>
              {weeks.map((week, index) => (
                <th key={week.weekStart} className="p-3 text-left">Week {index + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.member.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{row.member.name}</div>
                  <div className="text-xs text-muted-foreground">{row.member.role ?? "—"}</div>
                </td>
                {row.weeks.map((week) => (
                  <td
                    key={`${row.member.id}-${week.weekStart}`}
                    className={cn("cursor-pointer p-2 align-top", getCellClass(week.taskCount, week.loggedHours))}
                    title={(week.tasks ?? []).join("\n")}
                    onClick={() =>
                      setSelected({
                        member: row.member.name,
                        week: week.weekStart,
                        tasks: week.tasks ?? [],
                      })
                    }
                  >
                    <div className="text-xs">{week.taskCount} tasks</div>
                    <div className="text-xs text-muted-foreground">{week.loggedHours}h</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-xl border p-3">
          <p className="mb-2 font-medium">{selected.member} tasks — {selected.week}</p>
          {selected.tasks.length ? (
            <ul className="space-y-1 text-sm">
              {selected.tasks.map((task) => (
                <li key={task}>• {task}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks this week.</p>
          )}
        </div>
      )}
    </div>
  );
}
