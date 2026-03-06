import type { Metadata } from "next";
import { getTasks } from "@/actions/tasks";
import { getProjects } from "@/actions/projects";
import { TasksPageContent } from "@/components/modules/tasks/tasks-page-content";

export const metadata: Metadata = {
  title: "المهام",
  description: "إدارة المهام بعرض كانبان والقائمة",
};

export default async function TasksPage() {
  const [tasksResult, projectsResult] = await Promise.all([
    getTasks({}),
    getProjects({}),
  ]);

  const tasks = tasksResult.ok ? tasksResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <TasksPageContent
        initialTasks={tasks}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
