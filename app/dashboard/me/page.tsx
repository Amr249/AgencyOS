import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getWorkspaceMyTasks, type WorkspaceMyTaskGroups } from "@/actions/workspace";
import { getMemberDashboardData } from "@/actions/member-dashboard";
import { MemberHubContent } from "@/components/member-dashboard/member-hub-content";

const EMPTY_GROUPS: WorkspaceMyTaskGroups = {
  overdue: [],
  today: [],
  tomorrow: [],
  this_week: [],
  later: [],
  no_date: [],
};

export default async function MemberDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/me");

  if (sessionUserRole(session) !== "member") {
    redirect("/dashboard");
  }

  const [tasksRes, dashRes] = await Promise.all([
    getWorkspaceMyTasks(),
    getMemberDashboardData(),
  ]);

  if (!dashRes.ok) {
    const t = await getTranslations("memberDashboard");
    const msg =
      dashRes.error === "forbidden"
        ? t("forbidden")
        : dashRes.error === "unauthorized"
          ? t("forbidden")
          : t("loadError");
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{msg}</p>
      </div>
    );
  }

  return (
    <MemberHubContent
      displayName={session.user.name ?? ""}
      groups={tasksRes.ok ? tasksRes.data : EMPTY_GROUPS}
      projects={dashRes.data.projects}
      salaryExpenses={dashRes.data.salaryExpenses}
    />
  );
}
