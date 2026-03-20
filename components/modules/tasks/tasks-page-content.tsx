"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { getTasks, deleteTask } from "@/actions/tasks";
import { toast } from "sonner";
import type { TaskWithProject, GetTasksFilters } from "@/actions/tasks";
import { TasksKanban } from "./tasks-kanban";
import { TasksListView } from "./tasks-list-view";
import { NewTaskModal } from "./new-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";

type ProjectOption = { id: string; name: string };

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
};

export function TasksPageContent({
  initialTasks,
  projects,
  teamMembers,
  assigneesByTaskId,
}: TasksPageContentProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const translateErr = useTranslateActionError();
  const dialogDir = locale === "ar" ? "rtl" : "ltr";

  const PRIORITY_OPTIONS = React.useMemo(
    () => [
      { value: "all", label: t("allPriorities") },
      { value: "low", label: t("taskPrioLow") },
      { value: "medium", label: t("taskPrioMedium") },
      { value: "high", label: t("taskPrioHigh") },
      { value: "urgent", label: t("taskPrioUrgent") },
    ],
    [t]
  );

  const STATUS_OPTIONS = React.useMemo(
    () => [
      { value: "all", label: t("allStatuses") },
      { value: "todo", label: t("taskStatusTodo") },
      { value: "in_progress", label: t("taskStatusInProgress") },
      { value: "in_review", label: t("taskStatusInReview") },
      { value: "done", label: t("taskStatusDone") },
      { value: "blocked", label: t("taskStatusBlocked") },
    ],
    [t]
  );

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

  const confirmDelete = () => {
    if (!taskIdToDelete) return;
    deleteTask(taskIdToDelete).then((res) => {
      if (res.ok) {
        setTaskIdToDelete(null);
        toast.success(t("deleteSuccess"));
        refetch();
      } else {
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(isDbErrorKey(err) ? translateErr(err) : err);
      }
    });
  };

  const filteredTasksForList = tasks;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              title={t("kanban")}
            >
              <LayoutGrid className="me-1 h-4 w-4" />
              {t("kanban")}
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              title={t("list")}
            >
              <List className="me-1 h-4 w-4" />
              {t("list")}
            </Button>
            <Button onClick={() => handleAddTask()}>
              <Plus className="me-1 h-4 w-4" />
              {t("newTask")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder={t("searchPlaceholder")}
            className="w-full sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allProjects")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
              <SelectContent>
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
          />
        ) : (
          <TasksListView
            tasks={filteredTasksForList}
            assigneesByTaskId={assigneesByTaskId}
            onOpenTask={setTaskDetailId}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </div>

      <NewTaskModal
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        projects={projects}
        defaultStatus={newTaskDefaultStatus}
        onSuccess={refetch}
      />

      <TaskDetailModal
        taskId={taskDetailId}
        teamMembers={teamMembers}
        onClose={() => setTaskDetailId(null)}
        onSuccess={refetch}
      />

      <AlertDialog open={!!taskIdToDelete} onOpenChange={(o) => !o && setTaskIdToDelete(null)}>
        <AlertDialogContent dir={dialogDir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteTaskConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="fixed bottom-24 start-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg md:hidden"
        aria-label={t("fabNewTask")}
        onClick={() => handleAddTask()}
      >
        +
      </button>
    </>
  );
}
