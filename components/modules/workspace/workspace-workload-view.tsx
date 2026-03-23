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
  if (taskCount <= 2 || hours < 4) return "bg-green-50";
  if (taskCount <= 5 || hours < 8) return "bg-amber-50";
  return "bg-red-50";
}

export function WorkspaceWorkloadView({ rows }: { rows: WorkloadRow[] }) {
  const [selected, setSelected] = React.useState<{ member: string; week: string; tasks: string[] } | null>(null);

  if (!rows.length) {
    return (
      <div className="space-y-4" dir="rtl">
        <WorkspaceNav />
        <p className="text-sm text-muted-foreground">أضف أعضاء للفريق أولاً</p>
      </div>
    );
  }

  const weeks = rows[0]?.weeks ?? [];

  return (
    <div className="space-y-4" dir="rtl">
      <WorkspaceNav />
      <div>
        <h1 className="text-2xl font-semibold">عبء العمل</h1>
        <p className="text-sm text-muted-foreground">توزيع مهام الفريق للأسابيع الـ 8 القادمة</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-[220px] p-3 text-right">عضو الفريق</th>
              {weeks.map((week, index) => (
                <th key={week.weekStart} className="p-3 text-right">أسبوع {index + 1}</th>
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
                    <div className="text-xs">{week.taskCount} مهام</div>
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
          <p className="mb-2 font-medium">مهام {selected.member} — {selected.week}</p>
          {selected.tasks.length ? (
            <ul className="space-y-1 text-sm">
              {selected.tasks.map((task) => (
                <li key={task}>• {task}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد مهام في هذا الأسبوع.</p>
          )}
        </div>
      )}
    </div>
  );
}
