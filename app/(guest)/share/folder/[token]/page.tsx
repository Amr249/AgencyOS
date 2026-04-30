import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";
import { getSharedFolderBrowse } from "@/lib/shared-folder-access";
import { SharedFolderBrowser } from "@/components/guest/shared-folder-browser";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ folder?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { token } = await params;
  const sp = await searchParams;
  const res = await getSharedFolderBrowse(token, sp.folder ?? null);
  if (!res.ok) return { title: "مشاركة مجلد | AgencyOS" };
  return {
    title: `${res.data.current.name} · ${res.data.root.name} | AgencyOS`,
  };
}

export default async function SharedFolderPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  const browse = await getSharedFolderBrowse(token, sp.folder ?? null);

  if (!browse.ok) {
    console.warn("[share/folder] browse failed", {
      reason: browse.reason,
      tokenLength: token.length,
      folderParam: sp.folder ?? null,
    });
  }

  const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const logoUrl = settingsRow?.agencyLogoUrl?.trim() || null;

  if (!browse.ok) {
    if (browse.reason === "not_found") notFound();
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center" dir="rtl">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={48} height={48} className="rounded-md object-contain" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-md bg-zinc-200 text-lg font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              A
            </div>
          )}
          <span className="font-semibold">AgencyOS Drive</span>
        </div>
        <p className="text-muted-foreground max-w-md text-lg">
          {browse.reason === "expired"
            ? "انتهت صلاحية رابط المشاركة."
            : "الرابط غير صالح أو المجلد لم يعد متاحاً للعامة."}
        </p>
        <Button asChild variant="outline">
          <Link href="/">الرئيسية</Link>
        </Button>
      </div>
    );
  }

  const d = browse.data;
  const shareExpiresAtIso = d.root.shareExpiresAt
    ? new Date(d.root.shareExpiresAt).toISOString()
    : null;

  return (
    <SharedFolderBrowser
      token={token}
      logoUrl={logoUrl}
      shareExpiresAtIso={shareExpiresAtIso}
      rootFolderName={d.root.name}
      breadcrumbs={d.breadcrumbs}
      childFolders={d.childFolders}
      files={d.files.map((f) => ({
        id: f.id,
        name: f.name,
        publicFileUrl: f.publicFileUrl,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
      }))}
    />
  );
}
