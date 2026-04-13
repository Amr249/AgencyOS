import { redirect } from "next/navigation";
import { getProjects } from "@/actions/projects";
import { getWorkspaceTimeline } from "@/actions/workspace";
import { WorkspaceTimelineView } from "@/components/modules/workspace/workspace-timeline-view";

export default async function WorkspaceTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectsRes = await getProjects({});
  const projects = projectsRes.ok ? projectsRes.data : [];
  const projectId = params.project ?? projects[0]?.id;
  if (!projectId && projects.length) redirect(`/dashboard/workspace/timeline?project=${projects[0].id}`);
  if (!projectId) return <p className="text-sm text-muted-foreground">No projects available.</p>;

  const timelineRes = await getWorkspaceTimeline(projectId);
  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceTimelineView
        tasks={timelineRes.ok ? timelineRes.data : []}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          coverImageUrl: p.coverImageUrl,
          clientLogoUrl: p.clientLogoUrl,
        }))}
      />
    </div>
  );
}
