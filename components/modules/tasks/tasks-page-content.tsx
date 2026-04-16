"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import type { TaskWithProject, GetTasksFilters } from "@/actions/tasks";
import { TasksKanban, type KanbanStatus } from "./tasks-kanban";
import { TasksListView } from "./tasks-list-view";
import { TasksCalendarView } from "./tasks-calendar-view";
import { TasksTimesheetView } from "./tasks-timesheet-view";
import { NewTaskModal } from "./new-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { CalendarDays, ClipboardList, LayoutGrid, List, Plus, Users } from "lucide-react";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { TASK_STATUS_LABELS_EN, TASK_PRIORITY_LABELS_EN } from "@/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ProjectSelectOptionRow,
  type ProjectPickerOption,
} from "@/components/entity-select-option";

type ProjectOption = ProjectPickerOption;

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
  timesheet: "جدول الساعات",
  newTask: "مهمة جديدة",
  searchPlaceholder: "البحث باسم المهمة",
  allProjects: "جميع المشاريع",
  allMembers: "كل الأعضاء",
  deleteTitle: "حذف هذه المهمة؟",
  deleteDesc: "سيتم حذف المهمة. لا يمكن التراجع عن هذا الإجراء.",
  cancel: "إلغاء",
  delete: "حذف",
};

export function TasksPageContent({
  initialTasks,
  projects,
  teamMembers,
  assigneesByTaskId,
  memberView = false,
}: TasksPageContentProps) {
  const router = useRouter();
  const translateErr = useTranslateActionError();

  const [tasks, setTasks] = React.useState<TaskWithProject[]>(initialTasks);
  const [viewMode, setViewMode] = React.useState<
    "kanban" | "list" | "calendar" | "timesheet"
  >("kanban");
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [memberFilter, setMemberFilter] = React.useState<string>("all");
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = React.useState<
    "todo" | "in_progress" | "in_review" | "done" | "blocked"
  >("todo");
  const [taskDetailId, setTaskDetailId] = React.useState<string | null>(null);
  const [taskIdToDelete, setTaskIdToDelete] = React.useState<string | null>(null);

  const refetch = React.useCallback(() => {
    getTasks({
      search: search.trim() || undefined,
      projectId: projectFilter === "all" ? undefined : projectFilter,
      priority: priorityFilter === "all" || !priorityFilter ? undefined : priorityFilter,
      status: statusFilter === "all" || !statusFilter ? undefined : statusFilter,
      teamMemberId: memberFilter === "all" ? undefined : memberFilter,
    } as GetTasksFilters).then((res) => {
      if (res.ok) setTasks(res.data);
    });
    router.refresh();
  }, [search, projectFilter, priorityFilter, statusFilter, memberFilter, router]);

  const filtersRef = React.useRef({
    search,
    projectFilter,
    priorityFilter,
    statusFilter,
    memberFilter,
  });
  React.useEffect(() => {
    const prev = filtersRef.current;
    const same =
      prev.search === search &&
      prev.projectFilter === projectFilter &&
      prev.priorityFilter === priorityFilter &&
      prev.statusFilter === statusFilter &&
      prev.memberFilter === memberFilter;
    filtersRef.current = { search, projectFilter, priorityFilter, statusFilter, memberFilter };
    if (same) return;
    getTasks({
      search: search.trim() || undefined,
      projectId: projectFilter === "all" ? undefined : projectFilter,
      priority: priorityFilter === "all" || !priorityFilter ? undefined : priorityFilter,
      status: statusFilter === "all" || !statusFilter ? undefined : statusFilter,
      teamMemberId: memberFilter === "all" ? undefined : memberFilter,
    } as GetTasksFilters).then((res) => {
      if (res.ok) setTasks(res.data);
    });
  }, [search, projectFilter, priorityFilter, statusFilter, memberFilter]);

  const sortedTeamMembers = React.useMemo(
    () => [...teamMembers].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [teamMembers]
  );

  const selectedMemberForFilter = React.useMemo(
    () =>
      memberFilter === "all" ? null : (sortedTeamMembers.find((m) => m.id === memberFilter) ?? null),
    [memberFilter, sortedTeamMembers]
  );

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
      toast.success("Status updated");
    },
    [tasks, translateErr]
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
  const PRIORITY_OPTIONS = memberView ? PRIORITY_OPTIONS_AR : PRIORITY_OPTIONS_EN;
  const STATUS_OPTIONS = memberView ? STATUS_OPTIONS_AR : STATUS_OPTIONS_EN;
  const priorityFilterLabel =
    PRIORITY_OPTIONS.find((o) => o.value === priorityFilter)?.label ?? PRIORITY_OPTIONS[0].label;
  const memberFilterLabel =
    memberFilter === "all"
      ? memberView
        ? TASKS_AR.allMembers
        : "All members"
      : selectedMemberForFilter
        ? selectedMemberForFilter.name || selectedMemberForFilter.email || selectedMemberForFilter.id
        : memberView
          ? TASKS_AR.allMembers
          : "All members";

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
          <Button
            variant={viewMode === "timesheet" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("timesheet")}
            title={memberView ? TASKS_AR.timesheet : "Timesheet"}
          >
            <ClipboardList className="me-1 h-4 w-4" />
            {memberView ? TASKS_AR.timesheet : "Timesheet"}
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
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={memberView ? TASKS_AR.allProjects : "All projects"} />
          </SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all">{memberView ? TASKS_AR.allProjects : "All projects"}</SelectItem>
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
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger
            className="w-full min-w-0 sm:w-[168px]"
            aria-label={memberView ? "تصفية حسب الأولوية" : "Filter by priority"}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-start">
              <PriorityFilterDot value={priorityFilter} />
              <span className="truncate">{priorityFilterLabel}</span>
            </span>
          </SelectTrigger>
          <SelectContent dir={dir}>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} textValue={o.label}>
                <span className="inline-flex items-center gap-2">
                  <PriorityFilterDot value={o.value} />
                  {o.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger
            className="w-full min-w-0 sm:min-w-[200px] sm:max-w-[260px]"
            aria-label={memberView ? "تصفية حسب العضو" : "Filter by team member"}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-start">
              {memberFilter === "all" ? (
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                </span>
              ) : selectedMemberForFilter ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={selectedMemberForFilter.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {memberInitials(selectedMemberForFilter.name || selectedMemberForFilter.email || "?")}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="bg-muted flex h-7 w-7 shrink-0 rounded-full" aria-hidden />
              )}
              <span className="truncate">{memberFilterLabel}</span>
            </span>
          </SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all" textValue={memberView ? TASKS_AR.allMembers : "All members"}>
              <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                </span>
                <span className="min-w-0 truncate">{memberView ? TASKS_AR.allMembers : "All members"}</span>
              </span>
            </SelectItem>
            {sortedTeamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id} textValue={m.name || m.email || m.id}>
                <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-[10px]">{memberInitials(m.name || m.email || "?")}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate">{m.name || m.email || m.id}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(viewMode === "list" || viewMode === "calendar") && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir={dir}>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      ) : viewMode === "calendar" ? (
        <TasksCalendarView
          tasks={tasks}
          onOpenTask={setTaskDetailId}
          memberView={memberView}
        />
      ) : (
        <TasksTimesheetView
          tasks={tasks}
          assigneesByTaskId={assigneesByTaskId}
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
