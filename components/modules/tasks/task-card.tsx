"use client";

import * as React from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_LABELS_EN,
  TASK_PRIORITY_BADGE_CLASS,
} from "@/types";
import { cn } from "@/lib/utils";
import { Clock, MoreHorizontal } from "lucide-react";
import type { TaskWithProject } from "@/actions/tasks";
import { AssigneeAvatars } from "@/components/dashboard/assignee-avatars";

function formatDate(d: string | null, locale: "ar" | "en") {
  if (!d) return null;
  try {
    const loc = locale === "en" ? "en-US" : "ar-EG";
    return new Date(d + "Z").toLocaleDateString(loc, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  try {
    return new Date(dueDate) < new Date(new Date().toDateString());
  } catch {
    return false;
  }
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${text}h`;
}

/** Cover first, then client logo; advances on `img` error so Radix Avatar never sticks on a broken URL. */
function TaskProjectThumbnail({
  projectName,
  coverUrl,
  logoUrl,
}: {
  projectName: string;
  coverUrl: string | null | undefined;
  logoUrl: string | null | undefined;
}) {
  const candidates = React.useMemo(() => {
    const c = coverUrl?.trim();
    const l = logoUrl?.trim();
    const list: string[] = [];
    if (c) list.push(c);
    if (l && l !== c) list.push(l);
    return list;
  }, [coverUrl, logoUrl]);

  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    setIdx(0);
  }, [coverUrl, logoUrl]);

  if (idx >= candidates.length) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-xs font-semibold shadow-sm">
        {(projectName || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote storage (ImageKit, etc.)
    <img
      src={candidates[idx]}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-lg border border-border/60 object-cover shadow-sm"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TaskCardProps = {
  task: TaskWithProject;
  assignees?: AssigneeForCard[];
  onEdit: () => void;
  onDelete: () => void;
  /** English copy and LTR-friendly menu (e.g. global tasks Kanban). */
  copyLocale?: "ar" | "en";
  /** Team members: show project name only (no link to project pages). */
  hideProjectLink?: boolean;
};

export function TaskCard({
  task,
  assignees = [],
  onEdit,
  onDelete,
  copyLocale = "ar",
  hideProjectLink = false,
}: TaskCardProps) {
  const overdue = isOverdue(task.dueDate);
  const dueStr = formatDate(task.dueDate, copyLocale);
  const subtaskCount = task.subtaskCount ?? 0;
  const prioLabel =
    copyLocale === "en"
      ? (TASK_PRIORITY_LABELS_EN[task.priority] ?? task.priority)
      : (TASK_PRIORITY_LABELS[task.priority] ?? task.priority);
  const loggedHours = Number(task.actualHours ?? 0);
  const showLoggedHours = Number.isFinite(loggedHours) && loggedHours > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      dir={copyLocale === "en" ? "ltr" : undefined}
      className="group relative rounded-xl border bg-card p-4 pe-11 shadow-sm transition-colors hover:bg-muted/40"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <p className="line-clamp-2 text-start font-semibold leading-snug tracking-tight">{task.title}</p>

      {hideProjectLink ? (
        <div className="text-muted-foreground mt-3 flex min-w-0 cursor-default items-center gap-3 rounded-lg py-1 text-start text-sm">
          <TaskProjectThumbnail
            projectName={task.projectName}
            coverUrl={task.projectCoverImageUrl}
            logoUrl={task.projectClientLogoUrl}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{task.projectName}</span>
        </div>
      ) : (
        <Link
          href={`/dashboard/projects/${task.projectId}`}
          className="text-muted-foreground hover:text-foreground mt-3 flex min-w-0 items-center gap-3 rounded-lg py-1 text-start text-sm transition-colors hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskProjectThumbnail
            projectName={task.projectName}
            coverUrl={task.projectCoverImageUrl}
            logoUrl={task.projectClientLogoUrl}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{task.projectName}</span>
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-border/50 pt-4">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-medium",
            TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "bg-muted"
          )}
        >
          {prioLabel}
        </span>
        {dueStr && (
          <span className={cn("text-xs tabular-nums", overdue && "font-medium text-red-600")}>
            {dueStr}
            {overdue && (copyLocale === "en" ? " (overdue)" : " (متأخر)")}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="text-muted-foreground text-xs">
            {copyLocale === "en"
              ? `${subtaskCount} subtask${subtaskCount !== 1 ? "s" : ""}`
              : `${subtaskCount} مهام فرعية`}
          </span>
        )}
        {showLoggedHours && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {formatHours(loggedHours)}
          </span>
        )}
        {assignees.length > 0 ? (
          <div className="ms-auto shrink-0">
            <AssigneeAvatars assignees={assignees} max={3} />
          </div>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute inset-e-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={copyLocale === "en" ? "end" : "start"}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={(e) => (e.stopPropagation(), onEdit())}>
            {copyLocale === "en" ? "Edit" : "تعديل"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => (e.stopPropagation(), onDelete())}
          >
            {copyLocale === "en" ? "Delete" : "حذف"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
