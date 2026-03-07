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
import { getTasks, deleteTask } from "@/actions/tasks";
import { toast } from "sonner";
import type { TaskWithProject, GetTasksFilters } from "@/actions/tasks";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/types";
import { TasksKanban } from "./tasks-kanban";
import { TasksListView } from "./tasks-list-view";
import { NewTaskModal } from "./new-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { LayoutGrid, List, Plus } from "lucide-react";

type ProjectOption = { id: string; name: string };

type TasksPageContentProps = {
  initialTasks: TaskWithProject[];
  projects: ProjectOption[];
};

const PRIORITY_OPTIONS = [
  { value: "all", label: "كل الأولويات" },
  { value: "low", label: TASK_PRIORITY_LABELS.low },
  { value: "medium", label: TASK_PRIORITY_LABELS.medium },
  { value: "high", label: TASK_PRIORITY_LABELS.high },
  { value: "urgent", label: TASK_PRIORITY_LABELS.urgent },
];

const STATUS_OPTIONS = [
  { value: "all", label: "كل الحالات" },
  { value: "todo", label: TASK_STATUS_LABELS.todo },
  { value: "in_progress", label: TASK_STATUS_LABELS.in_progress },
  { value: "in_review", label: TASK_STATUS_LABELS.in_review },
  { value: "done", label: TASK_STATUS_LABELS.done },
  { value: "blocked", label: TASK_STATUS_LABELS.blocked },
];

export function TasksPageContent({ initialTasks, projects }: TasksPageContentProps) {
  const router = useRouter();
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
        toast.success("تم حذف المهمة");
        refetch();
      } else {
        toast.error(res.error);
      }
    });
  };

  const filteredTasksForList = tasks;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">المهام</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              title="كانبان"
            >
              <LayoutGrid className="h-4 w-4 ml-1" />
              كانبان
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              title="قائمة"
            >
              <List className="h-4 w-4 ml-1" />
              قائمة
            </Button>
            <Button onClick={() => handleAddTask()}>
              <Plus className="h-4 w-4 ml-1" />
              مهمة جديدة
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="البحث باسم المهمة..."
            className="w-full sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="كل المشاريع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
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
            onAddTask={handleAddTask}
            onOpenTask={setTaskDetailId}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <TasksListView
            tasks={filteredTasksForList}
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
        onClose={() => setTaskDetailId(null)}
        onSuccess={refetch}
      />

      <AlertDialog open={!!taskIdToDelete} onOpenChange={(o) => !o && setTaskIdToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المهمة ولا يمكن التراجع عن ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="md:hidden fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
        aria-label="مهمة جديدة"
        onClick={() => handleAddTask()}
      >
        +
      </button>
    </>
  );
}
