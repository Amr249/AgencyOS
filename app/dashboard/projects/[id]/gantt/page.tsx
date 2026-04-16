import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getProjectById } from "@/actions/projects";
import { getTasksByProjectId } from "@/actions/tasks";
import { getDependenciesForTasks } from "@/actions/task-dependencies";
import { getTeamMembers } from "@/actions/team-members";
import { Button } from "@/components/ui/button";
import { GanttChart } from "@/components/modules/projects/gantt-chart";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectGanttPage({ params }: Props) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) === "member") {
    redirect("/dashboard/workspace");
  }

  const [projectResult, tasksResult, teamMembersResult] = await Promise.all([
    getProjectById(id),
    getTasksByProjectId(id),
    getTeamMembers(),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error === "Project not found" || projectResult.error === "Invalid project id") {
      notFound();
    }
    return <p className="text-destructive">{projectResult.error}</p>;
  }

  if (!tasksResult.ok) {
    return <p className="text-destructive">{tasksResult.error}</p>;
  }

  const taskIds = tasksResult.data.map((t) => t.id);
  const depsResult = await getDependenciesForTasks(taskIds);
  const dependencies = depsResult.ok ? depsResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];

  return (
    <div className="flex flex-col gap-4" dir="ltr" lang="en">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/dashboard/projects/${id}`}>{projectResult.data.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Gantt</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gantt Timeline</h1>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/projects/${id}`}>Back to project</Link>
        </Button>
      </div>

      <GanttChart
        projectId={id}
        tasks={tasksResult.data.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          startDate: t.startDate ?? null,
          dueDate: t.dueDate ?? null,
          createdAt: t.createdAt,
        }))}
        dependencies={dependencies.map((d) => ({
          id: d.id,
          taskId: d.taskId,
          dependsOnTaskId: d.dependsOnTaskId,
          type: d.type,
        }))}
        teamMembers={teamMembers.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email ?? "",
          avatarUrl: m.avatarUrl,
          role: m.role ?? undefined,
          status: m.status,
        }))}
      />
    </div>
  );
}
