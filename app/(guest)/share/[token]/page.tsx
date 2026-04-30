import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";
import { getFileByShareToken } from "@/actions/files";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ token: string }> };

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiry(d: Date | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yyyy = x.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isImage(mime: string | null, name: string): boolean {
  if (mime?.startsWith("image/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
}

function isVideo(mime: string | null, name: string): boolean {
  if (mime?.startsWith("video/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "avi", "mkv"].includes(ext);
}

function isPdf(mime: string | null, name: string): boolean {
  if (mime === "application/pdf") return true;
  return name.toLowerCase().endsWith(".pdf");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const res = await getFileByShareToken(token);
  if (!res.ok) {
    return { title: "مشاركة ملف | AgencyOS" };
  }
  return { title: `${res.data.name} | AgencyOS` };
}

export default async function GuestSharePage({ params }: Props) {
  const { token } = await params;
  const res = await getFileByShareToken(token);

  const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const agencyName = settingsRow?.agencyName?.trim() || "AgencyOS";
  const logoUrl = settingsRow?.agencyLogoUrl?.trim() || null;

  if (!res.ok) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center" dir="rtl">
        <p className="text-muted-foreground text-lg">الرابط غير صالح أو منتهي الصلاحية</p>
        <Button asChild variant="outline">
          <Link href="/">الرئيسية</Link>
        </Button>
      </div>
    );
  }

  const f = res.data;
  const img = isImage(f.mimeType, f.name);
  const vid = isVideo(f.mimeType, f.name);
  const pdf = isPdf(f.mimeType, f.name);
  const expiryLabel = f.shareExpiresAt ? formatExpiry(f.shareExpiresAt) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50" dir="rtl">
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={40} height={40} className="rounded-md object-contain" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-800 text-sm font-bold">
              A
            </div>
          )}
          <span className="font-semibold tracking-tight">{agencyName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-bold break-words">{f.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatSize(f.sizeBytes)}
            {f.mimeType ? ` · ${f.mimeType}` : ""}
          </p>
          {expiryLabel ? (
            <p className="text-amber-200/90 mt-2 text-sm">ينتهي في: {expiryLabel}</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {img ? (
            <div className="flex max-h-[70vh] justify-center bg-black p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.publicFileUrl} alt={f.name} className="max-h-[70vh] w-auto max-w-full object-contain" />
            </div>
          ) : vid ? (
            <div className="bg-black p-2">
              <video src={f.publicFileUrl} controls className="mx-auto max-h-[70vh] w-full" playsInline />
            </div>
          ) : pdf ? (
            <iframe title={f.name} src={f.publicFileUrl} className="h-[min(75vh,720px)] w-full bg-zinc-950" />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
              <p>لا تتوفر معاينة لهذا النوع من الملفات.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="gap-2">
            <a href={f.publicFileUrl} download={f.name} target="_blank" rel="noopener noreferrer">
              تحميل
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
