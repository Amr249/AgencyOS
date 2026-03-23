"use client";

import * as React from "react";
import { toast } from "sonner";
import { updateTaskStatus } from "@/actions/tasks";
import { NewTaskModal } from "@/components/modules/tasks/new-task-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskDetailPanel } from "@/components/modules/workspace/task-detail-panel";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import { TASK_PRIORITY_LABELS } from "@/types";
import { cn } from "@/lib/utils";

type TaskItem = any;

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

const sections = [
  { key: "today", title: "اليوم" },
  { key: "this_week", title: "هذا الأسبوع" },
  { key: "later", title: "لاحقاً" },
  { key: "no_date", title: "بدون تاريخ" },
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
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    today: true,
    this_week: true,
    later: true,
    no_date: true,
  });
  const [newOpen, setNewOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<any | null>(null);
  const [localGroups, setLocalGroups] = React.useState(groups);

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function markDone(task: TaskItem) {
    const res = await updateTaskStatus(task.id, "done");
    if (!res.ok) return toast.error("تعذر تحديث الحالة");
    setLocalGroups((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([groupName, tasks]) => [groupName, tasks.filter((t: any) => t.id !== task.id)])
      ) as any
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <WorkspaceNav />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">مهامي</h1>
        <Button onClick={() => setNewOpen(true)}>+ مهمة جديدة</Button>
      </div>

      {sections.map((section) => {
        const list = localGroups[section.key];
        return (
          <section key={section.key} className="rounded-xl border border-border">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-right"
              onClick={() => toggleSection(section.key)}
            >
              <span className="font-medium">{section.title}</span>
              <Badge variant="secondary">{list.length}</Badge>
            </button>
            {openSections[section.key] && (
              <div className="space-y-1 border-t p-2">
                {list.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">لا توجد مهام في هذا القسم.</p>
                ) : (
                  list.map((task: TaskItem) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <input type="checkbox" onChange={() => markDone(task)} />
                        <button className="truncate text-right hover:underline" onClick={() => setSelectedTask(task)}>
                          {task.title}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{task.projectName}</span>
                        <Badge variant="outline">{TASK_PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>
                        {task.assigneeName && <Badge variant="secondary">{task.assigneeName}</Badge>}
                        {task.dueDate && (
                          <span className={cn(isOverdue(task.dueDate) && "font-medium text-red-600")}>
                            {task.dueDate}
                          </span>
                        )}
                        {Number(task.actualHours ?? 0) > 0 && <Badge variant="secondary">{task.actualHours}h</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}

      <NewTaskModal open={newOpen} onOpenChange={setNewOpen} projects={projects} onSuccess={() => window.location.reload()} />
      <TaskDetailPanel
        task={selectedTask}
        teamMembers={teamMembers}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={() => window.location.reload()}
      />
    </div>
  );
}
