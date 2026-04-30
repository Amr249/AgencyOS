"use client";

import { Download, Link as LinkIcon, Share2, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
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
  onDragStart?: (file: FileRow, e: React.DragEvent) => void;
  onDragEnd?: () => void;
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
  onDragStart,
  onDragEnd,
  formatSize,
  formatDate,
}: FileCardProps) {
  const isArabic = useLocale() === "ar";
  const kind = getFileVisualKind(file.name, file.mimeType);
  const thumb =
    kind === "image" && file.imagekitUrl ? (
      <img
        src={file.imagekitUrl}
        alt=""
        className="h-[150px] w-full object-cover"
      />
    ) : kind === "pdf" && file.imagekitUrl ? (
      <iframe
        src={`${file.imagekitUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
        className="h-[150px] w-full border-0 bg-white"
        title={file.name}
      />
    ) : (
      <div className="flex h-[150px] w-[200px] max-w-full items-center justify-center bg-muted">
        <FileTypeIcon name={file.name} mimeType={file.mimeType} />
      </div>
    );

  const handleCardClick = () => {
    onOpen(file);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      draggable={!!onDragStart}
      className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
      onDragStart={(e) => onDragStart?.(file, e)}
      onDragEnd={() => onDragEnd?.()}
    >
      <CardContent className="p-0">
        <div className="relative mx-auto w-full max-w-[200px] overflow-hidden rounded-t-md border-b bg-muted">
          {file.isPublic && file.shareToken ? (
            <div className="absolute inset-e-1 top-1 z-1 rounded-full bg-black/60 p-1 text-white" title={isArabic ? "مشارك" : "Shared"}>
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
                aria-label={isArabic ? "مشاركة" : "Share"}
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
              aria-label={isArabic ? "تنزيل" : "Download"}
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
              aria-label={isArabic ? "نسخ الرابط" : "Copy link"}
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
              aria-label={isArabic ? "حذف" : "Delete"}
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
