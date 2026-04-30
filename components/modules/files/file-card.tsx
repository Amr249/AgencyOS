"use client";

import { Download, Link as LinkIcon, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileTypeIcon, getFileVisualKind } from "@/components/modules/files/file-type-icon";
import type { FileRow } from "@/lib/file-types";
import { cn } from "@/lib/utils";

type FileCardProps = {
  file: FileRow;
  onOpen: (file: FileRow) => void;
  onDownload: (url: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onDelete: (file: FileRow) => void;
  onShare?: (file: FileRow) => void;
  formatSize: (n: number | null | undefined) => string;
  formatDate: (d: Date | string | null | undefined) => string;
};

export function FileCard({
  file,
  onOpen,
  onDownload,
  onCopyLink,
  onDelete,
  onShare,
  formatSize,
  formatDate,
}: FileCardProps) {
  const kind = getFileVisualKind(file.name, file.mimeType);
  const thumb =
    kind === "image" && file.imagekitUrl ? (
      <img
        src={file.imagekitUrl}
        alt=""
        className="h-[150px] w-full object-cover"
      />
    ) : (
      <div className="flex h-[150px] w-[200px] max-w-full items-center justify-center bg-muted">
        <FileTypeIcon name={file.name} mimeType={file.mimeType} />
      </div>
    );

  const handleCardClick = () => {
    if (kind === "pdf") {
      window.open(file.imagekitUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (kind === "design" || kind === "office" || kind === "archive" || kind === "audio") {
      onDownload(file.imagekitUrl, file.name);
      return;
    }
    onOpen(file);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
    >
      <CardContent className="p-0">
        <div className="relative mx-auto w-full max-w-[200px] overflow-hidden rounded-t-md border-b bg-muted">
          {file.isPublic && file.shareToken ? (
            <div className="absolute end-1 top-1 z-[1] rounded-full bg-black/60 p-1 text-white" title="مشارك">
              <LinkIcon className="size-3.5" />
            </div>
          ) : null}
          {thumb}
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
            {onShare ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-8"
                aria-label="مشاركة"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(file);
                }}
              >
                <Share2 className="size-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-8"
              aria-label="تنزيل"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(file.imagekitUrl, file.name);
              }}
            >
              <Download className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-8"
              aria-label="نسخ الرابط"
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink(file.imagekitUrl);
              }}
            >
              <LinkIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-8"
              aria-label="حذف"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="p-3 text-start">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatSize(file.sizeBytes)} · {formatDate(file.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
