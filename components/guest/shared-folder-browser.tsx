"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, FolderOpen, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileTypeIcon, getFileVisualKind } from "@/components/modules/files/file-type-icon";
import { shareFolderInlineFileUrl } from "@/lib/share-folder-preview";
import { cn } from "@/lib/utils";

export type SharedFolderFileItem = {
  id: string;
  name: string;
  publicFileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

type Props = {
  token: string;
  agencyName: string;
  logoUrl: string | null;
  shareExpiresAtIso: string | null;
  rootFolderName: string;
  breadcrumbs: { id: string; name: string }[];
  childFolders: { id: string; name: string }[];
  files: SharedFolderFileItem[];
};

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return null;
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yyyy = x.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isImage(name: string, mime: string | null | undefined): boolean {
  return getFileVisualKind(name, mime) === "image";
}

function isVideo(name: string, mime: string | null | undefined): boolean {
  return getFileVisualKind(name, mime) === "video";
}

function isPdf(name: string, mime: string | null | undefined): boolean {
  return getFileVisualKind(name, mime) === "pdf";
}

function isOffice(name: string, mime: string | null | undefined): boolean {
  return getFileVisualKind(name, mime) === "office";
}

function folderHref(token: string, folderId: string, rootId: string): string {
  const base = `/share/folder/${encodeURIComponent(token)}`;
  if (folderId === rootId) return base;
  return `${base}?folder=${encodeURIComponent(folderId)}`;
}

export function SharedFolderBrowser({
  token,
  agencyName,
  logoUrl,
  shareExpiresAtIso,
  rootFolderName,
  breadcrumbs,
  childFolders,
  files,
}: Props) {
  const [preview, setPreview] = React.useState<SharedFolderFileItem | null>(null);
  const rootId = breadcrumbs[0]?.id ?? "";
  const expiryLabel = formatExpiry(shareExpiresAtIso);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50" dir="rtl">
      <header className="border-b border-zinc-800 bg-zinc-900/90 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={40} height={40} className="size-9 shrink-0 rounded-md object-contain sm:size-10" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-sm font-bold sm:size-10">
              A
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold tracking-tight">{agencyName}</p>
            <p className="text-muted-foreground truncate text-xs">مشاركة مجلد · {rootFolderName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-8">
        {expiryLabel ? (
          <p className="text-amber-200/90 mb-4 text-sm">ينتهي الرابط في: {expiryLabel}</p>
        ) : null}

        <nav aria-label="مسار المجلد" className="mb-6 flex flex-wrap items-center gap-1 text-sm">
          {breadcrumbs.map((c, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={c.id}>
                {i > 0 ? (
                  <ChevronLeft className="text-muted-foreground size-4 shrink-0 opacity-60" aria-hidden />
                ) : null}
                {isLast ? (
                  <span className="max-w-[min(100%,12rem)] truncate font-medium sm:max-w-none" title={c.name}>
                    {c.name}
                  </span>
                ) : (
                  <Link
                    href={folderHref(token, c.id, rootId)}
                    className="text-sky-300 hover:text-sky-200 max-w-[min(100%,10rem)] truncate underline-offset-2 hover:underline sm:max-w-none"
                    title={c.name}
                  >
                    {c.name}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {childFolders.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">المجلدات</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {childFolders.map((f) => (
                <li key={f.id}>
                  <Link
                    href={folderHref(token, f.id, rootId)}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                  >
                    <FolderOpen className="text-sky-400 size-8 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">الملفات</h2>
          {files.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد ملفات في هذا المجلد.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((f) => {
                const img = isImage(f.name, f.mimeType);
                const kind = getFileVisualKind(f.name, f.mimeType);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setPreview(f)}
                      className={cn(
                        "flex w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 text-start transition-colors hover:border-zinc-600 hover:bg-zinc-900",
                        "focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                      )}
                    >
                      <div className="bg-zinc-950/80 flex aspect-4/3 w-full items-center justify-center overflow-hidden">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.publicFileUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <FileTypeIcon name={f.name} mimeType={f.mimeType} className="scale-125 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 p-3">
                        <p className="truncate text-sm font-medium" title={f.name}>
                          {f.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {kind} · {formatSize(f.sizeBytes)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent
          className="flex max-h-[95vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-50 sm:max-h-[90vh] sm:max-w-3xl"
          showCloseButton
        >
          {preview ? (
            <>
              <DialogHeader className="border-b border-zinc-800 px-4 py-3 sm:px-6">
                <DialogTitle className="truncate text-start text-base">{preview.name}</DialogTitle>
                <p className="text-muted-foreground text-start text-xs">
                  {formatSize(preview.sizeBytes)}
                  {preview.mimeType ? ` · ${preview.mimeType}` : ""}
                </p>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {isImage(preview.name, preview.mimeType) ? (
                  <div className="flex justify-center bg-black/40 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.publicFileUrl}
                      alt={preview.name}
                      className="max-h-[min(70vh,640px)] w-auto max-w-full object-contain"
                    />
                  </div>
                ) : isVideo(preview.name, preview.mimeType) ? (
                  <video
                    src={preview.publicFileUrl}
                    controls
                    className="mx-auto max-h-[min(70vh,640px)] w-full rounded-md bg-black"
                    playsInline
                  />
                ) : isPdf(preview.name, preview.mimeType) ? (
                  <iframe
                    title={preview.name}
                    src={shareFolderInlineFileUrl(token, preview.id)}
                    className="h-[min(70vh,640px)] w-full rounded-md border border-zinc-800 bg-zinc-900"
                  />
                ) : isOffice(preview.name, preview.mimeType) ? (
                  <iframe
                    title={preview.name}
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.publicFileUrl)}`}
                    className="h-[min(70vh,640px)] w-full rounded-md border border-zinc-800 bg-zinc-900"
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center gap-4 py-12 text-center text-sm">
                    <FileTypeIcon name={preview.name} mimeType={preview.mimeType} className="scale-150 text-zinc-500" />
                    <p>معاينة غير متاحة لهذا النوع.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-800 px-4 py-3 sm:px-6">
                <Button asChild size="sm" variant="secondary" className="gap-2">
                  <a href={preview.publicFileUrl} download={preview.name} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" />
                    تحميل
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
