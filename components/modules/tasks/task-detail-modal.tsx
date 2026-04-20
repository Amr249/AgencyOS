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
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_LABELS_EN,
} from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { addDependency, getTaskDependencies, removeDependency } from "@/actions/task-dependencies";
import { CalendarIcon, Pencil, Trash2, X } from "lucide-react";
import { ProjectSelectThumb } from "@/components/entity-select-option";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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
  /** Team member portal: no links to project pages. */
  memberView?: boolean;
};

const TASK_LOAD_ERROR_AR: Record<string, string> = {
  Forbidden: "لا يمكنك فتح هذه المهمة.",
  "Task not found": "المهمة غير موجودة.",
  "Invalid task id": "معرّف المهمة غير صالح.",
};

const EN_UI = {
  loading: "Loading…",
  couldNotLoad: "Could not load this task.",
  srTitle: "Task details",
  srDesc: "View and edit this task",
  project: "Project:",
  dueDateLabel: "Due date",
  clearDueDate: "Clear date",
  tDueDateUpdated: "Due date updated",
  tDueDateFail: "Could not update due date",
  milestone: "Milestone",
  noMilestone: "No milestone",
  description: "Description",
  noDescriptionPh: "No description",
  dependencies: "Dependencies",
  blockedBy: "Blocked by",
  blocks: "Blocks",
  noDependencies: "No dependencies",
  searchTasks: "Search tasks",
  selectTask: "Select a task",
  noMatchingTasks: "No matching tasks",
  addDependency: "+ Add dependency",
  assignees: "Assignees",
  subtasks: "Subtasks",
  addSubtaskPh: "Add subtask",
  add: "Add",
  deleteTask: "Delete task",
  ariaMarkComplete: "Mark subtask complete",
  ariaMarkIncomplete: "Mark subtask incomplete",
  ariaEditSubtask: "Edit subtask",
  ariaDeleteSubtask: "Delete subtask",
  deleteTaskTitle: "Delete this task?",
  deleteTaskDesc: "This will remove the task. This action cannot be undone.",
  deleteSubtaskTitle: "Delete this subtask?",
  deleteSubtaskDesc: "This will remove the subtask. This action cannot be undone.",
  cancel: "Cancel",
  delete: "Delete",
  projectFallback: "Project",
  tDepAdded: "Dependency added.",
  tDepAddFail: "Failed to add dependency.",
  tDepRemoved: "Dependency removed.",
  tDepRemoveFail: "Failed to remove dependency.",
  tTitleUpdated: "Title updated",
  tDescUpdated: "Description updated",
  tStatusUpdated: "Status updated",
  tPriorityUpdated: "Priority updated",
  tSubtaskMilestone: "Subtasks cannot be linked to a milestone.",
  tMilestoneUpdated: "Milestone updated.",
  tMilestoneFail: "Failed to update milestone.",
  tSubtaskAdded: "Subtask added",
  tSubtaskTitleEmpty: "Subtask title cannot be empty.",
  tSubtaskUpdated: "Subtask updated",
  tSubtaskUpdateFail: "Could not update subtask.",
  tSubtaskDeleted: "Subtask deleted",
  tSubtaskDeleteFail: "Failed to delete subtask",
  tTaskDeleted: "Task deleted",
} as const;

type TaskDetailUi = typeof EN_UI;

const AR_UI: { [K in keyof TaskDetailUi]: string } = {
  loading: "جاري التحميل…",
  couldNotLoad: "تعذر تحميل هذه المهمة.",
  srTitle: "تفاصيل المهمة",
  srDesc: "عرض المهمة وتعديلها",
  project: "المشروع:",
  dueDateLabel: "تاريخ الاستحقاق",
  clearDueDate: "مسح التاريخ",
  tDueDateUpdated: "تم تحديث تاريخ الاستحقاق",
  tDueDateFail: "تعذّر تحديث تاريخ الاستحقاق",
  milestone: "المعلم",
  noMilestone: "بدون معلم",
  description: "الوصف",
  noDescriptionPh: "لا يوجد وصف",
  dependencies: "التبعيات",
  blockedBy: "محجوب بسبب",
  blocks: "يحجب",
  noDependencies: "لا توجد تبعيات",
  searchTasks: "البحث في المهام",
  selectTask: "اختر مهمة",
  noMatchingTasks: "لا مهام مطابقة",
  addDependency: "+ إضافة تبعية",
  assignees: "المكلفون",
  subtasks: "المهام الفرعية",
  addSubtaskPh: "إضافة مهمة فرعية",
  add: "إضافة",
  deleteTask: "حذف المهمة",
  ariaMarkComplete: "تعيين المهمة الفرعية كمكتملة",
  ariaMarkIncomplete: "إلغاء إكمال المهمة الفرعية",
  ariaEditSubtask: "تعديل المهمة الفرعية",
  ariaDeleteSubtask: "حذف المهمة الفرعية",
  deleteTaskTitle: "حذف هذه المهمة؟",
  deleteTaskDesc: "سيتم حذف المهمة. لا يمكن التراجع عن هذا الإجراء.",
  deleteSubtaskTitle: "حذف هذه المهمة الفرعية؟",
  deleteSubtaskDesc: "سيتم حذف المهمة الفرعية. لا يمكن التراجع عن هذا الإجراء.",
  cancel: "إلغاء",
  delete: "حذف",
  projectFallback: "مشروع",
  tDepAdded: "تمت إضافة التبعية.",
  tDepAddFail: "تعذر إضافة التبعية.",
  tDepRemoved: "تمت إزالة التبعية.",
  tDepRemoveFail: "تعذر إزالة التبعية.",
  tTitleUpdated: "تم تحديث العنوان",
  tDescUpdated: "تم تحديث الوصف",
  tStatusUpdated: "تم تحديث الحالة",
  tPriorityUpdated: "تم تحديث الأولوية",
  tSubtaskMilestone: "لا يمكن ربط المهام الفرعية بمعلم.",
  tMilestoneUpdated: "تم تحديث المعلم.",
  tMilestoneFail: "تعذر تحديث المعلم.",
  tSubtaskAdded: "تمت إضافة المهمة الفرعية",
  tSubtaskTitleEmpty: "عنوان المهمة الفرعية مطلوب.",
  tSubtaskUpdated: "تم تحديث المهمة الفرعية",
  tSubtaskUpdateFail: "تعذر تحديث المهمة الفرعية.",
  tSubtaskDeleted: "تم حذف المهمة الفرعية",
  tSubtaskDeleteFail: "تعذر حذف المهمة الفرعية",
  tTaskDeleted: "تم حذف المهمة",
};

function formatTaskDate(d: string | null, memberView: boolean) {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString(memberView ? "ar-SA" : "en-US", {
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

export function TaskDetailModal({
  taskId,
  teamMembers,
  onClose,
  onSuccess,
  memberView = false,
}: TaskDetailModalProps) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const ui = React.useMemo(() => (memberView ? AR_UI : EN_UI), [memberView]);
  const statusLabels = memberView ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;
  const priorityLabels = memberView ? TASK_PRIORITY_LABELS : TASK_PRIORITY_LABELS_EN;
  const layoutDir = memberView ? "rtl" : "ltr";
  const layoutLang = memberView ? "ar" : "en";

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
  const [dependencies, setDependencies] = React.useState<DependencyState>({ blockedBy: [], blocks: [] });
  const [candidateTasks, setCandidateTasks] = React.useState<CandidateTask[]>([]);
  const [dependencySearch, setDependencySearch] = React.useState("");
  const [selectedDependencyTaskId, setSelectedDependencyTaskId] = React.useState("");
  const [addingDependency, setAddingDependency] = React.useState(false);
  const [milestoneOptions, setMilestoneOptions] = React.useState<MilestoneOption[]>([]);
  const [dueDateOpen, setDueDateOpen] = React.useState(false);
  const [savingDueDate, setSavingDueDate] = React.useState(false);

  const open = !!taskId;

  React.useEffect(() => {
    if (!taskId) {
      setTask(null);
      setCurrentAssignees([]);
      setDependencies({ blockedBy: [], blocks: [] });
      setCandidateTasks([]);
      setDependencySearch("");
      setSelectedDependencyTaskId("");
      setMilestoneOptions([]);
      setEditingSubtaskId(null);
      setSubtaskEditTitle("");
      setSubtaskIdToDelete(null);
      setDueDateOpen(false);
      return;
    }
    setDueDateOpen(false);
    setTask(null);
    setLoading(true);
    Promise.all([
      getTaskById(taskId),
      getTaskAssignees(taskId),
      getTaskDependencies(taskId),
    ])
      .then(([taskRes, assigneesRes, dependencyRes]) => {
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
        } else {
          setTask(null);
          const err = taskRes.error;
          if (memberView) {
            const key = typeof err === "string" ? err : "";
            toast.error(TASK_LOAD_ERROR_AR[key] ?? "تعذر تحميل المهمة.");
          } else {
            toast.error(
              err === "Forbidden"
                ? "You cannot open this task."
                : err === "Task not found"
                  ? "Task not found."
                  : err === "Invalid task id"
                    ? "Invalid task."
                    : "Could not load task."
            );
          }
          onClose();
        }
        if (assigneesRes.data) {
          setCurrentAssignees(assigneesRes.data);
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
  }, [taskId, memberView]);

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
          toast.success(ui.tDepAdded);
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

        toast.error(ui.tDepAddFail);
      })
      .finally(() => setAddingDependency(false));
  }, [taskId, selectedDependencyTaskId, refreshDependencies, onSuccess, ui]);

  const handleRemoveDependency = React.useCallback(
    (dependencyId: string) => {
      removeDependency(dependencyId).then((res) => {
        if (res.ok) {
          toast.success(ui.tDepRemoved);
          refreshDependencies();
          onSuccess();
          return;
        }
        toast.error(typeof res.error === "string" ? res.error : ui.tDepRemoveFail);
      });
    },
    [refreshDependencies, onSuccess, ui]
  );

  const handleUpdateTitle = React.useCallback(() => {
    if (!taskId || !task || titleEdit.trim() === task.title) return;
    updateTask({ id: taskId, title: titleEdit.trim() }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, title: titleEdit.trim() } : null));
        toast.success(ui.tTitleUpdated);
        onSuccess();
      }
    });
  }, [taskId, task, titleEdit, onSuccess, ui]);

  const handleUpdateDescription = React.useCallback(() => {
    if (!taskId || !task) return;
    updateTask({ id: taskId, description: descriptionEdit || null }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, description: descriptionEdit || null } : null));
        toast.success(ui.tDescUpdated);
        onSuccess();
      }
    });
  }, [taskId, task, descriptionEdit, onSuccess, ui]);

  const handleStatusChange = React.useCallback(
    (status: string) => {
      if (!taskId || !task) return;
      updateTask({ id: taskId, status: status as TaskWithSubtasks["status"] }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, status: status as TaskWithSubtasks["status"] } : null));
          toast.success(ui.tStatusUpdated);
          onSuccess();
        }
      });
    },
    [taskId, task, onSuccess, ui]
  );

  const handlePriorityChange = React.useCallback(
    (priority: string) => {
      if (!taskId || !task) return;
      updateTask({ id: taskId, priority: priority as TaskWithSubtasks["priority"] }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, priority: priority as TaskWithSubtasks["priority"] } : null));
          toast.success(ui.tPriorityUpdated);
          onSuccess();
        }
      });
    },
    [taskId, task, onSuccess, ui]
  );

  const handleDueDateSelect = React.useCallback(
    (next: string | null) => {
      if (!taskId || !task) return;
      if (next === task.dueDate) {
        setDueDateOpen(false);
        return;
      }
      setSavingDueDate(true);
      updateTask({ id: taskId, dueDate: next }).then((res) => {
        setSavingDueDate(false);
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, dueDate: next } : null));
          toast.success(ui.tDueDateUpdated);
          setDueDateOpen(false);
          onSuccess();
          return;
        }
        const err = res.error;
        let msg = ui.tDueDateFail;
        if (err && typeof err === "object" && "_form" in err) {
          const f = (err as { _form?: string[] })._form;
          if (f?.[0]) msg = f[0];
        } else if (typeof err === "string") {
          msg = err;
        }
        toast.error(msg);
      });
    },
    [taskId, task, onSuccess, ui]
  );

  const handleMilestoneChange = React.useCallback(
    (value: string) => {
      if (!taskId || !task) return;
      if (task.parentTaskId) {
        toast.error(ui.tSubtaskMilestone);
        return;
      }
      const milestoneId = value === "none" ? null : value;
      updateTask({ id: taskId, milestoneId }).then((res) => {
        if (res.ok) {
          setTask((prev) => (prev ? { ...prev, milestoneId } : null));
          toast.success(ui.tMilestoneUpdated);
          onSuccess();
        } else {
          const err = res.error;
          const msg =
            err && typeof err === "object" && "_form" in err && Array.isArray((err as { _form?: string[] })._form)
              ? (err as { _form: string[] })._form[0]
              : ui.tMilestoneFail;
          toast.error(msg);
        }
      });
    },
    [taskId, task, onSuccess, ui]
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
          toast.success(ui.tSubtaskAdded);
          onSuccess();
        }
      })
      .finally(() => setAddingSubtask(false));
  }, [taskId, newSubtaskTitle, task, onSuccess, ui]);

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
        toast.error(ui.tSubtaskTitleEmpty);
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
          toast.success(ui.tSubtaskUpdated);
          onSuccess();
        } else {
          const err = res.error;
          let msg = ui.tSubtaskUpdateFail;
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
    [onSuccess, ui]
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
        toast.success(ui.tSubtaskDeleted);
        onSuccess();
      } else {
        toast.error(typeof res.error === "string" ? res.error : ui.tSubtaskDeleteFail);
      }
    });
  }, [subtaskIdToDelete, onSuccess, ui]);

  const handleDelete = React.useCallback(() => {
    if (!taskId) return;
    deleteTask(taskId).then((res) => {
      if (res.ok) {
        setDeleteConfirmOpen(false);
        onClose();
        toast.success(ui.tTaskDeleted);
        onSuccess();
      } else {
        toast.error(res.error);
      }
    });
  }, [taskId, onClose, onSuccess, ui]);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto text-start sm:max-w-lg"
          dir={layoutDir}
          lang={layoutLang}
        >
          <DialogHeader>
            <DialogTitle className="sr-only">{ui.srTitle}</DialogTitle>
            <DialogDescription className="sr-only">{ui.srDesc}</DialogDescription>
          </DialogHeader>
          {loading && !task ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{ui.loading}</p>
          ) : task ? (
            <div className="space-y-4 text-start" dir={layoutDir} lang={layoutLang}>
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
                  <SelectContent dir={layoutDir} lang={layoutLang} className="text-start">
                    {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabels[s] ?? TASK_STATUS_LABELS_EN[s]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir={layoutDir} lang={layoutLang} className="text-start">
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {priorityLabels[p] ?? TASK_PRIORITY_LABELS_EN[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span>{ui.project}</span>
                {memberView ? (
                  <span className="text-foreground inline-flex min-w-0 max-w-full items-center gap-2">
                    <ProjectSelectThumb
                      coverImageUrl={task.projectCoverImageUrl}
                      clientLogoUrl={task.projectClientLogoUrl}
                      fallbackName={task.projectName ?? ui.projectFallback}
                    />
                    <span className="truncate">{task.projectName}</span>
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/projects/${task.projectId}`}
                    className="text-primary inline-flex min-w-0 max-w-full items-center gap-2 underline"
                  >
                    <ProjectSelectThumb
                      coverImageUrl={task.projectCoverImageUrl}
                      clientLogoUrl={task.projectClientLogoUrl}
                      fallbackName={task.projectName ?? ui.projectFallback}
                    />
                    <span className="truncate">{task.projectName}</span>
                  </Link>
                )}
              </p>
              <div className="space-y-1">
                <label htmlFor={`task-due-${task.id}`} className="text-muted-foreground block text-sm">
                  {ui.dueDateLabel}
                </label>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id={`task-due-${task.id}`}
                      type="button"
                      variant="outline"
                      disabled={savingDueDate}
                      className={cn(
                        "min-w-[10rem] justify-start gap-2 font-normal",
                        !task.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      {formatTaskDate(task.dueDate, memberView)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align={memberView ? "end" : "start"}
                    dir={layoutDir}
                  >
                    <Calendar
                      mode="single"
                      selected={task.dueDate ? new Date(task.dueDate + "T12:00:00") : undefined}
                      onSelect={(d) => {
                        void handleDueDateSelect(d ? toIsoDate(d) : null);
                      }}
                      initialFocus
                    />
                    {task.dueDate ? (
                      <div className="flex items-center justify-end border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={savingDueDate}
                          onClick={() => void handleDueDateSelect(null)}
                        >
                          {ui.clearDueDate}
                        </Button>
                      </div>
                    ) : null}
                  </PopoverContent>
                </Popover>
              </div>
              {!task.parentTaskId ? (
                <div className="space-y-1">
                  <label className="text-muted-foreground block text-sm">{ui.milestone}</label>
                  <Select
                    value={task.milestoneId ?? "none"}
                    onValueChange={handleMilestoneChange}
                  >
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder={ui.noMilestone} />
                    </SelectTrigger>
                    <SelectContent dir={layoutDir} lang={layoutLang} className="text-start">
                      <SelectItem value="none">{ui.noMilestone}</SelectItem>
                      {milestoneOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="text-muted-foreground mb-1 block text-sm">{ui.description}</label>
                <Textarea
                  className="min-h-[80px] resize-none"
                  value={descriptionEdit}
                  onChange={(e) => setDescriptionEdit(e.target.value)}
                  onBlur={handleUpdateDescription}
                  placeholder={ui.noDescriptionPh}
                />
              </div>
              <Card className="gap-3 py-4">
                <CardContent className="space-y-3 px-4">
                  <h4 className="text-sm font-medium">{ui.dependencies}</h4>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">{ui.blockedBy}</p>
                    {dependencies.blockedBy.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{ui.noDependencies}</p>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.blockedBy.map((dependency) => (
                          <div
                            key={dependency.id}
                            className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                          >
                            {memberView ? (
                              <span className="truncate text-sm">{dependency.dependsOnTask.title}</span>
                            ) : (
                              <Link
                                href={`/dashboard/projects/${dependency.dependsOnTask.projectId}`}
                                className="text-primary truncate text-sm underline"
                              >
                                {dependency.dependsOnTask.title}
                              </Link>
                            )}
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
                    <p className="text-muted-foreground text-xs font-medium">{ui.blocks}</p>
                    {dependencies.blocks.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{ui.noDependencies}</p>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.blocks.map((dependency) => (
                          <div
                            key={dependency.id}
                            className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                          >
                            {memberView ? (
                              <span className="truncate text-sm">{dependency.task.title}</span>
                            ) : (
                              <Link
                                href={`/dashboard/projects/${dependency.task.projectId}`}
                                className="text-primary truncate text-sm underline"
                              >
                                {dependency.task.title}
                              </Link>
                            )}
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
                        placeholder={ui.searchTasks}
                        value={dependencySearch}
                        onChange={(e) => setDependencySearch(e.target.value)}
                      />
                      <Select
                        value={selectedDependencyTaskId}
                        onValueChange={setSelectedDependencyTaskId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={ui.selectTask} />
                        </SelectTrigger>
                        <SelectContent dir={layoutDir} lang={layoutLang} className="text-start">
                          {filteredDependencyCandidates.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              {ui.noMatchingTasks}
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
                      {ui.addDependency}
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
                <div className="space-y-2" dir={layoutDir}>
                  <p className="text-muted-foreground text-sm font-medium">{ui.assignees}</p>
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
                <h4 className="mb-2 font-medium">{ui.subtasks}</h4>
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
                        aria-label={s.status === "done" ? ui.ariaMarkIncomplete : ui.ariaMarkComplete}
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
                            aria-label={ui.ariaEditSubtask}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8 shrink-0"
                            onClick={() => setSubtaskIdToDelete(s.id)}
                            aria-label={ui.ariaDeleteSubtask}
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
                    placeholder={ui.addSubtaskPh}
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
                    {ui.add}
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                {ui.deleteTask}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">{ui.couldNotLoad}</p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={layoutDir} lang={layoutLang} className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.deleteTaskTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ui.deleteTaskDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={memberView ? "flex-row-reverse gap-2 sm:justify-start" : undefined}>
            <AlertDialogCancel>{ui.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {ui.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!subtaskIdToDelete} onOpenChange={(o) => !o && setSubtaskIdToDelete(null)}>
        <AlertDialogContent dir={layoutDir} lang={layoutLang} className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.deleteSubtaskTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ui.deleteSubtaskDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={memberView ? "flex-row-reverse gap-2 sm:justify-start" : undefined}>
            <AlertDialogCancel>{ui.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteSubtask}
              className="bg-destructive text-destructive-foreground"
            >
              {ui.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}