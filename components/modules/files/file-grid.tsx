"use client";

import type { FileRow } from "@/lib/file-types";
import type { FolderRow } from "@/actions/folders";
import { FolderCard } from "@/components/modules/files/folder-card";
import { FileCard } from "@/components/modules/files/file-card";
import { cn } from "@/lib/utils";

type FileGridProps = {
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

export function FileGrid({
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
}: FileGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {childFolders.map((f) => (
        <FolderCard
          key={f.id}
          folder={f}
          itemCount={fileCountByFolderId.get(f.id) ?? 0}
          totalBytes={folderSizeBytesByFolderId.get(f.id) ?? 0}
          displayDateMs={
            folderDisplayDateMsByFolderId.get(f.id) ?? new Date(f.createdAt).getTime()
          }
          onOpen={() => onOpenFolder(f.id)}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
          onShare={onShareFolder}
          onAccess={onAccessFolder}
          onDragFolderStart={onDragFolderStart}
          onDragFolderEnd={onDragFolderEnd}
          isDropTarget={dropTargetFolderId === f.id}
          onFileDropToThisFolder={
            onFileDropToFolder ? (fileId) => onFileDropToFolder(f.id, fileId) : undefined
          }
          onFolderDropToThisFolder={
            onFolderDropToFolder ? (draggedId) => onFolderDropToFolder(f.id, draggedId) : undefined
          }
          onDropTargetChange={onDropTargetChange}
          formatSize={formatSize}
          formatDate={formatDate}
          canManageFolderAccess={canManageFolderAccess}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onOpen={onOpenFile}
          onDownload={onDownload}
          onCopyLink={onCopyLink}
          onDelete={onDeleteFile}
          onShare={onShareFile}
          onDragStart={onDragFileStart}
          onDragEnd={onDragFileEnd}
          formatSize={formatSize}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}
