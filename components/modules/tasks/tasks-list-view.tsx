"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SortableDataTable, type TableColumnFilterMeta } from "@/components/ui/sortable-data-table";
import {
  TASK_STATUS_LABELS_EN,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGE_CLASS,
  TASK_PRIORITY_LABELS_EN,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE_CLASS,
  isTaskOverdue,
} from "@/types";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import type { TaskWithProject } from "@/actions/tasks";
import { updateTask, updateTaskStatus } from "@/actions/tasks";
import { assignTask, unassignTask } from "@/actions/assignments";
import { EntityTableShell } from "@/components/ui/entity-table-shell";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { ProjectSelectThumb, type ProjectPickerOption } from "@/components/entity-select-option";

const TASK_STATUS_VALUES = ["todo", "in_progress", "in_review", "done", "blocked"] as const;
const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];
type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];

const TASKS_LIST_AR = {
  searchByName: "البحث باسم المهمة",
  task: "المهمة",
  project: "المشروع",
  priority: "الأولوية",
  status: "الحالة",
  dueDate: "تاريخ الاستحقاق",
  assignees: "المعينون",
  allProjects: "جميع المشاريع",
  allPriorities: "جميع الأولويات",
  allStatuses: "جميع الحالات",
  overdueSuffix: " (متأخرة)",
  edit: "تعديل",
  delete: "حذف",
  clearDate: "مسح التاريخ",
  assignTeamMembers: "تعيين أعضاء الفريق",
  noTeamMembersAvailable: "لا يوجد أعضاء فريق متاحون.",
  manageAssigneesAria: "إدارة المعينين",
  priorityAria: "الأولوية",
  statusAria: "الحالة",
  noTasksFound: "لا توجد مهام.",
  couldNotUpdatePriority: "تعذّر تحديث الأولوية",
  couldNotUpdateStatus: "تعذّر تحديث الحالة",
  couldNotUpdateDueDate: "تعذّر تحديث تاريخ الاستحقاق",
  couldNotUpdateAssignees: "تعذّر تحديث المعينين",
  defaultView: "العرض الافتراضي",
  saveView: "حفظ العرض",
  deleteView: "حذف العرض",
  savedViewPlaceholder: "العروض المحفوظة",
  columns: "الأعمدة",
  noSorting: "بدون ترتيب",
  sortPlaceholder: "ترتيب",
  sortedBy: "مرتب حسب:",
  clearSortAria: "إزالة الترتيب",
  previous: "السابق",
  next: "التالي",
} as const;

const TASKS_LIST_EN = {
  searchByName: "Search by task name",
  task: "Task",
  project: "Project",
  priority: "Priority",
  status: "Status",
  dueDate: "Due Date",
  assignees: "Assignees",
  allProjects: "All projects",
  allPriorities: "All priorities",
  allStatuses: "All statuses",
  overdueSuffix: " (overdue)",
  edit: "Edit",
  delete: "Delete",
  clearDate: "Clear date",
  assignTeamMembers: "Assign team members",
  noTeamMembersAvailable: "No team members available.",
  manageAssigneesAria: "Manage assignees",
  priorityAria: "Priority",
  statusAria: "Status",
  noTasksFound: "No tasks found.",
  couldNotUpdatePriority: "Could not update priority",
  couldNotUpdateStatus: "Could not update status",
  couldNotUpdateDueDate: "Could not update due date",
  couldNotUpdateAssignees: "Could not update assignees",
  defaultView: "Default view",
  saveView: "Save view",
  deleteView: "Delete view",
  savedViewPlaceholder: "Saved view",
  columns: "Columns",
  noSorting: "No sorting",
  sortPlaceholder: "Sort",
  sortedBy: "Sorted by:",
  clearSortAria: "Clear sort",
  previous: "Previous",
  next: "Next",
} as const;

type TasksListLabels = typeof TASKS_LIST_EN | typeof TASKS_LIST_AR;

function formatDate(d: string | null, locale = "en-US") {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
};

export type TaskTableRow = TaskWithProject & { assigneeSortKey: string };

type ProjectFilterOption = ProjectPickerOption;

type TasksListViewProps = {
  tasks: TaskWithProject[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  projectOptions: ProjectFilterOption[];
  teamMembers?: TeamMember[];
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  /** Called after an inline field update so the parent can patch its tasks state. */
  onTaskPatched?: (id: string, patch: Partial<TaskWithProject>) => void;
  /** Called after an assignment change so the parent can refetch assigneesByTaskId. */
  onAssigneesRefresh?: () => void;
  memberView?: boolean;
  /**
   * When `memberView` is true, allow inline editing of a task's status and priority only.
   * Other cells (due date, assignees, delete) remain read-only.
   */
  memberCanEdit?: boolean;
};

const ALL = "__all__";

function titleFilterMeta(labels: TasksListLabels): TableColumnFilterMeta {
  return { variant: "text", placeholder: labels.searchByName };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline editable cells

type PriorityCellProps = {
  task: TaskTableRow;
  labels: Record<string, string>;
  editable: boolean;
  onPatched?: (id: string, patch: Partial<TaskWithProject>) => void;
  uiLabels: TasksListLabels;
};

function PriorityCell({ task, labels, editable, onPatched, uiLabels }: PriorityCellProps) {
  const [saving, setSaving] = React.useState(false);
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        TASK_PRIORITY_BADGE_CLASS[task.priority] ?? "",
        editable && "cursor-pointer hover:opacity-80",
        saving && "opacity-60"
      )}
    >
      {labels[task.priority] ?? task.priority}
    </Badge>
  );
  if (!editable) return badge;
  return (
    <Select
      value={task.priority}
      disabled={saving}
      onValueChange={async (v) => {
        const next = v as TaskPriorityValue;
        if (next === task.priority) return;
        const prev = task.priority;
        onPatched?.(task.id, { priority: next });
        setSaving(true);
        const res = await updateTask({ id: task.id, priority: next });
        setSaving(false);
        if (!res.ok) {
          onPatched?.(task.id, { priority: prev });
          toast.error(uiLabels.couldNotUpdatePriority);
        }
      }}
    >
      <SelectTrigger
        aria-label={uiLabels.priorityAria}
        hideChevron
        className={cn(
          "inline-flex h-auto w-auto min-h-0 items-center gap-1 rounded-md border-0 px-2 py-0.5 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0",
          TASK_PRIORITY_BADGE_CLASS[task.priority] ?? ""
        )}
      >
        <SelectValue>{labels[task.priority] ?? task.priority}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITY_VALUES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  p === "low" && "bg-gray-400",
                  p === "medium" && "bg-blue-500",
                  p === "high" && "bg-amber-500",
                  p === "urgent" && "bg-red-500"
                )}
              />
              {labels[p] ?? p}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type StatusCellProps = {
  task: TaskTableRow;
  labels: Record<string, string>;
  editable: boolean;
  onPatched?: (id: string, patch: Partial<TaskWithProject>) => void;
  uiLabels: TasksListLabels;
};

function StatusCell({ task, labels, editable, onPatched, uiLabels }: StatusCellProps) {
  const [saving, setSaving] = React.useState(false);
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        TASK_STATUS_BADGE_CLASS[task.status] ?? "",
        editable && "cursor-pointer hover:opacity-80",
        saving && "opacity-60"
      )}
    >
      {labels[task.status] ?? task.status}
    </Badge>
  );
  if (!editable) return badge;
  return (
    <Select
      value={task.status}
      disabled={saving}
      onValueChange={async (v) => {
        const next = v as TaskStatusValue;
        if (next === task.status) return;
        const prev = task.status;
        onPatched?.(task.id, { status: next });
        setSaving(true);
        const res = await updateTaskStatus(task.id, next);
        setSaving(false);
        if (!res.ok) {
          onPatched?.(task.id, { status: prev });
          toast.error(uiLabels.couldNotUpdateStatus);
        }
      }}
    >
      <SelectTrigger
        aria-label={uiLabels.statusAria}
        hideChevron
        className={cn(
          "inline-flex h-auto w-auto min-h-0 items-center gap-1 rounded-md border-0 px-2 py-0.5 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0",
          TASK_STATUS_BADGE_CLASS[task.status] ?? ""
        )}
      >
        <SelectValue>{labels[task.status] ?? task.status}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUS_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  s === "todo" && "bg-slate-400",
                  s === "in_progress" && "bg-blue-500",
                  s === "in_review" && "bg-purple-500",
                  s === "done" && "bg-emerald-500",
                  s === "blocked" && "bg-red-500"
                )}
              />
              {labels[s] ?? s}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type DueDateCellProps = {
  task: TaskTableRow;
  editable: boolean;
  onPatched?: (id: string, patch: Partial<TaskWithProject>) => void;
  uiLabels: TasksListLabels;
  dateLocale: string;
};

function DueDateCell({ task, editable, onPatched, uiLabels, dateLocale }: DueDateCellProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const overdue = isTaskOverdue(task.dueDate, task.status);
  const label = (
    <span className={cn("text-sm", overdue && "font-medium text-red-600")}>
      {formatDate(task.dueDate, dateLocale)}
      {overdue && uiLabels.overdueSuffix}
    </span>
  );
  if (!editable) return label;

  const selected = task.dueDate ? new Date(task.dueDate + "T12:00:00") : undefined;

  async function save(next: string | null) {
    if (next === task.dueDate) return;
    const prev = task.dueDate;
    onPatched?.(task.id, { dueDate: next });
    setSaving(true);
    const res = await updateTask({ id: task.id, dueDate: next ?? null });
    setSaving(false);
    if (!res.ok) {
      onPatched?.(task.id, { dueDate: prev });
      toast.error(uiLabels.couldNotUpdateDueDate);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-accent",
            overdue && "font-medium text-red-600",
            !task.dueDate && "text-muted-foreground",
            saving && "opacity-60"
          )}
        >
          {formatDate(task.dueDate, dateLocale)}
          {overdue && uiLabels.overdueSuffix}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            void save(d ? toIsoDate(d) : null);
            setOpen(false);
          }}
          initialFocus
        />
        {task.dueDate ? (
          <div className="flex items-center justify-end border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void save(null);
                setOpen(false);
              }}
            >
              {uiLabels.clearDate}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

type AssigneesCellProps = {
  task: TaskTableRow;
  assignees: AssigneeForCard[];
  editable: boolean;
  teamMembers: TeamMember[];
  onChanged?: () => void;
  uiLabels: TasksListLabels;
  popoverDir: "ltr" | "rtl";
};

function AssigneesCell({
  task,
  assignees,
  editable,
  teamMembers,
  onChanged,
  uiLabels,
  popoverDir,
}: AssigneesCellProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [localIds, setLocalIds] = React.useState<Set<string>>(
    () => new Set(assignees.map((a) => a.userId))
  );

  React.useEffect(() => {
    setLocalIds(new Set(assignees.map((a) => a.userId)));
  }, [assignees, task.id]);

  const members = assignees.map((a) => ({
    id: a.userId,
    name: a.name,
    avatarUrl: a.avatarUrl,
  }));

  const stack = (
    <AvatarStack members={members} max={3} direction={popoverDir} className="justify-start" />
  );
  if (!editable) return stack;

  async function handleToggle(member: TeamMember) {
    setPendingId(member.id);
    const was = localIds.has(member.id);
    const nextIds = new Set(localIds);
    if (was) nextIds.delete(member.id);
    else nextIds.add(member.id);
    setLocalIds(nextIds);
    const res = was
      ? await unassignTask(task.id, member.id)
      : await assignTask(task.id, member.id);
    setPendingId(null);
    if (!res.success) {
      setLocalIds(localIds);
      toast.error(res.error ?? uiLabels.couldNotUpdateAssignees);
      return;
    }
    onChanged?.();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent"
          aria-label={uiLabels.manageAssigneesAria}
        >
          {members.length === 0 ? (
            <span className="text-muted-foreground inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-sm">
              <Plus className="h-3.5 w-3.5" />
            </span>
          ) : (
            stack
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" dir={popoverDir}>
        <p className="text-muted-foreground mb-2 border-b px-2 pb-2 text-xs">
          {uiLabels.assignTeamMembers}
        </p>
        {teamMembers.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            {uiLabels.noTeamMembersAvailable}
          </p>
        ) : (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {teamMembers.map((m) => {
              const checked = localIds.has(m.id);
              const isPending = pendingId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void handleToggle(m)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition-colors",
                    checked
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary",
                    isPending && "opacity-60"
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">{initials(m.name || "?")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name || "—"}</p>
                    {m.email ? (
                      <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                    ) : null}
                  </div>
                  {checked ? (
                    <span className="text-primary shrink-0 text-xs">✓</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function TasksListView({
  tasks,
  assigneesByTaskId,
  projectOptions,
  teamMembers = [],
  onOpenTask,
  onDeleteTask,
  onTaskPatched,
  onAssigneesRefresh,
  memberView = false,
  memberCanEdit = false,
}: TasksListViewProps) {
  const editable = !memberView;
  const editableStatusPriority = editable || memberCanEdit;
  const statusLabels = memberView ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;
  const priorityLabels = memberView ? TASK_PRIORITY_LABELS : TASK_PRIORITY_LABELS_EN;
  const uiLabels: TasksListLabels = memberView ? TASKS_LIST_AR : TASKS_LIST_EN;
  const popoverDir: "ltr" | "rtl" = memberView ? "rtl" : "ltr";
  const dateLocale = memberView ? "ar-EG" : "en-US";
  const rows: TaskTableRow[] = React.useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        assigneeSortKey: (assigneesByTaskId[t.id] ?? [])
          .map((a) => a.name)
          .join(", ")
          .toLowerCase(),
      })),
    [tasks, assigneesByTaskId]
  );

  const statusFilterOptions = React.useMemo(
    () =>
      TASK_STATUS_VALUES.map((s) => ({
        value: s,
        label: statusLabels[s] ?? s,
      })),
    [statusLabels]
  );

  const priorityFilterOptions = React.useMemo(
    () =>
      TASK_PRIORITY_VALUES.map((p) => ({
        value: p,
        label: priorityLabels[p] ?? p,
      })),
    [priorityLabels]
  );

  const projectFilterMeta = React.useMemo((): TableColumnFilterMeta => {
    return {
      variant: "select",
      options: projectOptions.map((p) => ({ value: p.id, label: p.name })),
      allValue: ALL,
      allLabel: uiLabels.allProjects,
    };
  }, [projectOptions, uiLabels]);

  const assigneeFilterMeta = React.useMemo((): TableColumnFilterMeta => {
    return { variant: "text", placeholder: uiLabels.assignees };
  }, [uiLabels]);

  const taskTableColumns = React.useMemo<ColumnDef<TaskTableRow>[]>(() => {
    const cols: ColumnDef<TaskTableRow>[] = [
      {
        id: "drag",
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        size: 32,
      },
      {
        accessorKey: "title",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || String(filterValue).trim() === "") return true;
          const title = String(row.original.title ?? "").toLowerCase();
          return title.includes(String(filterValue).toLowerCase());
        },
        meta: { columnFilter: titleFilterMeta(uiLabels) },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.task}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="block text-start font-medium underline hover:no-underline"
            onClick={() => onOpenTask(row.original.id)}
          >
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "projectName",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.projectId === filterValue;
        },
        meta: { columnFilter: projectFilterMeta },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.project}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) =>
          memberView ? (
            <span className="text-muted-foreground inline-flex min-w-0 max-w-full items-center gap-2 text-sm">
              <ProjectSelectThumb
                coverImageUrl={row.original.projectCoverImageUrl}
                clientLogoUrl={row.original.projectClientLogoUrl}
                fallbackName={row.original.projectName}
                className="h-6 w-6"
              />
              <span className="truncate">{row.original.projectName}</span>
            </span>
          ) : (
            <Link
              href={`/dashboard/projects/${row.original.projectId}`}
              className="text-muted-foreground inline-flex min-w-0 max-w-full items-center gap-2 text-sm underline hover:text-foreground"
            >
              <ProjectSelectThumb
                coverImageUrl={row.original.projectCoverImageUrl}
                clientLogoUrl={row.original.projectClientLogoUrl}
                fallbackName={row.original.projectName}
                className="h-6 w-6"
              />
              <span className="truncate">{row.original.projectName}</span>
            </Link>
          ),
      },
      {
        accessorKey: "priority",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.priority === filterValue;
        },
        meta: {
          columnFilter: {
            variant: "select",
            options: priorityFilterOptions,
            allValue: ALL,
            allLabel: uiLabels.allPriorities,
          },
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.priority}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <PriorityCell
            task={row.original}
            labels={priorityLabels}
            editable={editableStatusPriority}
            onPatched={onTaskPatched}
            uiLabels={uiLabels}
          />
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || filterValue === "" || filterValue === ALL) return true;
          return row.original.status === filterValue;
        },
        meta: {
          columnFilter: {
            variant: "select",
            options: statusFilterOptions,
            allValue: ALL,
            allLabel: uiLabels.allStatuses,
          },
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.status}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <StatusCell
            task={row.original}
            labels={statusLabels}
            editable={editableStatusPriority}
            onPatched={onTaskPatched}
            uiLabels={uiLabels}
          />
        ),
      },
      {
        accessorKey: "dueDate",
        enableSorting: true,
        enableHiding: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.dueDate;
          const b = rowB.original.dueDate;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.dueDate}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <DueDateCell
            task={row.original}
            editable={editable}
            onPatched={onTaskPatched}
            uiLabels={uiLabels}
            dateLocale={dateLocale}
          />
        ),
      },
    ];

    if (!memberView) {
      cols.push({
        accessorKey: "assigneeSortKey",
        id: "assignees",
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue == null || String(filterValue).trim() === "") return true;
          return row.original.assigneeSortKey.includes(String(filterValue).toLowerCase());
        },
        meta: { columnFilter: assigneeFilterMeta },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-start">
              {uiLabels.assignees}{" "}
              {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <AssigneesCell
            task={row.original}
            assignees={assigneesByTaskId[row.original.id] ?? []}
            editable={editable}
            teamMembers={teamMembers}
            onChanged={onAssigneesRefresh}
            uiLabels={uiLabels}
            popoverDir={popoverDir}
          />
        ),
      });
    }

    cols.push({
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-start">
            <DropdownMenuItem onClick={() => onOpenTask(row.original.id)}>
              {uiLabels.edit}
            </DropdownMenuItem>
            {!memberView ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteTask(row.original.id)}
              >
                {uiLabels.delete}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return cols;
  }, [
    onOpenTask,
    onDeleteTask,
    onTaskPatched,
    onAssigneesRefresh,
    assigneesByTaskId,
    teamMembers,
    projectFilterMeta,
    priorityFilterOptions,
    statusFilterOptions,
    assigneeFilterMeta,
    memberView,
    editable,
    editableStatusPriority,
    statusLabels,
    priorityLabels,
    uiLabels,
    popoverDir,
    dateLocale,
  ]);

  return (
    <EntityTableShell
      title=""
      mobileContent={
        <div className="space-y-2 md:hidden">
          {rows.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-xl border p-4">
              <div className="min-w-0">
                <button
                  type="button"
                  className="block text-start font-medium hover:underline"
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.title}
                </button>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
                  <ProjectSelectThumb
                    coverImageUrl={task.projectCoverImageUrl}
                    clientLogoUrl={task.projectClientLogoUrl}
                    fallbackName={task.projectName}
                    className="h-6 w-6"
                  />
                  <span className="truncate">{task.projectName}</span>
                </p>
                <div className="mt-1">
                  <DueDateCell
                    task={task}
                    editable={editable}
                    onPatched={onTaskPatched}
                    uiLabels={uiLabels}
                    dateLocale={dateLocale}
                  />
                </div>
                {!memberView ? (
                  <div className="mt-1.5">
                    <AssigneesCell
                      task={task}
                      assignees={assigneesByTaskId[task.id] ?? []}
                      editable={editable}
                      teamMembers={teamMembers}
                      onChanged={onAssigneesRefresh}
                      uiLabels={uiLabels}
                      popoverDir={popoverDir}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusCell
                  task={task}
                  labels={statusLabels}
                  editable={editableStatusPriority}
                  onPatched={onTaskPatched}
                  uiLabels={uiLabels}
                />
                <PriorityCell
                  task={task}
                  labels={priorityLabels}
                  editable={editableStatusPriority}
                  onPatched={onTaskPatched}
                  uiLabels={uiLabels}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-start">
                    <DropdownMenuItem onClick={() => onOpenTask(task.id)}>
                      {uiLabels.edit}
                    </DropdownMenuItem>
                    {!memberView ? (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        {uiLabels.delete}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      }
      tableContent={
        <div className="hidden p-4 md:block">
          <SortableDataTable<TaskTableRow>
            columns={taskTableColumns}
            data={rows}
            tableId="tasks-table"
            getRowId={(t) => t.id}
            columnLabels={{
              title: uiLabels.task,
              projectName: uiLabels.project,
              priority: uiLabels.priority,
              status: uiLabels.status,
              dueDate: uiLabels.dueDate,
              assignees: uiLabels.assignees,
            }}
            uiVariant="clients"
            tableDir={memberView ? "rtl" : undefined}
            emptyStateMessage={uiLabels.noTasksFound}
            enablePagination
            pageSizeOptions={[10, 25, 50]}
            enableColumnFilterRow
            enableColumnVisibilityControl
            persistColumnVisibility
            enableSavedViews
            sortToolbarLabels={{
              none: uiLabels.noSorting,
              sortPlaceholder: uiLabels.sortPlaceholder,
              sortedBy: uiLabels.sortedBy,
              clearSortAria: uiLabels.clearSortAria,
            }}
            savedViewsLabels={{
              defaultView: uiLabels.defaultView,
              saveView: uiLabels.saveView,
              deleteView: uiLabels.deleteView,
              placeholder: uiLabels.savedViewPlaceholder,
            }}
            columnsLabel={uiLabels.columns}
            paginationLabels={
              memberView
                ? {
                    showing: ({ from, total, toSuffix }) => (
                      <>
                        عرض {from}
                        {toSuffix} من {total}
                      </>
                    ),
                    selected: (n) => <>({n} محدد)</>,
                    perPage: (n) => <>{n} / صفحة</>,
                    pagePosition: ({ current, total }) => (
                      <>
                        صفحة {current} من {total}
                      </>
                    ),
                    previous: uiLabels.previous,
                    next: uiLabels.next,
                  }
                : undefined
            }
          />
        </div>
      }
    />
  );
}
