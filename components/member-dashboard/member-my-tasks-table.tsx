"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceMyTaskGroups, WorkspaceMyTaskRow } from "@/actions/workspace";
import type { TaskWithProject } from "@/actions/tasks";
import { TasksListView } from "@/components/modules/tasks/tasks-list-view";
import { TaskDetailModal } from "@/components/modules/tasks/task-detail-modal";

type MemberMyTasksTableProps = {
  groups: WorkspaceMyTaskGroups;
};

const GROUP_KEYS = [
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "later",
  "no_date",
] as const;

function toTaskWithProject(r: WorkspaceMyTaskRow): TaskWithProject {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    projectCoverImageUrl: r.projectCoverImageUrl,
    projectClientLogoUrl: r.projectClientLogoUrl,
    parentTaskId: null,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    startDate: r.startDate,
    dueDate: r.dueDate,
    notes: null,
    createdAt: r.createdAt,
    actualHours: r.actualHours ?? null,
  };
}

export function MemberMyTasksTable({ groups }: MemberMyTasksTableProps) {
  const router = useRouter();

  const allRows = React.useMemo(
    () => GROUP_KEYS.flatMap((k) => groups[k] ?? []),
    [groups]
  );

  const [tasks, setTasks] = React.useState<TaskWithProject[]>(() =>
    allRows.map(toTaskWithProject)
  );

  React.useEffect(() => {
    setTasks(allRows.map(toTaskWithProject));
  }, [allRows]);

  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null);

  const projectOptions = React.useMemo(() => {
    const seen = new Map<
      string,
      {
        id: string;
        name: string;
        coverImageUrl?: string | null;
        clientLogoUrl?: string | null;
      }
    >();
    for (const r of allRows) {
      if (!seen.has(r.projectId)) {
        seen.set(r.projectId, {
          id: r.projectId,
          name: r.projectName,
          coverImageUrl: r.projectCoverImageUrl,
          clientLogoUrl: r.projectClientLogoUrl,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [allRows]);

  const handleTaskPatched = React.useCallback(
    (id: string, patch: Partial<TaskWithProject>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    []
  );

  const handleSuccess = React.useCallback(() => {
    router.refresh();
  }, [router]);

  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm" dir="rtl">
        لا توجد مهام مسندة إليك حالياً.
      </p>
    );
  }

  return (
    <div dir="rtl" lang="ar">
      <TasksListView
        tasks={tasks}
        assigneesByTaskId={{}}
        projectOptions={projectOptions}
        teamMembers={[]}
        onOpenTask={(id) => setDetailTaskId(id)}
        onDeleteTask={() => {
          /* members cannot delete tasks from their hub */
        }}
        onTaskPatched={handleTaskPatched}
        onAssigneesRefresh={handleSuccess}
        memberView
        memberCanEdit
      />

      <TaskDetailModal
        taskId={detailTaskId}
        teamMembers={[]}
        onClose={() => setDetailTaskId(null)}
        onSuccess={handleSuccess}
        memberView
      />
    </div>
  );
}
