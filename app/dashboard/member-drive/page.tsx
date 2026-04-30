import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getFiles, getTotalFilesStorageBytes } from "@/actions/files";
import { getDriveFolders } from "@/actions/folders";
import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team-members";
import { FileManager } from "@/components/modules/files/file-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatUsedMb(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.01) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(2)} MB`;
}

export default async function MemberDrivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/member-drive");
  if (sessionUserRole(session) !== "member") redirect("/dashboard/drive");

  const [filesRes, foldersRes, totalRes, projectsRes, teamRes] = await Promise.all([
    getFiles({ driveView: true }),
    getDriveFolders(),
    getTotalFilesStorageBytes({ driveView: true }),
    getProjects(),
    getTeamMembers(),
  ]);

  const availableProjects = projectsRes.ok
    ? projectsRes.data.map((p) => ({ id: p.id, name: p.name, iconUrl: p.coverImageUrl ?? null }))
    : [];

  const t = await getTranslations("memberDrive");

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col gap-3">
      <div className="text-start">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <div className="min-h-0 flex-1">
        <FileManager
          standalone
          folderRouteBase="/dashboard/member-drive"
          initialFiles={filesRes.ok ? filesRes.data : []}
          initialFolders={foldersRes.ok ? foldersRes.data : []}
          availableProjects={availableProjects}
          availableTeamMembers={teamRes.ok ? teamRes.data : []}
          allowStandaloneRoot={false}
          sidebarFooter={
            <Card className="w-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("storageTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">{t("storageHint")}</p>
                <p className="text-lg font-semibold tabular-nums">{formatUsedMb(totalRes.ok ? totalRes.total : 0)}</p>
              </CardContent>
            </Card>
          }
        />
      </div>
    </div>
  );
}
