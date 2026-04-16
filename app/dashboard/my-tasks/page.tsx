import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/assignments";
import { getWorkspaceMyTasks, type WorkspaceMyTaskGroups } from "@/actions/workspace";
import { WorkspaceMyTasksView } from "@/components/modules/workspace/workspace-my-tasks-view";

const EMPTY_GROUPS: WorkspaceMyTaskGroups = {
  overdue: [],
  today: [],
  tomorrow: [],
  this_week: [],
  later: [],
  no_date: [],
};

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (sessionUserRole(session) === "member") {
    redirect("/dashboard/me");
  }

  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  const [tasksRes, membersRes, projectsRes] = await Promise.all([
    getWorkspaceMyTasks(),
    getTeamMembers(),
    getProjects({}),
  ]);

  return (
    <div className="p-4 md:p-6" dir={dir} lang={locale}>
      <WorkspaceMyTasksView
        groups={tasksRes.ok ? tasksRes.data : EMPTY_GROUPS}
        teamMembers={membersRes.data ?? []}
        projects={(projectsRes.ok ? projectsRes.data : []).map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
