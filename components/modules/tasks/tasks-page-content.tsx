"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTasks, deleteTask, updateTaskStatus } from "@/actions/tasks";
import { getAssigneesForTaskIds } from "@/actions/assignments";
import { toast } from "sonner";
import type { TaskWithProject, GetTasksFilters } from "@/actions/tasks";
import { TasksKanban, type KanbanStatus } from "./tasks-kanban";
import { TasksListView } from "./tasks-list-view";
import { TasksCalendarView } from "./tasks-calendar-view";
import { NewTaskModal } from "./new-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { CalendarDays, ChevronDown, LayoutGrid, List, Plus, X } from "lucide-react";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { TASK_STATUS_LABELS_EN, TASK_PRIORITY_LABELS_EN } from "@/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ProjectSelectOptionRow,
  type ProjectPickerOption,
} from "@/components/entity-select-option";
import { DateRangePickerAr } from "@/components/ui/date-picker-ar";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type ProjectOption = ProjectPickerOption & {
  /** `projects.status` – used to surface active projects at the top of the filter. */
  status?: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
};

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type TasksPageContentProps = {
  initialTasks: TaskWithProject[];
  projects: ProjectOption[];
  teamMembers: TeamMember[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
  memberView?: boolean;
  /** Logged-in member's team_member id (workspace only). Used for self-assigned new tasks. */
  memberTeamMemberId?: string | null;
};

const PRIORITY_OPTIONS_EN = [
  { value: "all", label: "All priorities" },
  { value: "low", label: TASK_PRIORITY_LABELS_EN.low },
  { value: "medium", label: TASK_PRIORITY_LABELS_EN.medium },
  { value: "high", label: TASK_PRIORITY_LABELS_EN.high },
  { value: "urgent", label: TASK_PRIORITY_LABELS_EN.urgent },
] as const;

const STATUS_OPTIONS_EN = [
  { value: "all", label: "All statuses" },
  { value: "todo", label: TASK_STATUS_LABELS_EN.todo },
  { value: "in_progress", label: TASK_STATUS_LABELS_EN.in_progress },
  { value: "in_review", label: TASK_STATUS_LABELS_EN.in_review },
  { value: "done", label: TASK_STATUS_LABELS_EN.done },
  { value: "blocked", label: TASK_STATUS_LABELS_EN.blocked },
] as const;

const PRIORITY_OPTIONS_AR = [
  { value: "all", label: "جميع الأولويات" },
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "عالي" },
  { value: "urgent", label: "عاجل" },
] as const;

const STATUS_OPTIONS_AR = [
  { value: "all", label: "جميع الحالات" },
  { value: "todo", label: "للتنفيذ" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "in_review", label: "قيد المراجعة" },
  { value: "done", label: "مكتمل" },
  { value: "blocked", label: "محظور" },
] as const;

/** Priority color dots (match list / Kanban inline editors). */
const PRIORITY_DOT_CLASS: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

function memberInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function PriorityFilterDot({ value }: { value: string }) {
  if (value === "all") {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/35"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        PRIORITY_DOT_CLASS[value] ?? "bg-muted-foreground/40"
      )}
      aria-hidden
    />
  );
}

const TASKS_AR = {
  tasks: "المهام",
  kanban: "كانبان",
  list: "قائمة",
  calendar: "تقويم",
  newTask: "مهمة جديدة",
  searchPlaceholder: "البحث باسم المهمة",
  allProjects: "جميع المشاريع",
  allMembers: "كل الأعضاء",
  deleteTitle: "حذف هذه المهمة؟",
  deleteDesc: "سيتم حذف المهمة. لا يمكن التراجع عن هذا الإجراء.",
  cancel: "إلغاء",
  delete: "حذف",
  dueRange: "مدى تاريخ الاستحقاق",
  dueRangePlaceholder: "اختر البداية والنهاية",
  clearDates: "مسح التواريخ",
  filterProjects: "المشاريع",
  filterPriorities: "الأولوية",
  filterStatuses: "الحالة",
  filterMembers: "الأعضاء",
  clearSelection: "مسح التحديد",
  nProjects: "{n} مشاريع",
  nPriorities: "{n} أولويات",
  nStatuses: "{n} حالات",
  nMembers: "{n} أعضاء",
  activeProjects: "المشاريع النشطة",
  otherProjects: "مشاريع أخرى",
};

const FILTER_EN = {
  projects: "Projects",
  priorities: "Priority",
  statuses: "Status",
  members: "Members",
  clearSelection: "Clear selection",
  activeProjects: "Active projects",
  otherProjects: "Other projects",
};

export function TasksPageContent({
  initialTasks,
  projects,
  teamMembers,
  assigneesByTaskId: initialAssigneesByTaskId,
  memberView = false,
  memberTeamMemberId = null,
}: TasksPageContentProps) {
  const router = useRouter();
  const translateErr = useTranslateActionError();

  const [tasks, setTasks] = React.useState<TaskWithProject[]>(initialTasks);
  const [assigneesByTaskId, setAssigneesByTaskId] =
    React.useState<Record<string, AssigneeForCard[]>>(initialAssigneesByTaskId);
  const [viewMode, setViewMode] = React.useState<"kanban" | "list" | "calendar">("kanban");
  const [search, setSearch] = React.useState("");
  const [projectFilters, setProjectFilters] = React.useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = React.useState<string[]>([]);
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [memberFilters, setMemberFilters] = React.useState<string[]>([]);
  const [filterPopover, setFilterPopover] = React.useState<
    null | "project" | "priority" | "status" | "member"
  >(null);
  const [dueRange, setDueRange] = React.useState<DateRange | undefined>(undefined);
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = React.useState<
    "todo" | "in_progress" | "in_review" | "done" | "blocked"
  >("todo");
  const [taskDetailId, setTaskDetailId] = React.useState<string | null>(null);
  const [taskIdToDelete, setTaskIdToDelete] = React.useState<string | null>(null);

  React.useEffect(() => {
    setAssigneesByTaskId(initialAssigneesByTaskId);
  }, [initialAssigneesByTaskId]);

  const syncAssigneesForTasks = React.useCallback((taskList: TaskWithProject[]) => {
    const ids = taskList.map((t) => t.id);
    if (ids.length === 0) {
      setAssigneesByTaskId({});
      return;
    }
    getAssigneesForTaskIds(ids).then((res) => {
      if (res.data) setAssigneesByTaskId(res.data);
    });
  }, []);

  const refetch = React.useCallback(() => {
    getTasks({
      search: search.trim() || undefined,
      projectIds: projectFilters.length ? projectFilters : undefined,
      priorities: priorityFilters.length
        ? (priorityFilters as GetTasksFilters["priorities"])
        : undefined,
      statuses: statusFilters.length ? (statusFilters as GetTasksFilters["statuses"]) : undefined,
      teamMemberIds: memberFilters.length ? memberFilters : undefined,
      dueDateFrom: dueRange?.from ? formatCalendarDate(dueRange.from) : undefined,
      dueDateTo: dueRange?.to ? formatCalendarDate(dueRange.to) : undefined,
    } as GetTasksFilters).then((res) => {
      if (res.ok) {
        setTasks(res.data);
        syncAssigneesForTasks(res.data);
      } else {
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(isDbErrorKey(err) ? translateErr(err) : err || "Could not load tasks");
      }
    });
    router.refresh();
  }, [
    search,
    projectFilters,
    priorityFilters,
    statusFilters,
    memberFilters,
    dueRange,
    router,
    syncAssigneesForTasks,
    translateErr,
  ]);

  const dueFromKey = dueRange?.from ? formatCalendarDate(dueRange.from) : "";
  const dueToKey = dueRange?.to ? formatCalendarDate(dueRange.to) : "";

  const projectKey = [...projectFilters].sort().join("\0");
  const priorityKey = [...priorityFilters].sort().join("\0");
  const statusKey = [...statusFilters].sort().join("\0");
  const memberKey = [...memberFilters].sort().join("\0");

  const filtersRef = React.useRef({
    search,
    projectKey,
    priorityKey,
    statusKey,
    memberKey,
    dueFromKey,
    dueToKey,
  });
  React.useEffect(() => {
    const prev = filtersRef.current;
    const same =
      prev.search === search &&
      prev.projectKey === projectKey &&
      prev.priorityKey === priorityKey &&
      prev.statusKey === statusKey &&
      prev.memberKey === memberKey &&
      prev.dueFromKey === dueFromKey &&
      prev.dueToKey === dueToKey;
    filtersRef.current = {
      search,
      projectKey,
      priorityKey,
      statusKey,
      memberKey,
      dueFromKey,
      dueToKey,
    };
    if (same) return;
    getTasks({
      search: search.trim() || undefined,
      projectIds: projectFilters.length ? projectFilters : undefined,
      priorities: priorityFilters.length
        ? (priorityFilters as GetTasksFilters["priorities"])
        : undefined,
      statuses: statusFilters.length ? (statusFilters as GetTasksFilters["statuses"]) : undefined,
      teamMemberIds: memberFilters.length ? memberFilters : undefined,
      dueDateFrom: dueRange?.from ? formatCalendarDate(dueRange.from) : undefined,
      dueDateTo: dueRange?.to ? formatCalendarDate(dueRange.to) : undefined,
    } as GetTasksFilters).then((res) => {
      if (res.ok) {
        setTasks(res.data);
        syncAssigneesForTasks(res.data);
      } else {
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(isDbErrorKey(err) ? translateErr(err) : err || "Could not load tasks");
      }
    });
  }, [
    search,
    projectKey,
    projectFilters,
    priorityKey,
    priorityFilters,
    statusKey,
    statusFilters,
    memberKey,
    memberFilters,
    dueFromKey,
    dueToKey,
    syncAssigneesForTasks,
    translateErr,
  ]);

  const sortedTeamMembers = React.useMemo(
    () => [...teamMembers].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [teamMembers]
  );

  const statusOptionsMulti = React.useMemo(
    () => (memberView ? STATUS_OPTIONS_AR : STATUS_OPTIONS_EN).filter((o) => o.value !== "all"),
    [memberView]
  );

  const priorityOptionsMulti = React.useMemo(
    () => (memberView ? PRIORITY_OPTIONS_AR : PRIORITY_OPTIONS_EN).filter((o) => o.value !== "all"),
    [memberView]
  );

  const sortedProjects = React.useMemo(() => {
    const locale = memberView ? "ar" : undefined;
    const compareByName = (a: ProjectOption, b: ProjectOption) =>
      (a.name || "").localeCompare(b.name || "", locale, { sensitivity: "base" });
    const active: ProjectOption[] = [];
    const other: ProjectOption[] = [];
    for (const p of projects) {
      if (p.status === "active") active.push(p);
      else other.push(p);
    }
    active.sort(compareByName);
    other.sort(compareByName);
    return { active, other };
  }, [projects, memberView]);

  const projectSummary = React.useMemo(() => {
    if (projectFilters.length === 0) return memberView ? TASKS_AR.allProjects : "All projects";
    if (projectFilters.length === 1) {
      return projects.find((p) => p.id === projectFilters[0])?.name ?? "—";
    }
    return memberView
      ? TASKS_AR.nProjects.replace("{n}", String(projectFilters.length))
      : `${projectFilters.length} projects`;
  }, [projectFilters, projects, memberView]);

  const prioritySummary = React.useMemo(() => {
    const allLabel = memberView ? PRIORITY_OPTIONS_AR[0].label : PRIORITY_OPTIONS_EN[0].label;
    if (priorityFilters.length === 0) return allLabel;
    if (priorityFilters.length === 1) {
      const row = priorityOptionsMulti.find((x) => x.value === priorityFilters[0]);
      return row?.label ?? priorityFilters[0];
    }
    return memberView
      ? TASKS_AR.nPriorities.replace("{n}", String(priorityFilters.length))
      : `${priorityFilters.length} priorities`;
  }, [priorityFilters, priorityOptionsMulti, memberView]);

  const statusSummary = React.useMemo(() => {
    const allStatusesLabel = memberView ? STATUS_OPTIONS_AR[0].label : STATUS_OPTIONS_EN[0].label;
    if (statusFilters.length === 0) return allStatusesLabel;
    if (statusFilters.length === 1) {
      const row = statusOptionsMulti.find((x) => x.value === statusFilters[0]);
      return row?.label ?? statusFilters[0];
    }
    return memberView
      ? TASKS_AR.nStatuses.replace("{n}", String(statusFilters.length))
      : `${statusFilters.length} statuses`;
  }, [statusFilters, statusOptionsMulti, memberView]);

  const memberSummary = React.useMemo(() => {
    if (memberFilters.length === 0) return memberView ? TASKS_AR.allMembers : "All members";
    if (memberFilters.length === 1) {
      const m = sortedTeamMembers.find((x) => x.id === memberFilters[0]);
      return m?.name || m?.email || m?.id || "—";
    }
    return memberView
      ? TASKS_AR.nMembers.replace("{n}", String(memberFilters.length))
      : `${memberFilters.length} members`;
  }, [memberFilters, sortedTeamMembers, memberView]);

  const handleAddTask = (status?: "todo" | "in_progress" | "in_review" | "done" | "blocked") => {
    setNewTaskDefaultStatus(status ?? "todo");
    setNewTaskOpen(true);
  };

  const handleDeleteTask = (id: string) => {
    setTaskIdToDelete(id);
  };

  const handleTaskStatusMove = React.useCallback(
    async (taskId: string, newStatus: KanbanStatus) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;
      const previousStatus = task.status;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      const res = await updateTaskStatus(taskId, newStatus);
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)));
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(isDbErrorKey(err) ? translateErr(err) : err || "Could not update status");
        return;
      }
      toast.success(memberView ? "تم تحديث الحالة" : "Status updated");
    },
    [tasks, translateErr, memberView]
  );

  const confirmDelete = () => {
    if (!taskIdToDelete) return;
    deleteTask(taskIdToDelete).then((res) => {
      if (res.ok) {
        setTaskIdToDelete(null);
        toast.success("Task deleted");
        refetch();
      } else {
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(isDbErrorKey(err) ? translateErr(err) : err);
      }
    });
  };

  const filteredTasksForList = tasks;
  const dir = memberView ? "rtl" : "ltr";

  return (
    <div dir={dir} lang={memberView ? "ar" : "en"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{memberView ? TASKS_AR.tasks : "Tasks"}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            title={memberView ? TASKS_AR.kanban : "Kanban"}
          >
            <LayoutGrid className="me-1 h-4 w-4" />
            {memberView ? TASKS_AR.kanban : "Kanban"}
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            title={memberView ? TASKS_AR.list : "List"}
          >
            <List className="me-1 h-4 w-4" />
            {memberView ? TASKS_AR.list : "List"}
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            title={memberView ? TASKS_AR.calendar : "Calendar"}
          >
            <CalendarDays className="me-1 h-4 w-4" />
            {memberView ? TASKS_AR.calendar : "Calendar"}
          </Button>
          <Button onClick={() => handleAddTask()}>
            <Plus className="me-1 h-4 w-4" />
            {memberView ? TASKS_AR.newTask : "New task"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={memberView ? TASKS_AR.searchPlaceholder : "Search by task name"}
          className="w-full sm:max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Popover
          open={filterPopover === "project"}
          onOpenChange={(o) => setFilterPopover(o ? "project" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-between font-normal sm:w-[200px]"
              aria-label={memberView ? TASKS_AR.filterProjects : FILTER_EN.projects}
            >
              <span className="truncate">{projectSummary}</span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start" dir={dir}>
            <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
              {memberView ? TASKS_AR.filterProjects : FILTER_EN.projects}
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-0 p-2">
                {sortedProjects.active.length > 0 ? (
                  <div
                    className="text-muted-foreground px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide"
                    aria-hidden
                  >
                    {memberView ? TASKS_AR.activeProjects : FILTER_EN.activeProjects}
                  </div>
                ) : null}
                {sortedProjects.active.map((p) => (
                  <label
                    key={p.id}
                    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      checked={projectFilters.includes(p.id)}
                      onCheckedChange={() =>
                        setProjectFilters((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                    />
                    <ProjectSelectOptionRow
                      coverImageUrl={p.coverImageUrl}
                      clientLogoUrl={p.clientLogoUrl}
                      name={p.name}
                    />
                  </label>
                ))}
                {sortedProjects.other.length > 0 ? (
                  <div
                    className="text-muted-foreground mt-2 border-t px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide"
                    aria-hidden
                  >
                    {memberView ? TASKS_AR.otherProjects : FILTER_EN.otherProjects}
                  </div>
                ) : null}
                {sortedProjects.other.map((p) => (
                  <label
                    key={p.id}
                    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      checked={projectFilters.includes(p.id)}
                      onCheckedChange={() =>
                        setProjectFilters((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                    />
                    <ProjectSelectOptionRow
                      coverImageUrl={p.coverImageUrl}
                      clientLogoUrl={p.clientLogoUrl}
                      name={p.name}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setProjectFilters([])}
              >
                {memberView ? TASKS_AR.clearSelection : FILTER_EN.clearSelection}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover
          open={filterPopover === "priority"}
          onOpenChange={(o) => setFilterPopover(o ? "priority" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-between font-normal sm:w-[168px]"
              aria-label={memberView ? TASKS_AR.filterPriorities : FILTER_EN.priorities}
            >
              <span className="inline-flex min-w-0 items-center gap-2 truncate">
                <PriorityFilterDot
                  value={priorityFilters.length === 1 ? priorityFilters[0] : "all"}
                />
                <span className="truncate">{prioritySummary}</span>
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start" dir={dir}>
            <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
              {memberView ? TASKS_AR.filterPriorities : FILTER_EN.priorities}
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-0 p-2">
                {priorityOptionsMulti.map((o) => (
                  <label
                    key={o.value}
                    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      checked={priorityFilters.includes(o.value)}
                      onCheckedChange={() =>
                        setPriorityFilters((prev) =>
                          prev.includes(o.value)
                            ? prev.filter((x) => x !== o.value)
                            : [...prev, o.value]
                        )
                      }
                    />
                    <span className="inline-flex items-center gap-2 text-sm">
                      <PriorityFilterDot value={o.value} />
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setPriorityFilters([])}
              >
                {memberView ? TASKS_AR.clearSelection : FILTER_EN.clearSelection}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover
          open={filterPopover === "status"}
          onOpenChange={(o) => setFilterPopover(o ? "status" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-between font-normal sm:w-[168px]"
              aria-label={memberView ? TASKS_AR.filterStatuses : FILTER_EN.statuses}
            >
              <span className="truncate">{statusSummary}</span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start" dir={dir}>
            <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
              {memberView ? TASKS_AR.filterStatuses : FILTER_EN.statuses}
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-0 p-2">
                {statusOptionsMulti.map((o) => (
                  <label
                    key={o.value}
                    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      checked={statusFilters.includes(o.value)}
                      onCheckedChange={() =>
                        setStatusFilters((prev) =>
                          prev.includes(o.value)
                            ? prev.filter((x) => x !== o.value)
                            : [...prev, o.value]
                        )
                      }
                    />
                    <span className="text-sm">{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setStatusFilters([])}
              >
                {memberView ? TASKS_AR.clearSelection : FILTER_EN.clearSelection}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover
          open={filterPopover === "member"}
          onOpenChange={(o) => setFilterPopover(o ? "member" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-between font-normal sm:min-w-[200px] sm:max-w-[280px]"
              aria-label={memberView ? TASKS_AR.filterMembers : FILTER_EN.members}
            >
              <span className="truncate">{memberSummary}</span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start" dir={dir}>
            <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
              {memberView ? TASKS_AR.filterMembers : FILTER_EN.members}
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-0 p-2">
                {sortedTeamMembers.map((m) => (
                  <label
                    key={m.id}
                    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      checked={memberFilters.includes(m.id)}
                      onCheckedChange={() =>
                        setMemberFilters((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                    />
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-[10px]">{memberInitials(m.name || m.email || "?")}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm">{m.name || m.email || m.id}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setMemberFilters([])}
              >
                {memberView ? TASKS_AR.clearSelection : FILTER_EN.clearSelection}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {(viewMode === "kanban" || viewMode === "list") && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              {memberView ? TASKS_AR.dueRange : "Due date range"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePickerAr
                direction={dir}
                popoverAlign={memberView ? "end" : "start"}
                className="w-full min-w-0 sm:w-72"
                value={dueRange}
                onChange={setDueRange}
                placeholder={memberView ? TASKS_AR.dueRangePlaceholder : "Pick start & end dates"}
                numberOfMonths={2}
              />
              {dueRange?.from && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => setDueRange(undefined)}
                >
                  <X className="me-1 h-4 w-4" />
                  {memberView ? TASKS_AR.clearDates : "Clear"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {viewMode === "kanban" ? (
        <TasksKanban
          tasks={tasks}
          assigneesByTaskId={assigneesByTaskId}
          onAddTask={handleAddTask}
          onOpenTask={setTaskDetailId}
          onDeleteTask={handleDeleteTask}
          onTaskStatusChange={handleTaskStatusMove}
          memberView={memberView}
        />
      ) : viewMode === "list" ? (
        <TasksListView
          tasks={filteredTasksForList}
          assigneesByTaskId={assigneesByTaskId}
          projectOptions={projects}
          teamMembers={teamMembers}
          onOpenTask={setTaskDetailId}
          onDeleteTask={handleDeleteTask}
          onTaskPatched={(id, patch) =>
            setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
          }
          onAssigneesRefresh={refetch}
          memberView={memberView}
        />
      ) : (
        <TasksCalendarView
          tasks={tasks}
          onOpenTask={setTaskDetailId}
          memberView={memberView}
        />
      )}

      <NewTaskModal
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        projects={projects}
        teamMembers={teamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
        }))}
        defaultStatus={newTaskDefaultStatus}
        onSuccess={refetch}
        memberView={memberView}
        memberTeamMemberId={memberTeamMemberId}
      />

      <TaskDetailModal
        taskId={taskDetailId}
        teamMembers={teamMembers}
        onClose={() => setTaskDetailId(null)}
        onSuccess={refetch}
        memberView={memberView}
      />

      <AlertDialog open={!!taskIdToDelete} onOpenChange={(o) => !o && setTaskIdToDelete(null)}>
        <AlertDialogContent dir={dir} lang={memberView ? "ar" : "en"} className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle>{memberView ? TASKS_AR.deleteTitle : "Delete this task?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {memberView ? TASKS_AR.deleteDesc : "This will remove the task. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{memberView ? TASKS_AR.cancel : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {memberView ? TASKS_AR.delete : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="fixed bottom-24 inset-s-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg md:hidden"
        aria-label="New task"
        onClick={() => handleAddTask()}
      >
        +
      </button>
    </div>
  );
}
