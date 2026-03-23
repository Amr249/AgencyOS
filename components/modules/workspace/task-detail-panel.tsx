"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createSubtask, getTaskById, toggleSubtask, updateTask } from "@/actions/tasks";
import {
  assignTask,
  createTaskComment,
  deleteTaskComment,
  deleteTimeLog,
  getTaskComments,
  getTimeLogs,
  logTime,
} from "@/actions/workspace";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/types";

type TeamMember = { id: string; name: string; avatarUrl: string | null; role: string | null };
type WorkspaceTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedHours: string | null;
  actualHours?: string | null;
  description?: string | null;
  assigneeId?: string | null;
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
    else toast.error("تعذر حفظ التغيير");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[560px] overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle>تفاصيل المهمة</SheetTitle>
          <SheetDescription>تحرير المهمة ومتابعة الوقت والتعليقات</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <Input
            value={localTask.title}
            className="text-lg font-semibold"
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
                  <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
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
                  <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
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
                if (!res.ok) toast.error("تعذر تعيين العضو");
                onRefresh();
              }}
            >
              <SelectTrigger><SelectValue placeholder="تعيين عضو" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون تعيين</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
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
              placeholder="تاريخ الاستحقاق"
            />
          </div>

          <Input
            type="number"
            step={0.5}
            min={0}
            placeholder="الساعات المقدّرة"
            value={localTask.estimatedHours ?? ""}
            onChange={(e) =>
              setLocalTask((prev) => (prev ? { ...prev, estimatedHours: e.target.value } : prev))
            }
            onBlur={() => patchTask({ id: localTask.id, estimatedHours: Number(localTask.estimatedHours || 0) })}
          />

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">تتبع الوقت</h4>
            <p className="text-sm text-muted-foreground">{loggedHours.toFixed(2)}h / {estimated || 0}h المقدّرة</p>
            <Progress value={progress} />
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span>{log.teamMemberName ?? "غير محدد"} — {numberValue(log.hours)}h</span>
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
                    حذف
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input type="number" step={0.25} min={0.25} max={24} value={newLogHours} onChange={(e) => setNewLogHours(Number(e.target.value))} />
              <Input value={newLogDescription} onChange={(e) => setNewLogDescription(e.target.value)} placeholder="الوصف" />
              <Button
                onClick={async () => {
                  const res = await logTime({ taskId: localTask.id, hours: newLogHours, description: newLogDescription });
                  if (!res.ok) return toast.error("تعذر تسجيل الوقت");
                  setNewLogDescription("");
                  const logsRes = await getTimeLogs(localTask.id);
                  if (logsRes.ok) setLogs(logsRes.data);
                  onRefresh();
                }}
              >
                تسجيل
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">المهام الفرعية</h4>
            {subtasks.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.status === "done"}
                  onChange={async () => {
                    await toggleSubtask(s.id);
                    const t = await getTaskById(localTask.id);
                    if (t.ok) setSubtasks((t.data.subtasks ?? []).map((st) => ({ id: st.id, title: st.title, status: st.status })));
                  }}
                />
                <span>{s.title}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="إضافة مهمة فرعية" />
              <Button
                onClick={async () => {
                  if (!newSubtask.trim()) return;
                  const created = await createSubtask({ parentId: localTask.id, title: newSubtask.trim() });
                  if (!created.ok) return toast.error("تعذر إضافة المهمة الفرعية");
                  setNewSubtask("");
                  const t = await getTaskById(localTask.id);
                  if (t.ok) setSubtasks((t.data.subtasks ?? []).map((st) => ({ id: st.id, title: st.title, status: st.status })));
                  onRefresh();
                }}
              >
                إضافة
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">التعليقات</h4>
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="secondary">{comment.authorName}</Badge>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await deleteTaskComment(comment.id);
                      const res = await getTaskComments(localTask.id);
                      if (res.ok) setComments(res.data);
                    }}>حذف</Button>
                  </div>
                  <p className="text-sm">{comment.body}</p>
                </div>
              ))}
            </div>
            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="اكتب تعليقًا..." />
            <Button
              onClick={async () => {
                const res = await createTaskComment(localTask.id, newComment);
                if (!res.ok) return toast.error("تعذر نشر التعليق");
                setNewComment("");
                const commentsRes = await getTaskComments(localTask.id);
                if (commentsRes.ok) setComments(commentsRes.data);
              }}
            >
              نشر
            </Button>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <h4 className="font-medium">الوصف</h4>
            <Textarea
              value={localTask.description ?? ""}
              onChange={(e) => setLocalTask((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              onBlur={() => patchTask({ id: localTask.id, description: localTask.description ?? null })}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
