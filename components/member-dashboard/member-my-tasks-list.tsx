"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_BADGE_CLASS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
} from "@/types";
import type { WorkspaceMyTaskGroups, WorkspaceMyTaskRow } from "@/actions/workspace";

type MemberMyTasksListProps = {
  groups: WorkspaceMyTaskGroups;
};

const SECTION_ORDER: Array<{ key: keyof WorkspaceMyTaskGroups; label: string; tone: string }> = [
  { key: "overdue", label: "متأخرة", tone: "text-red-600" },
  { key: "today", label: "اليوم", tone: "text-primary" },
  { key: "tomorrow", label: "غداً", tone: "text-foreground" },
  { key: "this_week", label: "هذا الأسبوع", tone: "text-foreground" },
  { key: "later", label: "لاحقًا", tone: "text-muted-foreground" },
  { key: "no_date", label: "بدون موعد", tone: "text-muted-foreground" },
];

function formatDate(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("ar-EG", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function MemberMyTasksList({ groups }: MemberMyTasksListProps) {
  const nonEmpty = SECTION_ORDER.filter((s) => (groups[s.key]?.length ?? 0) > 0);

  if (nonEmpty.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm">
        لا توجد مهام مسندة إليك حالياً.
      </p>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {nonEmpty.map((section) => (
        <section key={section.key} className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <h4 className={cn("text-sm font-semibold", section.tone)}>
              {section.label}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                ({groups[section.key].length})
              </span>
            </h4>
          </div>
          <ul className="space-y-2">
            {groups[section.key].map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TaskRow({ task }: { task: WorkspaceMyTaskRow }) {
  return (
    <li className="rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{task.title}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {task.projectName}
            {task.clientName ? ` · ${task.clientName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {task.dueDate ? (
            <span className="text-muted-foreground text-[11px]">{formatDate(task.dueDate)}</span>
          ) : null}
          <Badge
            variant="secondary"
            className={cn("text-[10px]", TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "")}
          >
            {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
          </Badge>
          <Badge
            variant="secondary"
            className={cn("text-[10px]", TASK_STATUS_BADGE_CLASS[task.status] ?? "")}
          >
            {TASK_STATUS_LABELS[task.status] ?? task.status}
          </Badge>
        </div>
      </div>
    </li>
  );
}
