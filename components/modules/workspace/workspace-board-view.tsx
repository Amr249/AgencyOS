"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  ProjectSelectOptionRow,
  TeamMemberSelectOptionRow,
} from "@/components/entity-select-option";
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
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import { TaskDetailModal } from "@/components/modules/tasks/task-detail-modal";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import {
  TasksKanban,
  KANBAN_STATUSES,
  type KanbanStatus,
} from "@/components/modules/tasks/tasks-kanban";
import { deleteTask, updateTaskStatus } from "@/actions/tasks";
import { TASK_PRIORITY_LABELS_EN } from "@/types";
import type { WorkspaceBoardTask } from "@/actions/workspace";
import type { TeamMemberRow } from "@/actions/team-members";
import type { ProjectPickerOption } from "@/components/entity-select-option";
import { Badge } from "@/components/ui/badge";

type BoardColumn = { status: string; tasks: WorkspaceBoardTask[] };

type Swimlane = { key: string; label: string; tasks: WorkspaceBoardTask[] };

const STORAGE_KEY = "workspace-board-group-by";
type GroupBy = "none" | "assignee" | "project" | "priority";

const ASSIGNEE_FILTER_UNASSIGNED = "__unassigned__";

function ymd(d: string | Date | null | undefined): string | null {
  if (d == null || d === "") return null;
  if (d instanceof Date) return format(d, "yyyy-MM-dd");
  const s = typeof d === "string" ? d : String(d);
  return s.slice(0, 10);
}

type AssigneeForCard = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

function flattenColumnsToTasks(columns: BoardColumn[]): WorkspaceBoardTask[] {
  return KANBAN_STATUSES.flatMap((status) => {
    const col = columns.find((c) => c.status === status);
    return col?.tasks ?? [];
  });
}

function buildSwimlanes(tasks: WorkspaceBoardTask[], groupBy: Exclude<GroupBy, "none">, projectLabel: string): Swimlane[] {
  if (groupBy === "project") {
    return [{ key: "project", label: projectLabel, tasks }];
  }

  if (groupBy === "assignee") {
    const byKey = new Map<string, { label: string; tasks: WorkspaceBoardTask[] }>();
    for (const t of tasks) {
      const key = t.assigneeId ?? "__unassigned__";
      const label = t.assigneeName ?? "Unassigned";
      if (!byKey.has(key)) byKey.set(key, { label, tasks: [] });
      byKey.get(key)!.tasks.push(t);
    }
    const entries = [...byKey.entries()].sort(([ka], [kb]) => {
      if (ka === "__unassigned__") return 1;
      if (kb === "__unassigned__") return -1;
      return (byKey.get(ka)!.label || "").localeCompare(byKey.get(kb)!.label || "");
    });
    return entries.map(([key, { label, tasks: ts }]) => ({ key, label, tasks: ts }));
  }

  const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
  const normalized = (p: string) =>
    PRIORITY_ORDER.includes(p as (typeof PRIORITY_ORDER)[number]) ? p : "medium";
  return PRIORITY_ORDER.map((p) => ({
    key: p,
    label: TASK_PRIORITY_LABELS_EN[p] ?? p,
    tasks: tasks.filter((t) => normalized(t.priority) === p),
  })).filter((lane) => lane.tasks.length > 0);
}

export function WorkspaceBoardView({
  columns,
  projects,
  projectId,
  teamMembers,
  assigneesByTaskId,
}: {
  columns: BoardColumn[];
  projects: ProjectPickerOption[];
  /** Use `"all"` when the board loads tasks from every project. */
  projectId: string;
  teamMembers: TeamMemberRow[];
  assigneesByTaskId: Record<string, AssigneeForCard[]>;
}) {
  const router = useRouter();
  const projectLabel =
    projectId === "all"
      ? "All projects"
      : projects.find((p) => p.id === projectId)?.name ?? "Project";

  const [groupBy, setGroupBy] = React.useState<GroupBy>("none");
  const [hydrated, setHydrated] = React.useState(false);
  const [tasks, setTasks] = React.useState<WorkspaceBoardTask[]>(() => flattenColumnsToTasks(columns));
  const [newOpen, setNewOpen] = React.useState(false);
  const [defaultStatus, setDefaultStatus] = React.useState<KanbanStatus>("todo");
  const [taskDetailId, setTaskDetailId] = React.useState<string | null>(null);
  const [taskIdToDelete, setTaskIdToDelete] = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = React.useState<
    "all" | "low" | "medium" | "high" | "urgent"
  >("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");
  /** Lower bound (task start, or due if no start); upper bound (due). */
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [narrowProjectFilter, setNarrowProjectFilter] = React.useState<string>("all");

  const groupByRef = React.useRef<GroupBy>("none");
  const tasksRef = React.useRef(tasks);

  React.useEffect(() => {
    groupByRef.current = groupBy;
  }, [groupBy]);
  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  React.useEffect(() => {
    setTasks(flattenColumnsToTasks(columns));
  }, [columns]);

  const persistGroupBy = React.useCallback((v: GroupBy) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const changeGroupBy = React.useCallback(
    (v: GroupBy) => {
      persistGroupBy(v);
      setGroupBy(v);
    },
    [persistGroupBy]
  );

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "assignee" || raw === "project" || raw === "priority" || raw === "none") {
        setGroupBy(raw);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const handleTaskStatusMove = React.useCallback(
    async (taskId: string, newStatus: KanbanStatus) => {
      const list = tasksRef.current;
      const task = list.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;
      const previousStatus = task.status;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      const res = await updateTaskStatus(taskId, newStatus);
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)));
        const err = typeof res.error === "string" ? res.error : "";
        toast.error(err || "Could not update status");
        return;
      }
      toast.success("Status updated");
      router.refresh();
    },
    [router]
  );

  const confirmDelete = React.useCallback(() => {
    const id = taskIdToDelete;
    if (!id) return;
    deleteTask(id).then((res) => {
      if (res.ok) {
        setTaskIdToDelete(null);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setTaskDetailId((cur) => (cur === id ? null : cur));
        toast.success("Task deleted");
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
      }
    });
  }, [taskIdToDelete, router]);

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

  const taskModalTeamMembers = React.useMemo(
    () =>
      teamMembers.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email ?? "",
        avatarUrl: m.avatarUrl ?? null,
        role: m.role ?? undefined,
      })),
    [teamMembers]
  );

  const passesFilters = React.useCallback(
    (task: WorkspaceBoardTask) => {
      if (statusFilter === "active" && task.status === "done") return false;
      if (statusFilter === "completed" && task.status !== "done") return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === ASSIGNEE_FILTER_UNASSIGNED) {
          if (task.assigneeId != null) return false;
        } else if (task.assigneeId !== assigneeFilter) {
          return false;
        }
      }
      if (projectId === "all" && narrowProjectFilter !== "all" && task.projectId !== narrowProjectFilter) {
        return false;
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
      assigneeFilter,
      projectId,
      narrowProjectFilter,
      dateFrom,
      dateTo,
    ]
  );

  const filteredTasks = React.useMemo(() => tasks.filter(passesFilters), [tasks, passesFilters]);

  const hasExtraFilters =
    assigneeFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    (projectId === "all" && narrowProjectFilter !== "all");

  const swimlanes = React.useMemo(() => {
    if (!hydrated || groupBy === "none") return [];
    return buildSwimlanes(filteredTasks, groupBy, projectLabel);
  }, [filteredTasks, groupBy, projectLabel, hydrated]);

  const openTaskById = (id: string) => setTaskDetailId(id);

  return (
    <div dir="ltr" lang="en" className="space-y-4">
      <WorkspaceNav projects={projects} />

      <div className="flex flex-col gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3 text-sm">
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
          {projectId === "all" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Project</span>
              <Select value={narrowProjectFilter} onValueChange={setNarrowProjectFilter}>
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
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
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
                setNarrowProjectFilter("all");
              }}
            >
              Clear assignee and date filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Group by</span>
          <Select value={groupBy} onValueChange={(v) => changeGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (status)</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {groupBy === "none" ? (
        tasks.length > 0 && filteredTasks.length === 0 ? (
          <p className="text-muted-foreground px-1 text-sm">No tasks match the current filters.</p>
        ) : (
          <TasksKanban
            tasks={filteredTasks}
            assigneesByTaskId={assigneesByTaskId}
            onAddTask={(status) => {
              setDefaultStatus(status);
              setNewOpen(true);
            }}
            onOpenTask={openTaskById}
            onDeleteTask={setTaskIdToDelete}
            onTaskStatusChange={handleTaskStatusMove}
          />
        )
      ) : !hydrated ? null : swimlanes.length === 0 ? (
        <p className="text-muted-foreground px-1 text-sm">
          {tasks.length > 0 && filteredTasks.length === 0
            ? "No tasks match the current filters."
            : "No tasks in this project."}
        </p>
      ) : (
        <div className="space-y-8">
          {swimlanes.map((lane) => (
            <section key={lane.key} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <h2 className="text-sm font-semibold text-foreground">{lane.label}</h2>
                <Badge variant="outline" className="tabular-nums">
                  {lane.tasks.length}
                </Badge>
              </div>
              <TasksKanban
                dndColumnScope={lane.key}
                tasks={lane.tasks}
                assigneesByTaskId={assigneesByTaskId}
                onAddTask={(status) => {
                  setDefaultStatus(status);
                  setNewOpen(true);
                }}
                onOpenTask={openTaskById}
                onDeleteTask={setTaskIdToDelete}
                onTaskStatusChange={handleTaskStatusMove}
              />
            </section>
          ))}
        </div>
      )}

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        teamMembers={panelTeamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
        }))}
        defaultStatus={defaultStatus}
        onSuccess={() => router.refresh()}
      />
      <TaskDetailModal
        taskId={taskDetailId}
        teamMembers={taskModalTeamMembers}
        onClose={() => setTaskDetailId(null)}
        onSuccess={() => router.refresh()}
      />

      <AlertDialog open={!!taskIdToDelete} onOpenChange={(o) => !o && setTaskIdToDelete(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The task will be removed from the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
