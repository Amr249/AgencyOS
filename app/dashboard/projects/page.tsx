import type { Metadata } from "next";
import { Suspense } from "react";
import { getProjects, getProjectTaskCounts } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { getProjectMemberIdsByProjectIds, getTeamMembers } from "@/actions/team-members";
import { getServices } from "@/actions/services";
import { getServiceIdsByProjectIds } from "@/actions/project-services";
import { getProjectsHealthMap } from "@/actions/project-health";
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

  const [projectsResult, clientsResult, settingsResult, servicesResult] = await Promise.all([
    getProjects(filters),
    getClientsList(),
    getSettings(),
    getServices(),
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

  const [taskCountsResult, projectMembersResult, teamMembersResult, projectServicesResult, healthMapResult] =
    await Promise.all([
      getProjectTaskCounts(projects.map((p) => p.id)),
      getProjectMemberIdsByProjectIds(projects.map((p) => p.id)),
      getTeamMembers(),
      getServiceIdsByProjectIds(projects.map((p) => p.id)),
      getProjectsHealthMap(projects.map((p) => p.id)),
    ]);
  const taskCounts = taskCountsResult.ok ? taskCountsResult.data : {};
  const projectMembers = projectMembersResult.ok ? projectMembersResult.data : {};
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];
  const serviceOptions = servicesResult.ok ? servicesResult.data : [];
  const projectServices = projectServicesResult.ok ? projectServicesResult.data : {};
  const healthByProjectId = healthMapResult.ok ? healthMapResult.data : {};

  return (
    <Suspense fallback={<div className="text-muted-foreground">جارٍ التحميل…</div>}>
      <ProjectsListView
        projects={projects}
        taskCounts={taskCounts}
        healthByProjectId={healthByProjectId}
        projectMembers={projectMembers}
        projectServices={projectServices}
        clients={clients.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          logoUrl: c.logoUrl,
        }))}
        serviceOptions={serviceOptions}
        teamMembers={teamMembers}
        defaultCurrency={defaultCurrency}
      />
    </Suspense>
  );
}
