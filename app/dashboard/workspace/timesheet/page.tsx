import { format, startOfWeek } from "date-fns";

import { getTimesheet } from "@/actions/time-tracking";
import { getTasks } from "@/actions/tasks";
import { getTeamMembers } from "@/actions/team-members";
import { getProjects } from "@/actions/projects";
import { WorkspaceTimesheetView } from "@/components/modules/workspace/workspace-timesheet-view";

type PageProps = {
  searchParams: Promise<{
    weekStart?: string;
    teamMemberId?: string;
  }>;
};

function mondayToday(): string {
  const m = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(m, "yyyy-MM-dd");
}

export default async function WorkspaceTimesheetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const weekStart = params.weekStart ?? mondayToday();
  const teamMemberId = params.teamMemberId?.trim() || undefined;

  const [timesheetRes, teamRes, tasksRes, projectsRes] = await Promise.all([
    getTimesheet({ weekStart, ...(teamMemberId ? { teamMemberId } : {}) }),
    getTeamMembers(),
    getTasks({}),
    getProjects({}),
  ]);

  const timesheet = timesheetRes.ok
    ? timesheetRes.data
    : { byDay: {}, dailyTotals: {}, weekTotal: 0, entries: [], weekStart };

  const teamMembers = teamRes.ok ? teamRes.data : [];

  const tasks = tasksRes.ok
    ? tasksRes.data.map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.projectName,
        projectCoverImageUrl: t.projectCoverImageUrl,
        projectClientLogoUrl: t.projectClientLogoUrl,
      }))
    : [];

  const projects = projectsRes.ok
    ? projectsRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        coverImageUrl: p.coverImageUrl,
        clientLogoUrl: p.clientLogoUrl,
      }))
    : [];

  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceTimesheetView
        weekStart={weekStart}
        selectedTeamMemberId={teamMemberId}
        teamMembers={teamMembers}
        tasks={tasks}
        byDay={timesheet.byDay}
        dailyTotals={timesheet.dailyTotals}
        weekTotal={timesheet.weekTotal}
        projects={projects}
      />
    </div>
  );
}

