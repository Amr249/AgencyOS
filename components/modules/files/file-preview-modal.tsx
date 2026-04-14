"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Trash2, File } from "lucide-react";
import type { FileRow } from "@/lib/file-types";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

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

function isImage(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

function isPdf(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime === "application/pdf" || mime.toLowerCase().endsWith("pdf");
}

type FilePreviewModalProps = {
  file: FileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteRequest: (file: FileRow) => void;
  onDownload: (url: string, name: string) => void;
  onCopyLink: (url: string) => void;
};

export function FilePreviewModal({
  file,
  open,
  onOpenChange,
  onDeleteRequest,
  onDownload,
  onCopyLink,
}: FilePreviewModalProps) {
  const [pdfLoadFailed, setPdfLoadFailed] = React.useState(false);
  const isImg = file ? isImage(file.mimeType) : false;
  const isPdfType = file ? isPdf(file.mimeType) : false;
  const hasPreview = isImg || isPdfType;
  const contentMaxWidth = hasPreview ? "sm:max-w-3xl" : "sm:max-w-md";

  React.useEffect(() => {
    if (!open) setPdfLoadFailed(false);
  }, [open]);

  if (!file) return null;

  const imageUrl = isImg ? `${file.imagekitUrl}?tr=w-800` : null;

  const handleDownload = () => {
    onDownload(file.imagekitUrl, file.name);
  };

  const handleCopy = () => {
    onCopyLink(file.imagekitUrl);
    toast.success("Link copied.");
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDeleteRequest(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="ltr"
        className={`w-[95vw] max-w-[95vw] ${contentMaxWidth} flex max-h-[90vh] flex-col overflow-hidden p-0`}
        showCloseButton={false}
      >
        {/* Header: Close left, name + meta right */}
        <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="sr-only">{file.name}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4 h-8 w-8 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </Button>
          <div className="min-w-0 flex-1 text-left">
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

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {isImg && imageUrl && (
            <div className="flex justify-center bg-muted/30 p-4">
              <img
                src={imageUrl}
                alt={file.name}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          )}

          {isPdfType && !pdfLoadFailed && (
            <div className="p-4">
              <iframe
                src={file.imagekitUrl}
                title={file.name}
                className="h-[70vh] w-full rounded border bg-muted"
                onError={() => setPdfLoadFailed(true)}
              />
            </div>
          )}

          {isPdfType && pdfLoadFailed && (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-muted-foreground">Unable to preview this file directly</p>
              <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          )}

          {!hasPreview && (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <File className="text-muted-foreground h-16 w-16" />
              <p className="font-medium">{file.name}</p>
              <p className="text-muted-foreground text-sm">
                {formatSize(file.sizeBytes)}
              </p>
              <p className="text-muted-foreground text-sm">
                Preview is not available for this file type
              </p>
            </div>
          )}
        </div>

        {/* Footer: actions right-aligned */}
        <DialogFooter className="flex flex-row gap-2 border-t px-6 py-4 sm:justify-start">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
            <Copy className="h-3.5 w-3.5" />
            Copy Link
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
