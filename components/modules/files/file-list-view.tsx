"use client";

import { Download, Link as LinkIcon, Share2, Trash2 } from "lucide-react";
import type { FileRow } from "@/lib/file-types";
import type { FolderRow } from "@/actions/folders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileTypeIcon, getFileVisualKind } from "@/components/modules/files/file-type-icon";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

type FileListViewProps = {
  childFolders: FolderRow[];
  files: FileRow[];
  fileCountByFolderId: Map<string, number>;
  onOpenFolder: (id: string) => void;
  onOpenFile: (file: FileRow) => void;
  onDownload: (url: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onDeleteFile: (file: FileRow) => void;
  onShareFile?: (file: FileRow) => void;
  formatSize: (n: number | null | undefined) => string;
  formatDate: (d: Date | string | null | undefined) => string;
  className?: string;
};

function typeLabel(name: string, mime: string | null | undefined): string {
  const k = getFileVisualKind(name, mime);
  const map: Record<string, string> = {
    image: "صورة",
    video: "فيديو",
    pdf: "PDF",
    design: "تصميم",
    office: "مستند",
    archive: "أرشيف",
    audio: "صوت",
    generic: "ملف",
  };
  return map[k] ?? "ملف";
}

export function FileListView({
  childFolders,
  files,
  fileCountByFolderId,
  onOpenFolder,
  onOpenFile,
  onDownload,
  onCopyLink,
  onDeleteFile,
  onShareFile,
  formatSize,
  formatDate,
  className,
}: FileListViewProps) {
  const hasRows = childFolders.length > 0 || files.length > 0;
  if (!hasRows) return null;

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>الاسم</TableHead>
            <TableHead className="hidden sm:table-cell">الحجم</TableHead>
            <TableHead className="hidden md:table-cell">التاريخ</TableHead>
            <TableHead className="hidden lg:table-cell">النوع</TableHead>
            <TableHead className="w-36 text-end">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {childFolders.map((f) => (
            <TableRow
              key={f.id}
              className="cursor-pointer"
              onClick={() => onOpenFolder(f.id)}
            >
              <TableCell>
                <div className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 flex size-9 items-center justify-center rounded-md">
                  <Folder className="size-4" />
                </div>
              </TableCell>
              <TableCell className="font-medium">{f.name}</TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">—</TableCell>
              <TableCell className="text-muted-foreground hidden md:table-cell">—</TableCell>
              <TableCell className="hidden lg:table-cell">
                مجلد · {fileCountByFolderId.get(f.id) ?? 0}
              </TableCell>
              <TableCell className="text-end">
                <Button type="button" size="sm" variant="ghost" onClick={() => onOpenFolder(f.id)}>
                  فتح
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {files.map((file) => (
            <TableRow
              key={file.id}
              className="cursor-pointer"
              onClick={() => {
                const k = getFileVisualKind(file.name, file.mimeType);
                if (k === "pdf") {
                  window.open(file.imagekitUrl, "_blank", "noopener,noreferrer");
                  return;
                }
                if (k === "design" || k === "office" || k === "archive" || k === "audio") {
                  onDownload(file.imagekitUrl, file.name);
                  return;
                }
                onOpenFile(file);
              }}
            >
              <TableCell>
                <FileTypeIcon name={file.name} mimeType={file.mimeType} compact />
              </TableCell>
              <TableCell className="max-w-[220px] font-medium" title={file.name}>
                <div className="flex min-w-0 items-center gap-2">
                  {file.isPublic && file.shareToken ? (
                    <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                      مشارك
                    </Badge>
                  ) : null}
                  <span className="truncate">{file.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">
                {formatSize(file.sizeBytes)}
              </TableCell>
              <TableCell className="text-muted-foreground hidden md:table-cell">
                {formatDate(file.createdAt)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {typeLabel(file.name, file.mimeType)}
              </TableCell>
              <TableCell className="text-end">
                <div className="flex justify-end gap-0.5">
                  {onShareFile ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="مشاركة"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareFile(file);
                      }}
                    >
                      <Share2 className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
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
                    variant="ghost"
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
                    variant="ghost"
                    className="text-destructive size-8"
                    aria-label="حذف"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
