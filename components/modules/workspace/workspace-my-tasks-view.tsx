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
  Plus,
  SquareArrowOutUpRight,
  UserCircle,
} from "lucide-react";
import { updateTaskStatus } from "@/actions/tasks";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { cn } from "@/lib/utils";

type TaskItem = any;

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

const SECTION_CONFIG: Record<string, { label: string; color: string }> = {
  today: { label: "Today", color: "#3b82f6" },
  this_week: { label: "This Week", color: "#f59e0b" },
  later: { label: "Later", color: "#9ca3af" },
  no_date: { label: "No Date", color: "#d1d5db" },
};

const sectionKeys = ["today", "this_week", "later", "no_date"] as const;

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === "done") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const COLUMNS = [
  { key: "task", label: "Task", icon: AlignLeft, className: "flex-1 min-w-[280px]" },
  { key: "project", label: "Project", icon: FolderOpen, className: "w-[200px] hidden md:flex" },
  { key: "status", label: "Status", icon: CircleDot, className: "w-[130px]" },
  { key: "priority", label: "Priority", icon: Flag, className: "w-[110px]" },
  { key: "assignee", label: "Assignee", icon: UserCircle, className: "w-[120px] hidden lg:flex" },
  { key: "dueDate", label: "Due Date", icon: CalendarDays, className: "w-[120px]" },
  { key: "hours", label: "Hours", icon: Clock, className: "w-[80px] hidden lg:flex" },
] as const;

export function WorkspaceMyTasksView({
  groups,
  teamMembers,
  projects,
}: {
  groups: { today: TaskItem[]; this_week: TaskItem[]; later: TaskItem[]; no_date: TaskItem[] };
  teamMembers: any[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    today: true,
    this_week: true,
    later: true,
    no_date: true,
  });
  const [newOpen, setNewOpen] = React.useState(false);
  const [newDefaultDate, setNewDefaultDate] = React.useState<string | undefined>();
  const [selectedTask, setSelectedTask] = React.useState<any>(null);
  const [localGroups, setLocalGroups] = React.useState(groups);

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleStatusToggle(taskId: string, checked: boolean | "indeterminate") {
    const newStatus = checked ? "done" : "todo";
    const res = await updateTaskStatus(taskId, newStatus);
    if (!res.ok) return toast.error("Failed to update task status.");
    if (newStatus === "done") {
      setLocalGroups((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([g, tasks]) => [g, tasks.filter((tsk: any) => tsk.id !== taskId)])
        ) as any
      );
    }
    router.refresh();
  }

  function openNewTaskForSection(sectionKey: string) {
    const today = new Date().toISOString().slice(0, 10);
    const dateMap: Record<string, string | undefined> = {
      today,
      this_week: undefined,
      later: undefined,
      no_date: undefined,
    };
    setNewDefaultDate(dateMap[sectionKey]);
    setNewOpen(true);
  }

  return (
    <div dir="ltr" className="w-full min-h-screen bg-background">
      <WorkspaceNav />

      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-xl font-semibold text-foreground">My Tasks</h1>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setNewOpen(true)}
        >
          <Plus size={14} />
          New Task
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center bg-muted/30 border-b border-border">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border last:border-r-0 select-none",
                col.className
              )}
            >
              <col.icon size={12} className="shrink-0" />
              {col.label}
            </div>
          ))}
        </div>

        {/* Section groups */}
        {sectionKeys.map((sectionKey) => {
          const list = localGroups[sectionKey];
          const isOpen = openSections[sectionKey];
          const config = SECTION_CONFIG[sectionKey];

          return (
            <React.Fragment key={sectionKey}>
              {/* Section header */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border-b border-border cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => toggleSection(sectionKey)}
              >
                <ChevronDown
                  size={14}
                  className="text-muted-foreground transition-transform"
                  style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-medium text-foreground">{config.label}</span>
                <span className="text-xs text-muted-foreground ml-1">{list.length}</span>
              </div>

              {/* Empty state */}
              {isOpen && list.length === 0 && (
                <div className="flex items-center px-3 py-3 border-b border-border">
                  <span className="text-sm text-muted-foreground pl-6">No tasks in this section.</span>
                </div>
              )}

              {/* Task rows */}
              {isOpen &&
                list.map((task: TaskItem) => {
                  const overdue = isOverdue(task.dueDate, task.status);
                  const dueToday = isDueToday(task.dueDate);
                  const hours = Number(task.actualHours ?? 0);
                  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
                  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

                  return (
                    <div
                      key={task.id}
                      className="group flex items-center border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      {/* Task name */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border gap-2", COLUMNS[0].className)}>
                        <Checkbox
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          checked={task.status === "done"}
                          onCheckedChange={(checked) => handleStatusToggle(task.id, checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-foreground truncate" dir="auto">
                          {task.title}
                        </span>
                        <SquareArrowOutUpRight
                          size={12}
                          className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity ml-auto text-muted-foreground"
                        />
                      </div>

                      {/* Project */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border", COLUMNS[1].className)}>
                        {task.projectName ? (
                          <span className="text-sm text-muted-foreground truncate">{task.projectName}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border", COLUMNS[2].className)}>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", sc.bg, sc.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", sc.dot)} />
                          {sc.label}
                        </span>
                      </div>

                      {/* Priority */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border", COLUMNS[3].className)}>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", pc.bg, pc.text)}>
                          {pc.label}
                        </span>
                      </div>

                      {/* Assignee */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border", COLUMNS[4].className)}>
                        {task.assigneeName ? (
                          <div className="flex items-center gap-1.5">
                            {task.assigneeAvatarUrl ? (
                              <img src={task.assigneeAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                {task.assigneeName[0]}
                              </div>
                            )}
                            <span className="text-sm text-muted-foreground truncate">{task.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-sm">—</span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className={cn("flex items-center px-3 py-2 border-r border-border", COLUMNS[5].className)}>
                        {task.dueDate ? (
                          <span
                            className={cn(
                              "text-sm",
                              overdue && "text-red-500 font-medium",
                              dueToday && !overdue && "text-amber-500 font-medium",
                              !overdue && !dueToday && "text-muted-foreground"
                            )}
                          >
                            {formatDate(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Hours */}
                      <div className={cn("flex items-center px-3 py-2", COLUMNS[6].className)}>
                        {hours > 0 ? (
                          <span className="text-sm text-muted-foreground">{hours}h</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Add task row */}
              {isOpen && (
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm text-muted-foreground hover:bg-muted/20 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => openNewTaskForSection(sectionKey)}
                >
                  <Plus size={14} />
                  New task
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Add a property row (decorative) */}
        <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/20 cursor-pointer hover:text-foreground transition-colors">
          <Plus size={12} />
          Add a property
        </div>
      </div>

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        teamMembers={teamMembers.map((m: any) => ({ id: m.id, name: m.name }))}
        defaultDueDate={newDefaultDate}
        onSuccess={() => router.refresh()}
      />
      <TaskDetailPanel
        task={selectedTask}
        teamMembers={teamMembers}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}
