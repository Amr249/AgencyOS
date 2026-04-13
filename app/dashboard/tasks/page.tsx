import type { Metadata } from "next";
import { getTasks } from "@/actions/tasks";
import { getProjects } from "@/actions/projects";
import { getTeamMembers, getAssigneesForTaskIds } from "@/actions/assignments";
import { TasksPageContent } from "@/components/modules/tasks/tasks-page-content";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Tasks",
    description: "View and manage tasks in Kanban or list view.",
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
  const teamMembersRaw = teamMembersResult.data ?? [];
  const teamMembers = teamMembersRaw.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email ?? "",
    avatarUrl: m.avatarUrl,
    role: m.role ?? "",
  }));

  const taskIds = tasks.map((t) => t.id);
  const assigneesResult = await getAssigneesForTaskIds(taskIds);
  const assigneesByTaskId = assigneesResult.data ?? {};

  return (
    <div className="flex flex-col gap-4" dir="ltr" lang="en">
      <TasksPageContent
        initialTasks={tasks}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          coverImageUrl: p.coverImageUrl,
          clientLogoUrl: p.clientLogoUrl,
        }))}
        teamMembers={teamMembers}
        assigneesByTaskId={assigneesByTaskId}
      />
    </div>
  );
}
