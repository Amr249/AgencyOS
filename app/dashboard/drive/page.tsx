import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getFiles, getRecentUploadsForDashboard, getTotalFilesStorageBytes } from "@/actions/files";
import { getAllStandaloneFolders } from "@/actions/folders";
import { FileManager } from "@/components/modules/files/file-manager";
import { DriveQuickUploads } from "@/components/modules/drive/drive-quick-uploads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FOLDER_ID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "الملفات | AgencyOS",
    description: "إدارة الملفات والمجلدات الشخصية",
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

  const userId = session.user.id;
  const driveUploadPathPrefix = `drive/user/${userId}`;

  const [filesRes, foldersRes, recentRes, totalRes] = await Promise.all([
    getFiles({ standaloneDrive: true }),
    getAllStandaloneFolders(),
    getRecentUploadsForDashboard(10),
    getTotalFilesStorageBytes(),
  ]);

  const initialFiles = filesRes.ok ? filesRes.data : [];
  const initialFolders = foldersRes.ok ? foldersRes.data : [];
  const recentFiles = recentRes.ok ? recentRes.data : [];
  const usedBytes = totalRes.ok ? totalRes.total : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("drive")}</h1>
        <p className="text-muted-foreground text-sm">ملفاتك الشخصية على مستوى الوكالة</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <DriveQuickUploads files={recentFiles} />
        <Card className="md:w-52 shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">التخزين</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">المستخدم (تقديري)</p>
            <p className="text-lg font-semibold tabular-nums">{formatUsedMb(usedBytes)}</p>
          </CardContent>
        </Card>
      </div>

      <Suspense
        fallback={
          <div className="bg-muted/40 h-48 animate-pulse rounded-lg border border-dashed" aria-hidden />
        }
      >
        <FileManager
          standalone
          folderRouteBase="/dashboard/drive"
          driveUploadPathPrefix={driveUploadPathPrefix}
          initialFiles={initialFiles}
          initialFolders={initialFolders}
          currentFolderId={currentFolderId}
        />
      </Suspense>
    </div>
  );
}
