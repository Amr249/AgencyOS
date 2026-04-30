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

export function FileGrid({
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
          name={f.name}
          itemCount={fileCountByFolderId.get(f.id) ?? 0}
          onOpen={() => onOpenFolder(f.id)}
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
          formatSize={formatSize}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}
