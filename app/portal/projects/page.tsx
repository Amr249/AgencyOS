import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPortalProjects } from "@/actions/portal-dashboard";
import { getProjectMemberIdsByProjectIds } from "@/actions/team-members";
import { PortalProjectsListView } from "@/components/portal/portal-projects-list-view";

export default async function PortalProjectsPage() {
  const t = await getTranslations("clientPortal");
  const res = await getPortalProjects();
  if (!res.ok) {
    if (res.error === "unauthorized") {
      redirect(`/login?callbackUrl=${encodeURIComponent("/portal/projects")}`);
    }
    return (
      <div className="w-full min-w-0 py-12">
        <p className="text-destructive text-sm">{t("loadProjectsError")}</p>
      </div>
    );
  }

  const rows = res.data;
  const ids = rows.map((r) => r.id);
  const membersRes =
    ids.length > 0 ? await getProjectMemberIdsByProjectIds(ids) : { ok: true as const, data: {} };
  const projectMembersByProject = membersRes.ok ? membersRes.data : {};

  return (
    <div className="w-full min-w-0">
      <PortalProjectsListView projects={rows} projectMembersByProject={projectMembersByProject} />
    </div>
  );
}
