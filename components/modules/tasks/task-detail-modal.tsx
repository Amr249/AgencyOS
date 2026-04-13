"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  getTaskById,
  getTasks,
  updateTask,
  deleteTask,
  createSubtask,
  toggleSubtask,
} from "@/actions/tasks";
import { getMilestonesByProjectId } from "@/actions/milestones";
import { getTaskAssignees } from "@/actions/assignments";
import { AssigneePicker } from "@/components/dashboard/assignee-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { TASK_STATUS_LABELS_EN, TASK_PRIORITY_LABELS_EN } from "@/types";
import { cn } from "@/lib/utils";
import { getTimeLogsByTaskId } from "@/actions/time-tracking";
import { TimerWidget } from "@/components/modules/time-tracking/timer-widget";
import { LogTimeDialog } from "@/components/modules/time-tracking/log-time-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { addDependency, getTaskDependencies, removeDependency } from "@/actions/task-dependencies";
import { Pencil, Trash2, X } from "lucide-react";
import { ProjectSelectThumb } from "@/components/entity-select-option";

type TaskWithSubtasks = {
  id: string;
  projectId: string;
  projectName: string | null;
  projectCoverImageUrl?: string | null;
  projectClientLogoUrl?: string | null;
  parentTaskId: string | null;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedHours: string | null;
  notes: string | null;
  createdAt: Date;
  subtasks: Array<{
    id: string;
    projectId: string;
    phaseId: string | null;
    parentTaskId: string | null;
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
    priority: string;
    dueDate: string | null;
    estimatedHours: string | null;
    notes: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }>;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
};

type Assignee = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type TimeLogRow = {
  id: string;
  hours: string | number;
  isBillable?: boolean | null;
};

type DependencyRow = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: string;
  task: { id: string; title: string; projectId: string };
  dependsOnTask: { id: string; title: string; projectId: string };
};

type DependencyState = {
  blockedBy: DependencyRow[];
  blocks: DependencyRow[];
};

type CandidateTask = {
  id: string;
  title: string;
};

type MilestoneOption = { id: string; name: string };

type TaskDetailModalProps = {
  taskId: string | null;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSuccess: () => void;
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${text}h`;
}

export function TaskDetailModal({ taskId, teamMembers, onClose, onSuccess }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const [task, setTask] = React.useState<TaskWithSubtasks | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [currentAssignees, setCurrentAssignees] = React.useState<Assignee[]>([]);
  const [titleEdit, setTitleEdit] = React.useState("");
  const [descriptionEdit, setDescriptionEdit] = React.useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [addingSubtask, setAddingSubtask] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null);
  const [subtaskEditTitle, setSubtaskEditTitle] = React.useState("");
  const [subtaskIdToDelete, setSubtaskIdToDelete] = React.useState<string | null>(null);
  const [timeLogs, setTimeLogs] = React.useState<TimeLogRow[]>([]);
  const [dependencies, setDependencies] = React.useState<DependencyState>({ blockedBy: [], blocks: [] });
  const [candidateTasks, setCandidateTasks] = React.useState<CandidateTask[]>([]);
  const [dependencySearch, setDependencySearch] = React.useState("");
  const [selectedDependencyTaskId, setSelectedDependencyTaskId] = React.useState("");
  const [addingDependency, setAddingDependency] = React.useState(false);
  const [milestoneOptions, setMilestoneOptions] = React.useState<MilestoneOption[]>([]);

  const open = !!taskId;

  React.useEffect(() => {
    if (!taskId) {
      setTask(null);
      setCurrentAssignees([]);
      setTimeLogs([]);
      setDependencies({ blockedBy: [], blocks: [] });
      setCandidateTasks([]);
      setDependencySearch("");
      setSelectedDependencyTaskId("");
      setMilestoneOptions([]);
      setEditingSubtaskId(null);
      setSubtaskEditTitle("");
      setSubtaskIdToDelete(null);
      return;
    }
    setLoading(true);
    Promise.all([
      getTaskById(taskId),
      getTaskAssignees(taskId),
      getTimeLogsByTaskId(taskId),
      getTaskDependencies(taskId),
    ])
      .then(([taskRes, assigneesRes, timeRes, dependencyRes]) => {
        if (taskRes.ok) {
          const data = taskRes.data as TaskWithSubtasks;
          setTask(data);
          setTitleEdit(data.title);
          setDescriptionEdit(data.description ?? "");
          getMilestonesByProjectId(data.projectId).then((msRes) => {
            if (msRes.ok) {
              setMilestoneOptions(msRes.data.map((m) => ({ id: m.id, name: m.name })));
            } else {
              setMilestoneOptions([]);
            }
          });
          getTasks({ projectId: data.projectId }).then((projectTasksRes) => {
            if (projectTasksRes.ok) {
              setCandidateTasks(
                projectTasksRes.data.map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              );
            } else {
              setCandidateTasks([]);
            }
          });
        }
        if (assigneesRes.data) {
          setCurrentAssignees(assigneesRes.data);
        }
        if (timeRes.ok) {
          setTimeLogs((timeRes.data as unknown as TimeLogRow[]) ?? []);
        } else {
          setTimeLogs([]);
        }
        if (dependencyRes.ok) {
          setDependencies({
            blockedBy: (dependencyRes.data.blockedBy as DependencyRow[]) ?? [],
            blocks: (dependencyRes.data.blocks as DependencyRow[]) ?? [],
          });
        } else {
          setDependencies({ blockedBy: [], blocks: [] });
        }
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const refreshTimeLogs = React.useCallback(() => {
    if (!taskId) return;
    getTimeLogsByTaskId(taskId).then((res) => {
      if (res.ok) {
        setTimeLogs((res.data as unknown as TimeLogRow[]) ?? []);
      }
    });
  }, [taskId]);

  const timeSummary = React.useMemo(() => {
    let total = 0;
    let billable = 0;
    for (const log of timeLogs) {
      const h = Number(log.hours ?? 0);
      if (!Number.isFinite(h) || h <= 0) continue;
      total += h;
      if (log.isBillable !== false) billable += h;
    }
    return { total, billable };
  }, [timeLogs]);

  const refreshDependencies = React.useCallback(() => {
    if (!taskId) return;
    getTaskDependencies(taskId).then((res) => {
      if (res.ok) {
        setDependencies({
          blockedBy: (res.data.blockedBy as DependencyRow[]) ?? [],
          blocks: (res.data.blocks as DependencyRow[]) ?? [],
        });
      }
    });
  }, [taskId]);

  const dependencyBlockedByIds = React.useMemo(
    () => new Set(dependencies.blockedBy.map((d) => d.dependsOnTaskId)),
    [dependencies.blockedBy]
  );

  const filteredDependencyCandidates = React.useMemo(() => {
    const query = dependencySearch.trim().toLowerCase();
    return candidateTasks.filter((candidate) => {
      if (!taskId) return false;
      if (candidate.id === taskId) return false;
      if (dependencyBlockedByIds.has(candidate.id)) return false;
      if (!query) return true;
      return candidate.title.toLowerCase().includes(query);
    });
  }, [candidateTasks, taskId, dependencyBlockedByIds, dependencySearch]);

  const handleAddDependency = React.useCallback(() => {
    if (!taskId || !selectedDependencyTaskId) return;
    setAddingDependency(true);
    addDependency({
      taskId,
      dependsOnTaskId: selectedDependencyTaskId,
      type: "finish_to_start",
    })
      .then((res) => {
        if (res.ok) {
          toast.success("Dependency added.");
          setSelectedDependencyTaskId("");
          setDependencySearch("");
          refreshDependencies();
          onSuccess();
          return;
        }

        if (typeof res.error === "string") {
          toast.error(res.error);
          return;
        }

        toast.error("Failed to add dependency.");
      })
      .finally(() => setAddingDependency(false));
  }, [taskId, selectedDependencyTaskId, refreshDependencies, onSuccess]);

  const handleRemoveDependency = React.useCallback(
    (dependencyId: string) => {
      removeDependency(dependencyId).then((res) => {
        if (res.ok) {
          toast.success("Dependency removed.");
          refreshDependencies();
          onSuccess();
          return;
        }
        toast.error(typeof res.error === "string" ? res.error : "Failed to remove dependency.");
      });
    },
    [refreshDependencies, onSuccess]
  );

  const handleUpdateTitle = React.useCallback(() => {
    if (!taskId || !task || titleEdit.trim() === task.title) return;
    updateTask({ id: taskId, title: titleEdit.trim() }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, title: titleEdit.trim() } : null));
        toast.success("Title updated");
        onSuccess();
      }
    });
  }, [taskId, task, titleEdit, onSuccess]);

  const handleUpdateDescription = React.useCallback(() => {
    if (!taskId || !task) return;
    updateTask({ id: taskId, description: descriptionEdit || null }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, description: descriptionEdit || null } : null));
        toast.success("Description updated");
        onSuccess();
      }
    });
  }, [taskId, task, descriptionEdit, onSuccess]);

  const handleStatusChange = React.useCallback(
    (status: string) => {
      if (!taskId || !task) return;
      updateTask({ id: taskId, status: status as TaskWithSubtasks["status"] }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, status: status as TaskWithSubtasks["status"] } : null));
          toast.success("Status updated");
          onSuccess();
        }
      });
    },
    [taskId, task, onSuccess]
  );

  const handlePriorityChange = React.useCallback(
    (priority: string) => {
      if (!taskId || !task) return;
      updateTask({ id: taskId, priority: priority as TaskWithSubtasks["priority"] }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, priority: priority as TaskWithSubtasks["priority"] } : null));
          toast.success("Priority updated");
          onSuccess();
        }
      });
    },
    [taskId, task, onSuccess]
  );

  const handleMilestoneChange = React.useCallback(
    (value: string) => {
      if (!taskId || !task) return;
      if (task.parentTaskId) {
        toast.error("Subtasks cannot be linked to a milestone.");
        return;
      }
      const milestoneId = value === "none" ? null : value;
      updateTask({ id: taskId, milestoneId }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, milestoneId } : null));
          toast.success("Milestone updated.");
          onSuccess();
        } else {
          const err = res.error;
          const msg =
            err && typeof err === "object" && "_form" in err && Array.isArray((err as { _form?: string[] })._form)
              ? (err as { _form: string[] })._form[0]
              : "Failed to update milestone.";
          toast.error(msg);
        }
      });
    },
    [taskId, task, onSuccess]
  );

  const handleAddSubtask = React.useCallback(() => {
    const title = newSubtaskTitle.trim();
    if (!taskId || !title) return;
    setAddingSubtask(true);
    createSubtask({ parentId: taskId, title })
      .then((res) => {
        if (res.ok && task) {
          setTask((prev) =>
            prev ? { ...prev, subtasks: [...prev.subtasks, res.data] } : null
          );
          setNewSubtaskTitle("");
          toast.success("Subtask added");
          onSuccess();
        }
      })
      .finally(() => setAddingSubtask(false));
  }, [taskId, newSubtaskTitle, task, onSuccess]);

  const handleToggleSubtask = React.useCallback(
    (subtaskId: string) => {
      toggleSubtask(subtaskId).then((res) => {
        if (res.ok && task) {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  subtasks: prev.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, status: res.data!.status } : s
                  ),
                }
              : null
          );
          onSuccess();
        }
      });
    },
    [task, onSuccess]
  );

  const beginEditSubtask = React.useCallback((s: TaskWithSubtasks["subtasks"][number]) => {
    setEditingSubtaskId(s.id);
    setSubtaskEditTitle(s.title);
  }, []);

  const commitSubtaskTitle = React.useCallback(
    (subtaskId: string, originalTitle: string, nextRaw: string) => {
      const trimmed = nextRaw.trim();
      if (!trimmed) {
        setEditingSubtaskId(null);
        setSubtaskEditTitle(originalTitle);
        toast.error("Subtask title cannot be empty.");
        return;
      }
      setEditingSubtaskId(null);
      if (trimmed === originalTitle) return;
      updateTask({ id: subtaskId, title: trimmed }).then((res) => {
        if (res.ok) {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  subtasks: prev.subtasks.map((x) =>
                    x.id === subtaskId ? { ...x, title: trimmed } : x
                  ),
                }
              : null
          );
          toast.success("Subtask updated");
          onSuccess();
        } else {
          const err = res.error;
          let msg = "Could not update subtask.";
          if (err && typeof err === "object") {
            const vals = Object.values(err as Record<string, string[] | undefined>).flatMap(
              (v) => v ?? []
            );
            if (vals[0]) msg = vals[0];
          }
          toast.error(msg);
        }
      });
    },
    [onSuccess]
  );

  const executeDeleteSubtask = React.useCallback(() => {
    if (!subtaskIdToDelete) return;
    const id = subtaskIdToDelete;
    setSubtaskIdToDelete(null);
    deleteTask(id).then((res) => {
      if (res.ok) {
        setTask((prev) =>
          prev ? { ...prev, subtasks: prev.subtasks.filter((x) => x.id !== id) } : null
        );
        setEditingSubtaskId((cur) => (cur === id ? null : cur));
        toast.success("Subtask deleted");
        onSuccess();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete subtask");
      }
    });
  }, [subtaskIdToDelete, onSuccess]);

  const handleDelete = React.useCallback(() => {
    if (!taskId) return;
    deleteTask(taskId).then((res) => {
      if (res.ok) {
        setDeleteConfirmOpen(false);
        onClose();
        toast.success("Task deleted");
        onSuccess();
      } else {
        toast.error(res.error);
      }
    });
  }, [taskId, onClose, onSuccess]);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto text-start sm:max-w-lg"
          dir="ltr"
          lang="en"
        >
          <DialogHeader>
            <DialogTitle className="sr-only">Task details</DialogTitle>
            <DialogDescription className="sr-only">View and edit this task</DialogDescription>
          </DialogHeader>
          {loading && !task ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
          ) : task ? (
            <div className="space-y-4 text-start" dir="ltr" lang="en">
              <Input
                className="text-lg font-bold"
                value={titleEdit}
                onChange={(e) => setTitleEdit(e.target.value)}
                onBlur={handleUpdateTitle}
              />
              <div className="flex flex-wrap gap-2">
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="ltr" lang="en" className="text-start">
                    {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABELS_EN[s]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="ltr" lang="en" className="text-start">
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS_EN[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span>Project:</span>
                <Link
                  href={`/dashboard/projects/${task.projectId}`}
                  className="text-primary inline-flex min-w-0 max-w-full items-center gap-2 underline"
                >
                  <ProjectSelectThumb
                    coverImageUrl={task.projectCoverImageUrl}
                    clientLogoUrl={task.projectClientLogoUrl}
                    fallbackName={task.projectName ?? "Project"}
                  />
                  <span className="truncate">{task.projectName}</span>
                </Link>
              </p>
              <p className="text-muted-foreground text-sm">
                Due date: {formatDate(task.dueDate)}
              </p>
              {!task.parentTaskId ? (
                <div className="space-y-1">
                  <label className="text-muted-foreground block text-sm">Milestone</label>
                  <Select
                    value={task.milestoneId ?? "none"}
                    onValueChange={handleMilestoneChange}
                  >
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="No milestone" />
                    </SelectTrigger>
                    <SelectContent dir="ltr" lang="en" className="text-start">
                      <SelectItem value="none">No milestone</SelectItem>
                      {milestoneOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Card className="gap-3 py-4">
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Time Logged</h4>
                    <span className="text-sm font-semibold">{formatHours(timeSummary.total)}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>Billable</span>
                    <span>{formatHours(timeSummary.billable)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TimerWidget taskId={task.id} onTimeLogged={refreshTimeLogs} />
                    <LogTimeDialog taskId={task.id} onSuccess={refreshTimeLogs} />
                  </div>
                </CardContent>
              </Card>
              <div>
                <label className="text-muted-foreground mb-1 block text-sm">Description</label>
                <Textarea
                  className="min-h-[80px] resize-none"
                  value={descriptionEdit}
                  onChange={(e) => setDescriptionEdit(e.target.value)}
                  onBlur={handleUpdateDescription}
                  placeholder="No description"
                />
              </div>
              <Card className="gap-3 py-4">
                <CardContent className="space-y-3 px-4">
                  <h4 className="text-sm font-medium">Dependencies</h4>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">Blocked by</p>
                    {dependencies.blockedBy.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No dependencies</p>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.blockedBy.map((dependency) => (
                          <div
                            key={dependency.id}
                            className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                          >
                            <Link
                              href={`/dashboard/projects/${dependency.dependsOnTask.projectId}`}
                              className="text-primary truncate text-sm underline"
                            >
                              {dependency.dependsOnTask.title}
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleRemoveDependency(dependency.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">Blocks</p>
                    {dependencies.blocks.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No dependencies</p>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.blocks.map((dependency) => (
                          <div
                            key={dependency.id}
                            className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                          >
                            <Link
                              href={`/dashboard/projects/${dependency.task.projectId}`}
                              className="text-primary truncate text-sm underline"
                            >
                              {dependency.task.title}
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleRemoveDependency(dependency.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Input
                        placeholder="Search tasks"
                        value={dependencySearch}
                        onChange={(e) => setDependencySearch(e.target.value)}
                      />
                      <Select
                        value={selectedDependencyTaskId}
                        onValueChange={setSelectedDependencyTaskId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a task" />
                        </SelectTrigger>
                        <SelectContent dir="ltr" lang="en" className="text-start">
                          {filteredDependencyCandidates.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No matching tasks
                            </SelectItem>
                          ) : (
                            filteredDependencyCandidates.map((candidate) => (
                              <SelectItem key={candidate.id} value={candidate.id}>
                                {candidate.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      className="self-end"
                      onClick={handleAddDependency}
                      disabled={!selectedDependencyTaskId || addingDependency}
                    >
                      + Add dependency
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {isAdmin && (
                <AssigneePicker
                  taskId={task.id}
                  teamMembers={teamMembers}
                  currentAssignees={currentAssignees}
                  onAssigneesChange={() => {
                    setCurrentAssignees((prev) => prev);
                    getTaskAssignees(task.id).then((res) => {
                      if (res.data) setCurrentAssignees(res.data);
                    });
                    onSuccess();
                  }}
                />
              )}
              {!isAdmin && currentAssignees.length > 0 && (
                <div className="space-y-2" dir="ltr">
                  <p className="text-muted-foreground text-sm font-medium">Assignees</p>
                  <div className="flex flex-wrap gap-2">
                    {currentAssignees.map((a) => (
                      <div key={a.userId} className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1">
                        <span className="text-xs">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="mb-2 font-medium">Subtasks</h4>
                <ul className="space-y-2">
                  {task.subtasks.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 rounded border p-2",
                        s.status === "done" && "opacity-60"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={s.status === "done"}
                        onChange={() => handleToggleSubtask(s.id)}
                        className="h-4 w-4 shrink-0"
                        aria-label={s.status === "done" ? "Mark subtask incomplete" : "Mark subtask complete"}
                      />
                      <div className="min-w-0 flex-1">
                        {editingSubtaskId === s.id ? (
                          <Input
                            className="h-8"
                            value={subtaskEditTitle}
                            onChange={(e) => setSubtaskEditTitle(e.target.value)}
                            onBlur={(e) => commitSubtaskTitle(s.id, s.title, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingSubtaskId(null);
                                setSubtaskEditTitle(s.title);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={cn(
                              "block truncate text-sm",
                              s.status === "done" && "line-through"
                            )}
                          >
                            {s.title}
                          </span>
                        )}
                      </div>
                      {editingSubtaskId !== s.id ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => beginEditSubtask(s)}
                            aria-label="Edit subtask"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8 shrink-0"
                            onClick={() => setSubtaskIdToDelete(s.id)}
                            aria-label="Delete subtask"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Add subtask"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubtask())}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || addingSubtask}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete task
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="ltr" lang="en" className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the task. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!subtaskIdToDelete} onOpenChange={(o) => !o && setSubtaskIdToDelete(null)}>
        <AlertDialogContent dir="ltr" lang="en" className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subtask?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the subtask. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteSubtask}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}