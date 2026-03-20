"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  getTaskById,
  updateTask,
  deleteTask,
  createSubtask,
  toggleSubtask,
} from "@/actions/tasks";
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
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_CLASS } from "@/types";
import { cn } from "@/lib/utils";

type TaskWithSubtasks = {
  id: string;
  projectId: string;
  projectName: string | null;
  parentTaskId: string | null;
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

type TaskDetailModalProps = {
  taskId: string | null;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSuccess: () => void;
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
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

  const open = !!taskId;

  React.useEffect(() => {
    if (!taskId) {
      setTask(null);
      setCurrentAssignees([]);
      return;
    }
    setLoading(true);
    Promise.all([
      getTaskById(taskId),
      getTaskAssignees(taskId),
    ])
      .then(([taskRes, assigneesRes]) => {
        if (taskRes.ok) {
          const data = taskRes.data as TaskWithSubtasks;
          setTask(data);
          setTitleEdit(data.title);
          setDescriptionEdit(data.description ?? "");
        }
        if (assigneesRes.data) {
          setCurrentAssignees(assigneesRes.data);
        }
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleUpdateTitle = React.useCallback(() => {
    if (!taskId || !task || titleEdit.trim() === task.title) return;
    updateTask({ id: taskId, title: titleEdit.trim() }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, title: titleEdit.trim() } : null));
        toast.success("تم تحديث العنوان");
        onSuccess();
      }
    });
  }, [taskId, task, titleEdit, onSuccess]);

  const handleUpdateDescription = React.useCallback(() => {
    if (!taskId || !task) return;
    updateTask({ id: taskId, description: descriptionEdit || null }).then((res) => {
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, description: descriptionEdit || null } : null));
        toast.success("تم تحديث الوصف");
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
          toast.success("تم تحديث الحالة");
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
          toast.success("تم تحديث الأولوية");
          onSuccess();
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
          toast.success("تمت إضافة المهمة الفرعية");
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

  const handleDelete = React.useCallback(() => {
    if (!taskId) return;
    deleteTask(taskId).then((res) => {
      if (res.ok) {
        setDeleteConfirmOpen(false);
        onClose();
        toast.success("تم حذف المهمة");
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="sr-only">تفاصيل المهمة</DialogTitle>
            <DialogDescription className="sr-only">عرض وتعديل المهمة</DialogDescription>
          </DialogHeader>
          {loading && !task ? (
            <p className="text-muted-foreground py-8 text-center">جاري التحميل...</p>
          ) : task ? (
            <div className="space-y-4">
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
                  <SelectContent>
                    {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground text-sm">
                المشروع:{" "}
                <Link
                  href={`/dashboard/projects/${task.projectId}`}
                  className="text-primary underline"
                >
                  {task.projectName}
                </Link>
              </p>
              <p className="text-muted-foreground text-sm">
                تاريخ الاستحقاق: {formatDate(task.dueDate)}
              </p>
              <div>
                <label className="text-muted-foreground mb-1 block text-sm">الوصف</label>
                <Textarea
                  className="min-h-[80px] resize-none"
                  value={descriptionEdit}
                  onChange={(e) => setDescriptionEdit(e.target.value)}
                  onBlur={handleUpdateDescription}
                  placeholder="لا يوجد وصف"
                />
              </div>
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
                <div className="space-y-2" dir="rtl">
                  <p className="text-sm font-medium text-muted-foreground">المُعيَّنون</p>
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
                <h4 className="mb-2 font-medium">المهام الفرعية</h4>
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
                        className="h-4 w-4"
                      />
                      <span className={cn(s.status === "done" && "line-through")}>{s.title}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="إضافة مهمة فرعية"
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
                    إضافة
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                حذف المهمة
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المهمة ولا يمكن التراجع عن ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}