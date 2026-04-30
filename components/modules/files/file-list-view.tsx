"use client";

import { Download, Link as LinkIcon, Lock, Pencil, Share2, Trash2, Users } from "lucide-react";
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
import { DriveFolderIcon, driveFolderPreviewSurfaceClass } from "@/components/modules/files/drive-folder-icon";
import {
  canAccessDriveFolder,
  canDeleteDriveFolder,
  canRenameDriveFolder,
  canShareDriveFolder,
  showDriveFolderLock,
} from "@/lib/drive-folder-permissions";
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
  canManageFolderAccess?: boolean;
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
  canManageFolderAccess = true,
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
            const canRen = canRenameDriveFolder(f);
            const canDel = canDeleteDriveFolder(f);
            const canShr = canShareDriveFolder(f);
            const canAcc = canAccessDriveFolder(f, canManageFolderAccess);
            const hasFolderActions = canShr || canAcc || canRen || canDel;
            const canReceiveDrop = Boolean(onFileDropToFolder || onFolderDropToFolder);
            const onFolderCellDragOver = (e: React.DragEvent) => {
              if (!canReceiveDrop) return;
              if (dataTransferHasDriveFile(e.dataTransfer.types) || dataTransferHasDriveFolder(e.dataTransfer.types)) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                onDropTargetChange?.(f.id);
              }
            };
            const onFolderCellDrop = (e: React.DragEvent) => {
              const fileId = e.dataTransfer.getData(DRIVE_FILE_DRAG_MIME);
              const draggedFolderId = e.dataTransfer.getData(DRIVE_FOLDER_DRAG_MIME);
              if (!fileId && !draggedFolderId) return;
              e.preventDefault();
              e.stopPropagation();
              if (fileId) onFileDropToFolder?.(f.id, fileId);
              else if (draggedFolderId) onFolderDropToFolder?.(f.id, draggedFolderId);
              onDropTargetChange?.(null);
            };
            return (
              <TableRow
                key={f.id}
                className={cn(
                  "cursor-pointer",
                  dropTargetFolderId === f.id && "bg-primary/5 ring-1 ring-primary/30"
                )}
                draggable={!!onDragFolderStart && canRen}
                onDragStart={(e) => onDragFolderStart?.(f, e)}
                onDragEnd={() => onDragFolderEnd?.()}
                onClick={() => onOpenFolder(f.id)}
                onDragLeave={(e) => {
                  const rel = e.relatedTarget as Node | null;
                  if (!rel || !e.currentTarget.contains(rel)) onDropTargetChange?.(null);
                }}
              >
                <TableCell onDragOver={onFolderCellDragOver} onDrop={onFolderCellDrop}>
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md",
                      driveFolderPreviewSurfaceClass(f.systemType)
                    )}
                  >
                    <DriveFolderIcon systemType={f.systemType} className="size-4" />
                  </div>
                </TableCell>
                <TableCell className="font-medium" onDragOver={onFolderCellDragOver} onDrop={onFolderCellDrop}>
                  <div className="flex min-w-0 items-center gap-2">
                    {showDriveFolderLock(f) ? (
                      <Lock className="text-muted-foreground size-3.5 shrink-0 opacity-70" aria-hidden />
                    ) : null}
                    <span className="min-w-0 truncate">{f.name}</span>
                  </div>
                </TableCell>
                <TableCell
                  className="text-muted-foreground hidden sm:table-cell"
                  onDragOver={onFolderCellDragOver}
                  onDrop={onFolderCellDrop}
                >
                  {formatSize(totalBytes)}
                </TableCell>
                <TableCell
                  className="text-muted-foreground hidden md:table-cell"
                  onDragOver={onFolderCellDragOver}
                  onDrop={onFolderCellDrop}
                >
                  {formatDate(new Date(displayMs))}
                </TableCell>
                <TableCell className="hidden lg:table-cell" onDragOver={onFolderCellDragOver} onDrop={onFolderCellDrop}>
                  {isArabic ? "مجلد" : "Folder"} · {fileCountByFolderId.get(f.id) ?? 0}
                </TableCell>
                <TableCell className="text-end" onDragOver={onFolderCellDragOver} onDrop={onFolderCellDrop}>
                  {hasFolderActions ? (
                    <div className="flex flex-nowrap items-center justify-end gap-0.5">
                      {canShr ? (
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
                      ) : null}
                      {canAcc ? (
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
                      ) : null}
                      {canRen ? (
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
                      ) : null}
                      {canDel ? (
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
                      ) : null}
                    </div>
                  ) : showDriveFolderLock(f) ? (
                    <span className="text-muted-foreground inline-flex justify-end opacity-60" title={isArabic ? "مجلد نظام" : "System folder"}>
                      <Lock className="size-4" aria-hidden />
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {files.map((file) => {
            const fid = file.folderId ?? null;
            const fileRowCanReceive = Boolean(fid && (onFileDropToFolder || onFolderDropToFolder));
            const isFileRowDropHighlight = Boolean(fid && dropTargetFolderId === fid);
            const onFileRowCellDragOver = (e: React.DragEvent) => {
              if (!fid || (!onFileDropToFolder && !onFolderDropToFolder)) return;
              if (!dataTransferHasDriveFile(e.dataTransfer.types) && !dataTransferHasDriveFolder(e.dataTransfer.types)) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              onDropTargetChange?.(fid);
            };
            const onFileRowCellDrop = (e: React.DragEvent) => {
              if (!fid) return;
              const draggedFileId = e.dataTransfer.getData(DRIVE_FILE_DRAG_MIME);
              const draggedFolderId = e.dataTransfer.getData(DRIVE_FOLDER_DRAG_MIME);
              if (!draggedFileId && !draggedFolderId) return;
              e.preventDefault();
              e.stopPropagation();
              if (draggedFileId && draggedFileId !== file.id) {
                onFileDropToFolder?.(fid, draggedFileId);
              } else if (draggedFolderId) {
                onFolderDropToFolder?.(fid, draggedFolderId);
              }
              onDropTargetChange?.(null);
            };
            return (
            <TableRow
              key={file.id}
              className={cn(
                "cursor-pointer",
                isFileRowDropHighlight && "bg-primary/5 ring-1 ring-primary/30"
              )}
              draggable={!!onDragFileStart}
              onDragStart={(e) => onDragFileStart?.(file, e)}
              onDragEnd={() => onDragFileEnd?.()}
              onClick={() => onOpenFile(file)}
              onDragLeave={(e) => {
                const rel = e.relatedTarget as Node | null;
                if (!rel || !e.currentTarget.contains(rel)) onDropTargetChange?.(null);
              }}
            >
              <TableCell
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                <FileTypeIcon name={file.name} mimeType={file.mimeType} compact />
              </TableCell>
              <TableCell
                className="max-w-[220px] font-medium"
                title={file.name}
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {file.isPublic && file.shareToken ? (
                    <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                      {isArabic ? "مشارك" : "Shared"}
                    </Badge>
                  ) : null}
                  <span className="truncate">{file.name}</span>
                </div>
              </TableCell>
              <TableCell
                className="text-muted-foreground hidden sm:table-cell"
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                {formatSize(file.sizeBytes)}
              </TableCell>
              <TableCell
                className="text-muted-foreground hidden md:table-cell"
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                {formatDate(file.createdAt)}
              </TableCell>
              <TableCell
                className="hidden lg:table-cell"
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                {typeLabel(file.name, file.mimeType, isArabic)}
              </TableCell>
              <TableCell
                className="text-end"
                onDragOver={fileRowCanReceive ? onFileRowCellDragOver : undefined}
                onDrop={fileRowCanReceive ? onFileRowCellDrop : undefined}
              >
                <div className="flex justify-end gap-0.5">
                  {onShareFile ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      draggable={false}
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
                    draggable={false}
                    className="size-8"
                    aria-label="تنزيل"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(file.publicFileUrl, file.name);
                    }}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    draggable={false}
                    className="size-8"
                    aria-label="نسخ الرابط"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyLink(file.publicFileUrl);
                    }}
                  >
                    <LinkIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    draggable={false}
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
