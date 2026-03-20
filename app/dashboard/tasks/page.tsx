import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getTasks } from "@/actions/tasks";
import { getProjects } from "@/actions/projects";
import { getTeamMembers, getAssigneesForTaskIds } from "@/actions/assignments";
import { TasksPageContent } from "@/components/modules/tasks/tasks-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function TasksPage() {
  const [tasksResult, projectsResult, teamMembersResult] = await Promise.all([
    getTasks({}),
    getProjects({}),
    getTeamMembers(),
  ]);

  const tasks = tasksResult.ok ? tasksResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];
  const teamMembers = teamMembersResult.data ?? [];

  const taskIds = tasks.map((t) => t.id);
  const assigneesResult = await getAssigneesForTaskIds(taskIds);
  const assigneesByTaskId = assigneesResult.data ?? {};

  return (
    <div className="flex flex-col gap-4" dir="auto">
      <TasksPageContent
        initialTasks={tasks}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        teamMembers={teamMembers}
        assigneesByTaskId={assigneesByTaskId}
      />
    </div>
  );
}
