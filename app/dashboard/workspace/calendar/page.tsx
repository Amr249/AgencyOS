import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team";
import { getWorkspaceCalendar } from "@/actions/workspace";
import { WorkspaceCalendarView } from "@/components/modules/workspace/workspace-calendar-view";

export default async function WorkspaceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const now = new Date();
  const month =
    params.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [calendarRes, projectsRes, membersRes] = await Promise.all([
    getWorkspaceCalendar(month),
    getProjects({}),
    getTeamMembers(),
  ]);

  const projects = projectsRes.ok ? projectsRes.data : [];
  const teamMembers = membersRes.ok ? membersRes.data : [];
  const tasks = calendarRes.ok ? calendarRes.data : [];

  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceCalendarView
        tasks={tasks}
        month={month}
        teamMembers={teamMembers}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
