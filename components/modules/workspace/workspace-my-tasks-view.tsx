"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlignLeft,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock,
  Flag,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  SquareArrowOutUpRight,
  UserCircle,
} from "lucide-react";
import { updateTaskStatus } from "@/actions/tasks";
import type { WorkspaceMyTaskGroups, WorkspaceMyTaskRow } from "@/actions/workspace";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import {
  ProjectSelectOptionRow,
  TeamMemberSelectOptionRow,
  type ProjectPickerOption,
} from "@/components/entity-select-option";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DUE_SECTION_KEYS = [
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "later",
  "no_date",
] as const;

type DueSectionKey = (typeof DUE_SECTION_KEYS)[number];

const SECTION_CONFIG: Record<DueSectionKey, { label: string; color: string }> = {
  overdue: { label: "Overdue", color: "#ef4444" },
  today: { label: "Today", color: "#3b82f6" },
  tomorrow: { label: "Tomorrow", color: "#8b5cf6" },
  this_week: { label: "This Week", color: "#f59e0b" },
  later: { label: "Later", color: "#9ca3af" },
  no_date: { label: "No Date", color: "#d1d5db" },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  todo: { label: "To Do", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-300", dot: "bg-gray-400" },
  in_progress: { label: "In Progress", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  in_review: { label: "In Review", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  done: { label: "Done", bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  blocked: { label: "Blocked", bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: "Low", bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400" },
  medium: { label: "Medium", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-500 dark:text-blue-400" },
  high: { label: "High", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  urgent: { label: "Urgent", bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400" },
};

const COLUMNS = [
  { key: "task", label: "Task", icon: AlignLeft, className: "flex-1 min-w-[280px]" },
  { key: "project", label: "Project", icon: FolderOpen, className: "w-[200px] hidden md:flex" },
  { key: "status", label: "Status", icon: CircleDot, className: "w-[130px]" },
  { key: "priority", label: "Priority", icon: Flag, className: "w-[110px]" },
  { key: "assignee", label: "Assignee", icon: UserCircle, className: "w-[120px] hidden lg:flex" },
  { key: "dueDate", label: "Due Date", icon: CalendarDays, className: "w-[120px]" },
  { key: "hours", label: "Hours", icon: Clock, className: "w-[80px] hidden lg:flex" },
] as const;

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate + "T12:00:00");
  return d < today;
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function emptyGroups(): WorkspaceMyTaskGroups {
  return {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    no_date: [],
  };
}

function initialOpenSections(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  for (const k of DUE_SECTION_KEYS) o[k] = true;
  return o;
}

type TeamMemberInput = { id: string; name: string; avatarUrl?: string | null; role?: string | null };

const ASSIGNEE_FILTER_UNASSIGNED = "__unassigned__";

function ymd(d: string | Date | null | undefined): string | null {
  if (d == null || d === "") return null;
  if (d instanceof Date) return format(d, "yyyy-MM-dd");
  const s = typeof d === "string" ? d : String(d);
  return s.slice(0, 10);
}

export function WorkspaceMyTasksView({
  groups,
  teamMembers,
  projects,
}: {
  groups: WorkspaceMyTaskGroups;
  teamMembers: TeamMemberInput[];
  projects: ProjectPickerOption[];
}) {
  const router = useRouter();

  const panelTeamMembers = React.useMemo(
    () =>
      teamMembers.map((m) => ({
        id: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl ?? null,
        role: m.role ?? null,
      })),
    [teamMembers]
  );
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(initialOpenSections);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newDefaultDate, setNewDefaultDate] = React.useState<string | undefined>();
  const [selectedTask, setSelectedTask] = React.useState<WorkspaceMyTaskRow | null>(null);
  const [localGroups, setLocalGroups] = React.useState<WorkspaceMyTaskGroups>(groups);

  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = React.useState<
    "all" | "low" | "medium" | "high" | "urgent"
  >("all");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");
  /** Lower bound (start, or due if no start); upper bound (due). */
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [groupMode, setGroupMode] = React.useState<"due" | "project">("due");

  React.useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  const passesFilters = React.useCallback(
    (task: WorkspaceMyTaskRow) => {
      if (statusFilter === "active" && task.status === "done") return false;
      if (statusFilter === "completed" && task.status !== "done") return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (projectFilter !== "all" && task.projectId !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === ASSIGNEE_FILTER_UNASSIGNED) {
          if (task.assigneeId != null) return false;
        } else if (task.assigneeId !== assigneeFilter) {
          return false;
        }
      }
      const st = ymd(task.startDate);
      const du = ymd(task.dueDate);
      if (dateFrom) {
        const lower = st ?? du;
        if (!lower || lower < dateFrom) return false;
      }
      if (dateTo && (!du || du > dateTo)) return false;
      return true;
    },
    [
      statusFilter,
      priorityFilter,
      projectFilter,
      assigneeFilter,
      dateFrom,
      dateTo,
    ]
  );

  const filteredGroups = React.useMemo(() => {
    const next = emptyGroups();
    for (const k of DUE_SECTION_KEYS) {
      next[k] = localGroups[k].filter(passesFilters);
    }
    return next;
  }, [localGroups, passesFilters]);

  const stats = React.useMemo(() => {
    const flat = DUE_SECTION_KEYS.flatMap((k) => filteredGroups[k]);
    const total = flat.length;
    const overdue = flat.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const dueToday = flat.filter((t) => isDueToday(t.dueDate)).length;
    return { total, overdue, dueToday };
  }, [filteredGroups]);

  const hasExtraFilters =
    assigneeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const projectSections = React.useMemo(() => {
    const list = DUE_SECTION_KEYS.flatMap((k) => filteredGroups[k]);
    const map = new Map<string, WorkspaceMyTaskRow[]>();
    for (const t of list) {
      const name = t.projectName?.trim() || "No project";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredGroups]);

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleStatusToggle(taskId: string, checked: boolean | "indeterminate") {
    const newStatus = checked ? "done" : "todo";
    const res = await updateTaskStatus(taskId, newStatus);
    if (!res.ok) return toast.error("Failed to update task status.");
    if (newStatus === "done") {
      setLocalGroups((prev) => {
        const next = { ...prev };
        for (const k of DUE_SECTION_KEYS) {
          next[k] = prev[k].filter((t) => t.id !== taskId);
        }
        return next;
      });
    }
    router.refresh();
  }

  function openNewTaskForSection(sectionKey: string) {
    const today = new Date().toISOString().slice(0, 10);
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tomorrow = t.toISOString().slice(0, 10);
    const dateMap: Record<string, string | undefined> = {
      today,
      tomorrow,
      this_week: undefined,
      later: undefined,
      no_date: undefined,
      overdue: undefined,
    };
    setNewDefaultDate(dateMap[sectionKey]);
    setNewOpen(true);
  }

  function toPanelTask(task: WorkspaceMyTaskRow) {
    return {
      id: task.id,
      title: task.title,
      status: task.status as "todo" | "in_progress" | "in_review" | "done" | "blocked",
      priority: task.priority as "low" | "medium" | "high" | "urgent",
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      description: task.description,
      assigneeId: task.assigneeId,
    };
  }

  function renderTaskRow(task: WorkspaceMyTaskRow) {
    const overdue = isOverdue(task.dueDate, task.status);
    const dueToday = isDueToday(task.dueDate);
    const hours = Number(task.actualHours ?? 0);
    const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
    const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

    return (
      <div
        key={task.id}
        className="group flex cursor-pointer items-center border-b border-border transition-colors last:border-b-0 hover:bg-muted/20"
        onClick={() => setSelectedTask(task)}
      >
        <div className={cn("flex items-center gap-2 border-r border-border px-3 py-2", COLUMNS[0].className)}>
          <Checkbox
            className="shrink-0"
            checked={task.status === "done"}
            onCheckedChange={(checked) => handleStatusToggle(task.id, checked)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="truncate text-sm text-foreground" dir="auto">
            {task.title}
          </span>
          <SquareArrowOutUpRight
            size={12}
            className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60"
          />
        </div>
        <div className={cn("flex items-center border-r border-border px-3 py-2", COLUMNS[1].className)}>
          {task.projectName ? (
            <span className="truncate text-sm text-muted-foreground">{task.projectName}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>
        <div className={cn("flex items-center border-r border-border px-3 py-2", COLUMNS[2].className)}>
          <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", sc.bg, sc.text)}>
            <span className={cn("mr-1.5 size-1.5 rounded-full", sc.dot)} />
            {sc.label}
          </span>
        </div>
        <div className={cn("flex items-center border-r border-border px-3 py-2", COLUMNS[3].className)}>
          <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", pc.bg, pc.text)}>
            {pc.label}
          </span>
        </div>
        <div className={cn("flex items-center border-r border-border px-3 py-2", COLUMNS[4].className)}>
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5">
              {task.assigneeAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={task.assigneeAvatarUrl} alt="" className="size-5 rounded-full object-cover" />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                  {task.assigneeName[0]}
                </div>
              )}
              <span className="truncate text-sm text-muted-foreground">{task.assigneeName}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground/40">—</span>
          )}
        </div>
        <div className={cn("flex items-center border-r border-border px-3 py-2", COLUMNS[5].className)}>
          {task.dueDate ? (
            <span
              className={cn(
                "text-sm",
                overdue && "font-medium text-red-500",
                dueToday && !overdue && "font-medium text-amber-500",
                !overdue && !dueToday && "text-muted-foreground"
              )}
            >
              {formatDate(task.dueDate)}
            </span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>
        <div className={cn("flex items-center px-3 py-2", COLUMNS[6].className)}>
          {hours > 0 ? (
            <span className="text-sm text-muted-foreground">{hours}h</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>
      </div>
    );
  }

  function renderSectionHeader(sectionKey: string, label: string, color: string, count: number) {
    const isOpen = openSections[sectionKey] !== false;
    return (
      <div
        className="flex cursor-pointer select-none items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5 transition-colors hover:bg-muted/30"
        onClick={() => toggleSection(sectionKey)}
      >
        <ChevronDown
          size={14}
          className="text-muted-foreground transition-transform"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="ml-1 text-xs text-muted-foreground">{count}</span>
      </div>
    );
  }

  return (
    <div dir="ltr" lang="en" className="min-h-screen w-full bg-background">
      <WorkspaceNav />

      <div className="mb-4 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">My Tasks</h1>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setNewOpen(true)}
        >
          <Plus size={14} />
          New Task
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 px-2 text-sm tabular-nums">
        <span className="text-muted-foreground">
          Total: <span className="font-medium text-foreground">{stats.total}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Overdue: <span className="font-medium text-destructive">{stats.overdue}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Due today: <span className="font-medium text-foreground">{stats.dueToday}</span>
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-3 px-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Priority</span>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Assignee</span>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value={ASSIGNEE_FILTER_UNASSIGNED} textValue="Unassigned">
                Unassigned
              </SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id} textValue={m.name}>
                  <TeamMemberSelectOptionRow
                    avatarUrl={m.avatarUrl}
                    name={m.name}
                    secondary={m.role ?? undefined}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Project</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} textValue={p.name}>
                  <ProjectSelectOptionRow
                    coverImageUrl={p.coverImageUrl}
                    clientLogoUrl={p.clientLogoUrl}
                    name={p.name}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto">
          <span className="me-1 self-center text-xs font-medium text-muted-foreground">Date</span>
          <span className="self-center text-xs text-muted-foreground">from</span>
          <DatePickerAr
            className="h-8 w-[150px] shrink-0"
            popoverAlign="start"
            placeholder="Start"
            value={dateFrom ? new Date(dateFrom + "T12:00:00") : undefined}
            onChange={(d) => setDateFrom(d ? format(d, "yyyy-MM-dd") : "")}
          />
          <span className="self-center text-xs text-muted-foreground">to</span>
          <DatePickerAr
            className="h-8 w-[150px] shrink-0"
            popoverAlign="start"
            placeholder="Due"
            value={dateTo ? new Date(dateTo + "T12:00:00") : undefined}
            onChange={(d) => setDateTo(d ? format(d, "yyyy-MM-dd") : "")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Group by</span>
          <div className="flex rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={groupMode === "due" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setGroupMode("due")}
            >
              <List size={12} />
              Due date
            </Button>
            <Button
              type="button"
              variant={groupMode === "project" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setGroupMode("project")}
            >
              <LayoutGrid size={12} />
              Project
            </Button>
          </div>
        </div>
        {hasExtraFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setAssigneeFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear assignee and date filters
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border px-2 pb-6">
        <div className="flex items-center border-b border-border bg-muted/30">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className={cn(
                "flex items-center gap-1.5 border-r border-border px-3 py-2 text-xs font-medium text-muted-foreground select-none last:border-r-0",
                col.className
              )}
            >
              <col.icon size={12} className="shrink-0" />
              {col.label}
            </div>
          ))}
        </div>

        {groupMode === "due"
          ? DUE_SECTION_KEYS.map((sectionKey) => {
              const list = filteredGroups[sectionKey];
              const isOpen = openSections[sectionKey] !== false;
              const config = SECTION_CONFIG[sectionKey];
              return (
                <React.Fragment key={sectionKey}>
                  {renderSectionHeader(sectionKey, config.label, config.color, list.length)}
                  {isOpen && list.length === 0 && (
                    <div className="flex items-center border-b border-border px-3 py-3">
                      <span className="pl-6 text-sm text-muted-foreground">No tasks in this section.</span>
                    </div>
                  )}
                  {isOpen && list.map((task) => renderTaskRow(task))}
                  {isOpen && (
                    <div
                      className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                      onClick={() => openNewTaskForSection(sectionKey)}
                    >
                      <Plus size={14} />
                      New task
                    </div>
                  )}
                </React.Fragment>
              );
            })
          : projectSections.map(([projectName, list]) => {
              const sectionKey = `p:${projectName}`;
              const isOpen = openSections[sectionKey] !== false;
              return (
                <React.Fragment key={sectionKey}>
                  {renderSectionHeader(sectionKey, projectName, "#6366f1", list.length)}
                  {isOpen && list.length === 0 && (
                    <div className="flex items-center border-b border-border px-3 py-3">
                      <span className="pl-6 text-sm text-muted-foreground">No tasks.</span>
                    </div>
                  )}
                  {isOpen && list.map((task) => renderTaskRow(task))}
                  {isOpen && (
                    <div
                      className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                      onClick={() => setNewOpen(true)}
                    >
                      <Plus size={14} />
                      New task
                    </div>
                  )}
                </React.Fragment>
              );
            })}

        {groupMode === "project" && projectSections.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No tasks match the current filters.</div>
        )}
      </div>

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        teamMembers={panelTeamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
        }))}
        defaultDueDate={newDefaultDate}
        onSuccess={() => router.refresh()}
      />
      <TaskDetailPanel
        task={selectedTask ? toPanelTask(selectedTask) : null}
        teamMembers={panelTeamMembers}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}
