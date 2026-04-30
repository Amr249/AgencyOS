"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import type { FileRow } from "@/lib/file-types";
import { FilePreviewModal } from "@/components/modules/files/file-preview-modal";
import { getFileVisualKind } from "@/components/modules/files/file-type-icon";
import { cn } from "@/lib/utils";

type DriveQuickUploadsProps = {
  files: FileRow[];
};

export function DriveQuickUploads({ files }: DriveQuickUploadsProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const dateLocale = locale === "ar" ? arSA : enUS;
  const [preview, setPreview] = React.useState<FileRow | null>(null);

  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{isArabic ? "رفع سريع" : "Quick uploads"}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {files.map((f) => {
          const kind = getFileVisualKind(f.name, f.mimeType);
          const thumb =
            kind === "image" && f.imagekitUrl ? (
              <img
                src={f.imagekitUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center bg-muted text-xs font-medium">
                {f.name.split(".").pop()?.slice(0, 4) ?? "—"}
              </div>
            );
          const rel = formatDistanceToNow(new Date(f.createdAt), {
            addSuffix: true,
            locale: dateLocale,
          });
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setPreview(f)}
              className={cn(
                "border-border bg-card w-[120px] shrink-0 overflow-hidden rounded-lg border text-start shadow-sm transition hover:shadow-md"
              )}
            >
              <div className="bg-muted aspect-[4/3] w-full overflow-hidden">{thumb}</div>
              <div className="p-2">
                <p className="line-clamp-2 text-xs font-medium leading-tight" title={f.name}>
                  {f.name}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">{rel}</p>
              </div>
            </button>
          );
        })}
      </div>

      <FilePreviewModal
        file={preview}
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        onDeleteRequest={() => {
          setPreview(null);
        }}
        onDownload={(url, name) => {
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        }}
        onCopyLink={async (url) => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
}
