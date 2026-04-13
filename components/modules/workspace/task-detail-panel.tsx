"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TaskCommentInput } from "@/components/modules/tasks/task-comment-input";
import { TaskCommentBody } from "@/components/modules/tasks/task-comment-body";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createSubtask, deleteTask, getTaskById, toggleSubtask, updateTask } from "@/actions/tasks";
import { TeamMemberSelectOptionRow } from "@/components/entity-select-option";
import {
  assignTask,
  createTaskComment,
  deleteTaskComment,
  deleteTimeLog,
  getTaskComments,
  getTimeLogs,
  logTime,
} from "@/actions/workspace";

type TeamMember = { id: string; name: string; avatarUrl: string | null; role: string | null };
export type WorkspaceTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours?: string | null;
  description?: string | null;
  assigneeId?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function numberValue(value: string | number | null | undefined) {
  if (value == null) return 0;
  return Number(value) || 0;
}

export function TaskDetailPanel({
  task,
  teamMembers,
  open,
  onOpenChange,
  onRefresh,
}: {
  task: WorkspaceTask | null;
  teamMembers: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const [localTask, setLocalTask] = React.useState<WorkspaceTask | null>(task);
  const [subtasks, setSubtasks] = React.useState<Array<{ id: string; title: string; status: string }>>([]);
  const [logs, setLogs] = React.useState<any[]>([]);
  const [comments, setComments] = React.useState<any[]>([]);
  const [newLogHours, setNewLogHours] = React.useState<number>(1);
  const [newLogDescription, setNewLogDescription] = React.useState("");
  const [newComment, setNewComment] = React.useState("");
  const [newSubtask, setNewSubtask] = React.useState("");

  React.useEffect(() => {
    setLocalTask(task);
    if (!task?.id) return;
    getTaskById(task.id).then((res) => {
      if (res.ok) setSubtasks((res.data.subtasks ?? []).map((s) => ({ id: s.id, title: s.title, status: s.status })));
    });
    getTimeLogs(task.id).then((res) => {
      if (res.ok) setLogs(res.data);
    });
    getTaskComments(task.id).then((res) => {
      if (res.ok) setComments(res.data);
    });
  }, [task]);

  if (!localTask) return null;

  const loggedHours = logs.reduce((sum, log) => sum + numberValue(log.hours), 0);
  const estimated = numberValue(localTask.estimatedHours);
  const progress = estimated > 0 ? Math.min(100, (loggedHours / estimated) * 100) : 0;

  async function patchTask(patch: Parameters<typeof updateTask>[0]) {
    const res = await updateTask(patch);
    if (res.ok) onRefresh();
    else toast.error("Failed to save change.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[560px] overflow-y-auto" dir="ltr">
        <SheetHeader>
          <SheetTitle>Task Details</SheetTitle>
          <SheetDescription>Edit task, track time, and comments</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <Input
            value={localTask.title}
            className="text-lg font-semibold"
            dir="auto"
            onChange={(e) => setLocalTask((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
            onBlur={() => patchTask({ id: localTask.id, title: localTask.title })}
          />

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={localTask.status}
              onValueChange={(status) => {
                setLocalTask((prev) => (prev ? { ...prev, status: status as any } : prev));
                patchTask({ id: localTask.id, status: status as any });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={localTask.priority}
              onValueChange={(priority) => {
                setLocalTask((prev) => (prev ? { ...prev, priority: priority as any } : prev));
                patchTask({ id: localTask.id, priority: priority as any });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={localTask.assigneeId ?? "none"}
              onValueChange={async (value) => {
                const memberId = value === "none" ? null : value;
                setLocalTask((prev) => (prev ? { ...prev, assigneeId: memberId } : prev));
                const res = await assignTask(localTask.id, memberId);
                if (!res.ok) toast.error("Failed to assign member.");
                onRefresh();
              }}
            >
              <SelectTrigger><SelectValue placeholder="Assign member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id} textValue={member.name}>
                    <TeamMemberSelectOptionRow avatarUrl={member.avatarUrl} name={member.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerAr
              value={localTask.dueDate ? new Date(`${localTask.dueDate}T12:00:00`) : undefined}
              onChange={(date) => {
                const dueDate = date ? format(date, "yyyy-MM-dd") : null;
                setLocalTask((prev) => (prev ? { ...prev, dueDate } : prev));
                patchTask({ id: localTask.id, dueDate });
              }}
              placeholder="Due date"
            />
          </div>

          <Input
            type="number"
            step={0.5}
            min={0}
            placeholder="Estimated hours"
            value={localTask.estimatedHours ?? ""}
            onChange={(e) =>
              setLocalTask((prev) => (prev ? { ...prev, estimatedHours: e.target.value } : prev))
            }
            onBlur={() => patchTask({ id: localTask.id, estimatedHours: Number(localTask.estimatedHours || 0) })}
          />

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">Time Tracking</h4>
            <p className="text-sm text-muted-foreground">{loggedHours.toFixed(2)}h / {estimated || 0}h estimated</p>
            <Progress value={progress} />
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span>{log.teamMemberName ?? "Unknown"} — {numberValue(log.hours)}h</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await deleteTimeLog(log.id);
                      const res = await getTimeLogs(localTask.id);
                      if (res.ok) setLogs(res.data);
                      onRefresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input type="number" step={0.25} min={0.25} max={24} value={newLogHours} onChange={(e) => setNewLogHours(Number(e.target.value))} />
              <Input value={newLogDescription} onChange={(e) => setNewLogDescription(e.target.value)} placeholder="Description" />
              <Button
                onClick={async () => {
                  const res = await logTime({ taskId: localTask.id, hours: newLogHours, description: newLogDescription });
                  if (!res.ok) return toast.error("Failed to log time.");
                  setNewLogDescription("");
                  const logsRes = await getTimeLogs(localTask.id);
                  if (logsRes.ok) setLogs(logsRes.data);
                  onRefresh();
                }}
              >
                Log
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">Subtasks</h4>
            {subtasks.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.status === "done"}
                  onChange={async () => {
                    await toggleSubtask(s.id);
                    const refreshed = await getTaskById(localTask.id);
                    if (refreshed.ok) setSubtasks((refreshed.data.subtasks ?? []).map((st) => ({ id: st.id, title: st.title, status: st.status })));
                  }}
                />
                <span dir="auto">{s.title}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Add subtask" />
              <Button
                onClick={async () => {
                  if (!newSubtask.trim()) return;
                  const created = await createSubtask({ parentId: localTask.id, title: newSubtask.trim() });
                  if (!created.ok) return toast.error("Failed to add subtask.");
                  setNewSubtask("");
                  const refreshed = await getTaskById(localTask.id);
                  if (refreshed.ok) setSubtasks((refreshed.data.subtasks ?? []).map((st) => ({ id: st.id, title: st.title, status: st.status })));
                  onRefresh();
                }}
              >
                Add
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">Comments</h4>
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="secondary">{comment.authorName}</Badge>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await deleteTaskComment(comment.id);
                      const res = await getTaskComments(localTask.id);
                      if (res.ok) setComments(res.data);
                    }}>Delete</Button>
                  </div>
                  <TaskCommentBody body={comment.body} />
                </div>
              ))}
            </div>
            <TaskCommentInput
              value={newComment}
              onChange={setNewComment}
              teamMembers={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
              placeholder="Write a comment… Use @ to mention someone"
            />
            <Button
              onClick={async () => {
                const res = await createTaskComment(localTask.id, newComment);
                if (!res.ok) return toast.error("Failed to post comment.");
                setNewComment("");
                const commentsRes = await getTaskComments(localTask.id);
                if (commentsRes.ok) setComments(commentsRes.data);
              }}
            >
              Post
            </Button>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">Description</h4>
            <Textarea
              dir="auto"
              value={localTask.description ?? ""}
              onChange={(e) => setLocalTask((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              onBlur={() => patchTask({ id: localTask.id, description: localTask.description ?? null })}
            />
          </section>

          <div className="border-t pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                  Delete task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete &ldquo;{localTask.title}&rdquo;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      const res = await deleteTask(localTask.id);
                      if (!res.ok) return toast.error("Failed to delete task.");
                      toast.success("Task deleted.");
                      onOpenChange(false);
                      onRefresh();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
