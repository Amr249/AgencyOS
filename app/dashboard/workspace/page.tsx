import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team-members";
import { getWorkspaceMyTasks } from "@/actions/workspace";
import { WorkspaceMyTasksView } from "@/components/modules/workspace/workspace-my-tasks-view";

export default async function WorkspacePage() {
  const [tasksRes, membersRes, projectsRes] = await Promise.all([
    getWorkspaceMyTasks(),
    getTeamMembers(),
    getProjects({}),
  ]);

  return (
    <WorkspaceMyTasksView
      groups={tasksRes.ok ? tasksRes.data : { today: [], this_week: [], later: [], no_date: [] }}
      teamMembers={membersRes.ok ? membersRes.data : []}
      projects={(projectsRes.ok ? projectsRes.data : []).map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
