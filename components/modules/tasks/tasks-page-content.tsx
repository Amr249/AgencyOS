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
import { NewTaskModal } from "./new-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { TASK_STATUS_LABELS_EN, TASK_PRIORITY_LABELS_EN } from "@/types";
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

const TASKS_AR = {
  tasks: "المهام",
  kanban: "كانبان",
  list: "قائمة",
  newTask: "مهمة جديدة",
  searchPlaceholder: "البحث باسم المهمة",
  allProjects: "جميع المشاريع",
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
  const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
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
    } as GetTasksFilters).then((res) => {
      if (res.ok) setTasks(res.data);
    });
    router.refresh();
  }, [search, projectFilter, priorityFilter, statusFilter, router]);

  const filtersRef = React.useRef({ search, projectFilter, priorityFilter, statusFilter });
  React.useEffect(() => {
    const prev = filtersRef.current;
    const same =
      prev.search === search &&
      prev.projectFilter === projectFilter &&
      prev.priorityFilter === priorityFilter &&
      prev.statusFilter === statusFilter;
    filtersRef.current = { search, projectFilter, priorityFilter, statusFilter };
    if (same) return;
    getTasks({
      search: search.trim() || undefined,
      projectId: projectFilter === "all" ? undefined : projectFilter,
      priority: priorityFilter === "all" || !priorityFilter ? undefined : priorityFilter,
      status: statusFilter === "all" || !statusFilter ? undefined : statusFilter,
    } as GetTasksFilters).then((res) => {
      if (res.ok) setTasks(res.data);
    });
  }, [search, projectFilter, priorityFilter, statusFilter]);

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
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={dir}>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {viewMode === "list" && (
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
      ) : (
        <TasksListView
          tasks={filteredTasksForList}
          assigneesByTaskId={assigneesByTaskId}
          projectOptions={projects}
          onOpenTask={setTaskDetailId}
          onDeleteTask={handleDeleteTask}
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
