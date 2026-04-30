"use client";

import { Download, Folder, Link as LinkIcon, Pencil, Share2, Trash2, Users } from "lucide-react";
import { useLocale } from "next-intl";
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
import { cn } from "@/lib/utils";
import { DRIVE_FILE_DRAG_MIME, DRIVE_FOLDER_DRAG_MIME, dataTransferHasDriveFile, dataTransferHasDriveFolder } from "@/lib/drive-dnd";

type FileListViewProps = {
  childFolders: FolderRow[];
  files: FileRow[];
  fileCountByFolderId: Map<string, number>;
  folderSizeBytesByFolderId: Map<string, number>;
  folderDisplayDateMsByFolderId: Map<string, number>;
  onOpenFolder: (id: string) => void;
  onRenameFolder: (folder: FolderRow) => void;
  onDeleteFolder: (folder: FolderRow) => void;
  onShareFolder: (folder: FolderRow) => void;
  onAccessFolder: (folder: FolderRow) => void;
  onOpenFile: (file: FileRow) => void;
  onDownload: (url: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onDeleteFile: (file: FileRow) => void;
  onShareFile?: (file: FileRow) => void;
  onDragFileStart?: (file: FileRow, e: React.DragEvent) => void;
  onDragFileEnd?: () => void;
  onDragFolderStart?: (folder: FolderRow, e: React.DragEvent) => void;
  onDragFolderEnd?: () => void;
  dropTargetFolderId?: string | null;
  onDropTargetChange?: (folderId: string | null) => void;
  onFileDropToFolder?: (targetFolderId: string, fileId: string) => void;
  onFolderDropToFolder?: (targetFolderId: string, draggedFolderId: string) => void;
  formatSize: (n: number | null | undefined) => string;
  formatDate: (d: Date | string | null | undefined) => string;
  className?: string;
};

function typeLabel(name: string, mime: string | null | undefined, isArabic: boolean): string {
  const k = getFileVisualKind(name, mime);
  const map: Record<string, string> = isArabic ? {
    image: "صورة",
    video: "فيديو",
    pdf: "PDF",
    design: "تصميم",
    office: "مستند",
    archive: "أرشيف",
    audio: "صوت",
    generic: "ملف",
  } : {
    image: "Image",
    video: "Video",
    pdf: "PDF",
    design: "Design",
    office: "Document",
    archive: "Archive",
    audio: "Audio",
    generic: "File",
  };
  return map[k] ?? (isArabic ? "ملف" : "File");
}

export function FileListView({
  childFolders,
  files,
  fileCountByFolderId,
  folderSizeBytesByFolderId,
  folderDisplayDateMsByFolderId,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onShareFolder,
  onAccessFolder,
  onOpenFile,
  onDownload,
  onCopyLink,
  onDeleteFile,
  onShareFile,
  onDragFileStart,
  onDragFileEnd,
  onDragFolderStart,
  onDragFolderEnd,
  dropTargetFolderId,
  onDropTargetChange,
  onFileDropToFolder,
  onFolderDropToFolder,
  formatSize,
  formatDate,
  className,
}: FileListViewProps) {
  const isArabic = useLocale() === "ar";
  const hasRows = childFolders.length > 0 || files.length > 0;
  if (!hasRows) return null;

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>{isArabic ? "الاسم" : "Name"}</TableHead>
            <TableHead className="hidden sm:table-cell">{isArabic ? "الحجم" : "Size"}</TableHead>
            <TableHead className="hidden md:table-cell">{isArabic ? "التاريخ" : "Date"}</TableHead>
            <TableHead className="hidden lg:table-cell">{isArabic ? "النوع" : "Type"}</TableHead>
            <TableHead className="w-44 min-w-44 text-end">
              {isArabic ? "إجراءات" : "Actions"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {childFolders.map((f) => {
            const totalBytes = folderSizeBytesByFolderId.get(f.id) ?? 0;
            const displayMs =
              folderDisplayDateMsByFolderId.get(f.id) ?? new Date(f.createdAt).getTime();
            return (
              <TableRow
                key={f.id}
                className={cn(
                  "cursor-pointer",
                  dropTargetFolderId === f.id && "bg-primary/5 ring-1 ring-primary/30"
                )}
                draggable={!!onDragFolderStart}
                onDragStart={(e) => onDragFolderStart?.(f, e)}
                onDragEnd={() => onDragFolderEnd?.()}
                onClick={() => onOpenFolder(f.id)}
                onDragOver={(e) => {
                  if (!onFileDropToFolder && !onFolderDropToFolder) return;
                  if (dataTransferHasDriveFile(e.dataTransfer.types) || dataTransferHasDriveFolder(e.dataTransfer.types)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDropTargetChange?.(f.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) onDropTargetChange?.(null);
                }}
                onDrop={(e) => {
                  const fileId = e.dataTransfer.getData(DRIVE_FILE_DRAG_MIME);
                  const draggedFolderId = e.dataTransfer.getData(DRIVE_FOLDER_DRAG_MIME);
                  if (!fileId && !draggedFolderId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (fileId) onFileDropToFolder?.(f.id, fileId);
                  else if (draggedFolderId) onFolderDropToFolder?.(f.id, draggedFolderId);
                  onDropTargetChange?.(null);
                }}
              >
                <TableCell>
                  <div className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 flex size-9 items-center justify-center rounded-md">
                    <Folder className="size-4" />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {formatSize(totalBytes)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {formatDate(new Date(displayMs))}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {isArabic ? "مجلد" : "Folder"} · {fileCountByFolderId.get(f.id) ?? 0}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex flex-nowrap items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      draggable={false}
                      className="size-8 shrink-0"
                      aria-label={isArabic ? "مشاركة" : "Share"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareFolder(f);
                      }}
                    >
                      <Share2 className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      draggable={false}
                      className="size-8 shrink-0"
                      aria-label={isArabic ? "صلاحيات" : "Access"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAccessFolder(f);
                      }}
                    >
                      <Users className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      draggable={false}
                      className="size-8 shrink-0"
                      aria-label={isArabic ? "إعادة تسمية" : "Rename"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenameFolder(f);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      draggable={false}
                      className="text-destructive size-8 shrink-0"
                      aria-label={isArabic ? "حذف" : "Delete"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(f);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {files.map((file) => (
            <TableRow
              key={file.id}
              className="cursor-pointer"
              draggable={!!onDragFileStart}
              onDragStart={(e) => onDragFileStart?.(file, e)}
              onDragEnd={() => onDragFileEnd?.()}
              onClick={() => onOpenFile(file)}
            >
              <TableCell>
                <FileTypeIcon name={file.name} mimeType={file.mimeType} compact />
              </TableCell>
              <TableCell className="max-w-[220px] font-medium" title={file.name}>
                <div className="flex min-w-0 items-center gap-2">
                  {file.isPublic && file.shareToken ? (
                    <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                      {isArabic ? "مشارك" : "Shared"}
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
                {typeLabel(file.name, file.mimeType, isArabic)}
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
