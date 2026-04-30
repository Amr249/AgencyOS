"use client";

import { Pencil, Share2, Trash2, Users } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FolderRow } from "@/actions/folders";
import { DriveFolderIcon, driveFolderPreviewSurfaceClass } from "@/components/modules/files/drive-folder-icon";
import { cn } from "@/lib/utils";
import { DRIVE_FILE_DRAG_MIME, DRIVE_FOLDER_DRAG_MIME, dataTransferHasDriveFile, dataTransferHasDriveFolder } from "@/lib/drive-dnd";

type FolderCardProps = {
  folder: FolderRow;
  itemCount: number;
  totalBytes: number;
  displayDateMs: number;
  onOpen: () => void;
  onRename: (folder: FolderRow) => void;
  onDelete: (folder: FolderRow) => void;
  onShare: (folder: FolderRow) => void;
  onAccess: (folder: FolderRow) => void;
  onDragFolderStart?: (folder: FolderRow, e: React.DragEvent) => void;
  onDragFolderEnd?: () => void;
  isDropTarget?: boolean;
  onFileDropToThisFolder?: (fileId: string) => void;
  onFolderDropToThisFolder?: (draggedFolderId: string) => void;
  onDropTargetChange?: (folderId: string | null) => void;
  formatSize: (n: number | null | undefined) => string;
  formatDate: (d: Date | string | null | undefined) => string;
  className?: string;
};

export function FolderCard({
  folder,
  itemCount,
  totalBytes,
  displayDateMs,
  onOpen,
  onRename,
  onDelete,
  onShare,
  onAccess,
  onDragFolderStart,
  onDragFolderEnd,
  isDropTarget,
  onFileDropToThisFolder,
  onFolderDropToThisFolder,
  onDropTargetChange,
  formatSize,
  formatDate,
  className,
}: FolderCardProps) {
  const isArabic = useLocale() === "ar";
  const dateLabel = formatDate(new Date(displayDateMs));
  const systemLocked = folder.isSystem;
  const draggable = Boolean(onDragFolderStart) && !systemLocked;
  const showFolderActions = !systemLocked;

  return (
    <Card
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => onDragFolderStart?.(folder, e)}
      onDragEnd={() => onDragFolderEnd?.()}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        isDropTarget && "ring-2 ring-primary/50",
        className
      )}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      onDragOver={(e) => {
        if (!onFileDropToThisFolder && !onFolderDropToThisFolder) return;
        if (dataTransferHasDriveFile(e.dataTransfer.types) || dataTransferHasDriveFolder(e.dataTransfer.types)) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          onDropTargetChange?.(folder.id);
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
        if (fileId) onFileDropToThisFolder?.(fileId);
        else if (draggedFolderId) onFolderDropToThisFolder?.(draggedFolderId);
        onDropTargetChange?.(null);
      }}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="relative mx-auto w-full max-w-[200px]">
          <div
            className={cn(
              "flex h-[120px] w-full items-center justify-center rounded-lg border-b",
              driveFolderPreviewSurfaceClass(folder.systemType)
            )}
          >
            <DriveFolderIcon systemType={folder.systemType} className="size-14 opacity-95" />
          </div>
          {showFolderActions ? (
            <div className="absolute inset-0 flex flex-nowrap items-center justify-center gap-1 bg-black/55 px-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                draggable={false}
                className="size-9 shrink-0"
                aria-label={isArabic ? "مشاركة" : "Share"}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(folder);
                }}
              >
                <Share2 className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                draggable={false}
                className="size-9 shrink-0"
                aria-label={isArabic ? "صلاحيات" : "Access"}
                onClick={(e) => {
                  e.stopPropagation();
                  onAccess(folder);
                }}
              >
                <Users className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                draggable={false}
                className="size-9 shrink-0"
                aria-label={isArabic ? "إعادة تسمية" : "Rename"}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(folder);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                draggable={false}
                className="size-9 shrink-0"
                aria-label={isArabic ? "حذف" : "Delete"}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
        <p className="line-clamp-2 w-full text-sm font-medium" title={folder.name}>
          {folder.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {itemCount} {isArabic ? (itemCount === 1 ? "عنصر" : "عناصر") : itemCount === 1 ? "item" : "items"}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatSize(totalBytes)} · {dateLabel}
        </p>
      </CardContent>
    </Card>
  );
}
