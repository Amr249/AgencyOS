import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getDriveFolderDirectFileStats, getTotalFilesStorageBytes } from "@/actions/files";
import { getDriveFolders } from "@/actions/folders";
import { ensureSystemFolders } from "@/actions/system-folders";
import { getProjects } from "@/actions/projects";
import { getTeamMembers } from "@/actions/team-members";
import { FileManager } from "@/components/modules/files/file-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FOLDER_ID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  const driveLabel = t("drive");
  return {
    title: `${driveLabel} | AgencyOS`,
    description: "Agency-level personal file management",
  };
}

type Props = {
  searchParams: Promise<{ folder?: string }>;
};

function formatUsedMb(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.01) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(2)} MB`;
}

export default async function DrivePage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/drive");
  }
  if (sessionUserRole(session) === "member") {
    redirect("/dashboard/me");
  }

  const sp = await searchParams;
  const t = await getTranslations("nav");
  const currentFolderId =
    typeof sp.folder === "string" && FOLDER_ID_PARAM_RE.test(sp.folder) ? sp.folder : undefined;
  const isArabic = t("drive") !== "Drive";

  const userId = session.user.id;
  const role = sessionUserRole(session);
  const isMember = role === "member";
  const driveUploadPathPrefix = `drive/user/${userId}`;

  await ensureSystemFolders();

  const [foldersRes, statsRes, totalRes, projectsRes, teamRes] = await Promise.all([
    getDriveFolders(),
    getDriveFolderDirectFileStats(),
    getTotalFilesStorageBytes({ driveView: true }),
    getProjects(),
    getTeamMembers(),
  ]);

  const initialFolders = foldersRes.ok ? foldersRes.data : [];
  const usedBytes = totalRes.ok ? totalRes.total : 0;
  const availableProjects = projectsRes.ok
    ? projectsRes.data.map((p) => ({ id: p.id, name: p.name, iconUrl: p.coverImageUrl ?? null }))
    : [];
  const availableTeamMembers = teamRes.ok ? teamRes.data : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t("drive")}</h1>
        <p className="text-muted-foreground text-sm">
          {isArabic ? "ملفاتك الشخصية على مستوى الوكالة" : "Your personal files across the agency"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="bg-muted/40 h-48 animate-pulse rounded-lg border border-dashed" aria-hidden />
          }
        >
          <FileManager
            standalone
            folderRouteBase="/dashboard/drive"
            driveUploadPathPrefix={driveUploadPathPrefix}
            initialFiles={[]}
            initialFolders={initialFolders}
            currentFolderId={currentFolderId}
            initialDriveFolderDirectStats={statsRes.ok ? statsRes.data : []}
            availableProjects={availableProjects}
            availableTeamMembers={availableTeamMembers}
            allowStandaloneRoot={!isMember}
            sidebarFooter={
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{isArabic ? "التخزين" : "Storage"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs">{isArabic ? "المستخدم (تقديري)" : "User (estimated)"}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatUsedMb(usedBytes)}</p>
                </CardContent>
              </Card>
            }
          />
        </Suspense>
      </div>
    </div>
  );
}
