import { redirect } from "next/navigation";
import { z } from "zod";
import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team-members";
import { getAssigneesForTaskIds } from "@/actions/assignments";
import { getWorkspaceBoard, getWorkspaceBoardForProjects } from "@/actions/workspace";
import { WorkspaceBoardView } from "@/components/modules/workspace/workspace-board-view";

export default async function WorkspaceBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectsRes = await getProjects({});
  const projects = projectsRes.ok ? projectsRes.data : [];

  if (!projects.length) {
    return <p className="text-sm text-muted-foreground">No projects available.</p>;
  }

  const firstId = projects[0]!.id;
  const raw = params.project?.trim();

  if (!raw) {
    redirect(`/dashboard/workspace/board?project=${firstId}`);
  }

  const allMode = raw === "all";
  if (!allMode && !z.string().uuid().safeParse(raw).success) {
    redirect(`/dashboard/workspace/board?project=${firstId}`);
  }

  const [boardRes, teamRes] = await Promise.all([
    allMode
      ? getWorkspaceBoardForProjects(projects.map((p) => p.id))
      : getWorkspaceBoard(raw),
    getTeamMembers(),
  ]);
  const columns = boardRes.ok ? boardRes.data.columns : [];
  const taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
  const assigneesResult = await getAssigneesForTaskIds(taskIds);
  const assigneesByTaskId = assigneesResult.data ?? {};

  const teamMembers = teamRes.ok ? teamRes.data : [];

  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceBoardView
        projectId={allMode ? "all" : raw}
        columns={columns}
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
