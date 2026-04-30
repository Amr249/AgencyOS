"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Trash2, File, ZoomIn, ZoomOut, ExternalLink, Share2 } from "lucide-react";
import type { FileRow } from "@/lib/file-types";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { getFileVisualKind } from "@/components/modules/files/file-type-icon";
import { driveInlinePreviewUrl } from "@/lib/drive-inline-preview";

function formatDateSafe(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return format(date, "dd/MM/yyyy", { locale: enUS });
  } catch {
    return "—";
  }
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FilePreviewModalProps = {
  file: FileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteRequest: (file: FileRow) => void;
  onDownload: (url: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onShare?: (file: FileRow) => void;
};

export function FilePreviewModal({
  file,
  open,
  onOpenChange,
  onDeleteRequest,
  onDownload,
  onCopyLink,
  onShare,
}: FilePreviewModalProps) {
  const [imgScale, setImgScale] = React.useState(1);
  const imgWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      setImgScale(1);
    }
  }, [open]);

  React.useEffect(() => {
    setImgScale(1);
  }, [file?.id]);

  if (!file) return null;

  const kind = getFileVisualKind(file.name, file.mimeType);
  const isImg = kind === "image";
  const isPdfType = kind === "pdf";
  const isVideo = kind === "video";
  const isOffice = kind === "office";
  const hasRichPreview = isImg || isPdfType || isVideo || isOffice;
  const contentMaxWidth = hasRichPreview ? "sm:max-w-3xl" : "sm:max-w-md";

  const imageUrl = isImg ? file.publicFileUrl : null;
  const pdfPreviewSrc =
    isPdfType && file.publicFileUrl?.trim() ? driveInlinePreviewUrl(file.publicFileUrl) : null;

  const handleDownload = () => {
    onDownload(file.publicFileUrl, file.name);
  };

  const handleCopy = () => {
    onCopyLink(file.publicFileUrl);
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDeleteRequest(file);
  };

  const handleShare = () => {
    onShare?.(file);
  };

  const onWheelImage: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!isImg) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setImgScale((s) => Math.min(4, Math.max(0.25, Math.round((s + delta) * 100) / 100)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex max-h-[90vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden p-0 ${contentMaxWidth} sm:max-h-[90vh]`}
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="sr-only">{file.name}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute inset-s-4 top-4 h-8 w-8 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
          >
            <span className="text-lg leading-none">×</span>
          </Button>
          <div className="min-w-0 flex-1 ps-10 text-start">
            <p className="truncate text-base font-bold" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatSize(file.sizeBytes)} · {formatDateSafe(file.createdAt)}
            </p>
            {file.description ? (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{file.description}</p>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isImg && imageUrl && (
            <div className="flex flex-col gap-2 bg-muted/30 p-2 sm:p-4">
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setImgScale((s) => s + 0.25)}>
                  <ZoomIn className="me-1 size-3.5" />
                  تكبير
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setImgScale((s) => Math.max(0.25, s - 0.25))}>
                  <ZoomOut className="me-1 size-3.5" />
                  تصغير
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setImgScale(1)}>
                  إعادة ضبط
                </Button>
              </div>
              <div
                ref={imgWrapRef}
                className="max-h-[65vh] overflow-auto overscroll-contain"
                onWheel={onWheelImage}
              >
                <div className="flex min-h-[200px] justify-center p-2">
                  <img
                    src={imageUrl}
                    alt={file.name}
                    className="max-w-full object-contain transition-transform duration-150"
                    style={{ transform: `scale(${imgScale})`, transformOrigin: "center center" }}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-center text-xs">استخدم عجلة الماوس للتكبير داخل منطقة الصورة</p>
            </div>
          )}

          {isVideo && (
            <div className="bg-muted/30 p-4">
              <video
                src={file.publicFileUrl}
                controls
                className="mx-auto max-h-[70vh] w-full max-w-full rounded border bg-black"
                playsInline
              />
            </div>
          )}

          {isPdfType && pdfPreviewSrc && (
            <div className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" asChild className="gap-1">
                  <a href={pdfPreviewSrc} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    فتح في تبويب جديد
                  </a>
                </Button>
              </div>
              {/*
                Single same-origin iframe when the modal is open (grid cards do not embed PDFs).
                Proxy sets Content-Disposition: inline and a correct PDF content-type.
              */}
              <iframe
                key={file.id}
                src={pdfPreviewSrc}
                title={file.name}
                className="h-[min(70vh,600px)] w-full rounded border bg-muted"
              />
              <p className="text-muted-foreground text-center text-xs">
                إن لم تظهر المعاينة، استخدم «فتح في تبويب جديد» أو «تنزيل».
              </p>
            </div>
          )}

          {isOffice && (
            <div className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" asChild className="gap-1">
                  <a href={file.publicFileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    فتح في تبويب جديد
                  </a>
                </Button>
              </div>
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.publicFileUrl)}`}
                title={file.name}
                className="h-[min(70vh,600px)] w-full rounded border bg-muted"
              />
            </div>
          )}

          {!hasRichPreview && (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <File className="text-muted-foreground h-16 w-16" />
              <p className="font-medium">{file.name}</p>
              <p className="text-muted-foreground text-sm">{formatSize(file.sizeBytes)}</p>
              <p className="text-muted-foreground text-sm">{formatDateSafe(file.createdAt)}</p>
              {file.uploadedByName ? (
                <p className="text-muted-foreground text-sm">رفع بواسطة: {file.uploadedByName}</p>
              ) : null}
              <p className="text-muted-foreground text-sm">لا يتوفر معاينة لهذا النوع — يمكنك التنزيل.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row flex-wrap gap-2 border-t px-4 py-3 sm:px-6 sm:py-4 sm:justify-start">
          {onShare ? (
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1">
              <Share2 className="h-3.5 w-3.5" />
              مشاركة
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            تنزيل
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
            <Copy className="h-3.5 w-3.5" />
            نسخ الرابط
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
