import { redirect } from "next/navigation";
import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team-members";
import { getWorkspaceBoard } from "@/actions/workspace";
import { WorkspaceBoardView } from "@/components/modules/workspace/workspace-board-view";

export default async function WorkspaceBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectsRes = await getProjects({});
  const projects = projectsRes.ok ? projectsRes.data : [];

  const projectId = params.project ?? projects[0]?.id;
  if (!projectId && projects.length) redirect(`/dashboard/workspace/board?project=${projects[0].id}`);
  if (!projectId) {
    return <p className="text-sm text-muted-foreground">No projects available.</p>;
  }

  const [boardRes, teamRes] = await Promise.all([getWorkspaceBoard(projectId), getTeamMembers()]);
  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceBoardView
        projectId={projectId}
        columns={boardRes.ok ? boardRes.data.columns : []}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        teamMembers={teamRes.ok ? teamRes.data : []}
      />
    </div>
  );
}
