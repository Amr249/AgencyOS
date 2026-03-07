import type { Metadata } from "next";
import { Suspense } from "react";
import { getProjects, getProjectTaskCounts } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { getProjectMemberIdsByProjectIds, getTeamMembers } from "@/actions/team-members";
import { ProjectsListView } from "@/components/modules/projects/projects-list-view";

export const metadata: Metadata = {
  title: "المشاريع",
  description: "Manage projects and track progress",
};

type PageProps = {
  searchParams: Promise<{ search?: string; status?: string; clientId?: string }>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { search, status, clientId } = await searchParams;
  const filters = {
    search: search ?? undefined,
    status: status ?? undefined,
    clientId: clientId && clientId !== "all" ? clientId : undefined,
  };

  const [projectsResult, clientsResult, settingsResult] = await Promise.all([
    getProjects(filters),
    getClientsList(),
    getSettings(),
  ]);

  if (!projectsResult.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">المشاريع</h1>
        <p className="text-destructive">{projectsResult.error}</p>
      </div>
    );
  }

  const projects = projectsResult.data;
  const clients = clientsResult.ok ? clientsResult.data : [];
  const defaultCurrency = settingsResult.ok && settingsResult.data?.defaultCurrency
    ? settingsResult.data.defaultCurrency
    : "USD";

  const [taskCountsResult, projectMembersResult, teamMembersResult] = await Promise.all([
    getProjectTaskCounts(projects.map((p) => p.id)),
    getProjectMemberIdsByProjectIds(projects.map((p) => p.id)),
    getTeamMembers(),
  ]);
  const taskCounts = taskCountsResult.ok ? taskCountsResult.data : {};
  const projectMembers = projectMembersResult.ok ? projectMembersResult.data : {};
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];

  return (
    <Suspense fallback={<div className="text-muted-foreground">جارٍ التحميل…</div>}>
      <ProjectsListView
        projects={projects}
        taskCounts={taskCounts}
        projectMembers={projectMembers}
        clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))}
        teamMembers={teamMembers}
        defaultCurrency={defaultCurrency}
      />
    </Suspense>
  );
}
