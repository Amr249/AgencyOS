"use client";

import * as React from "react";
import { Folder, PanelRightClose, PanelRightOpen, Pencil, Plus, Share2, Trash2, Users } from "lucide-react";
import { useLocale } from "next-intl";
import type { FolderRow } from "@/actions/folders";
import type { FileRow } from "@/lib/file-types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DRIVE_FILE_DRAG_MIME, DRIVE_FOLDER_DRAG_MIME, dataTransferHasDriveFile, dataTransferHasDriveFolder } from "@/lib/drive-dnd";

function buildChildrenMap(rows: FolderRow[]): Map<string | null, FolderRow[]> {
  const map = new Map<string | null, FolderRow[]>();
  for (const r of rows) {
    const p = r.parentId ?? null;
    const list = map.get(p) ?? [];
    list.push(r);
    map.set(p, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  return map;
}

function countFilesInFolder(folderId: string, files: FileRow[]): number {
  return files.filter((f) => f.folderId === folderId).length;
}

type TreeBranchProps = {
  folder: FolderRow;
  depth: number;
  childrenMap: Map<string | null, FolderRow[]>;
  files: FileRow[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  currentFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onRenameRequest: (folder: FolderRow) => void;
  onDeleteRequest: (folder: FolderRow) => void;
  onAccessRequest: (folder: FolderRow) => void;
  onShareRequest: (folder: FolderRow) => void;
  onFileDrop: (targetFolderId: string, draggedFileId: string) => void;
  onFolderDrop: (targetFolderId: string, draggedFolderId: string) => void;
  dropTargetFolderId: string | null;
  onDropTargetChange: (folderId: string | null) => void;
  draggingFolderId: string | null;
  onDragFolderStart: (folder: FolderRow, e: React.DragEvent) => void;
  onDragFolderEnd: () => void;
  isArabic: boolean;
};

function TreeBranch({
  folder,
  depth,
  childrenMap,
  files,
  expanded,
  toggle,
  currentFolderId,
  onSelectFolder,
  onRenameRequest,
  onDeleteRequest,
  onAccessRequest,
  onShareRequest,
  onFileDrop,
  onFolderDrop,
  dropTargetFolderId,
  onDropTargetChange,
  draggingFolderId,
  onDragFolderStart,
  onDragFolderEnd,
  isArabic,
}: TreeBranchProps) {
  const children = childrenMap.get(folder.id) ?? [];
  const isOpen = expanded.has(folder.id);
  const isActive = currentFolderId === folder.id;
  const count = countFilesInFolder(folder.id, files);
  const isDropTarget = dropTargetFolderId === folder.id;
  const isDraggingThisFolder = draggingFolderId === folder.id;

  return (
    <div className="select-none">
      <div
        draggable
        onDragStart={(e) => onDragFolderStart(folder, e)}
        onDragEnd={onDragFolderEnd}
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pe-1 ps-1 hover:bg-muted/80",
          isActive && "bg-muted",
          isDropTarget && "bg-primary/10 ring-1 ring-primary/40",
          isDraggingThisFolder && "opacity-50"
        )}
        style={{ paddingInlineStart: 8 + depth * 12 }}
        onDragOver={(e) => {
          if (dataTransferHasDriveFile(e.dataTransfer.types) || dataTransferHasDriveFolder(e.dataTransfer.types)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            onDropTargetChange(folder.id);
          }
        }}
        onDragLeave={() => onDropTargetChange(null)}
        onDrop={(e) => {
          const fileId = e.dataTransfer.getData(DRIVE_FILE_DRAG_MIME);
          const draggedFolderId = e.dataTransfer.getData(DRIVE_FOLDER_DRAG_MIME);
          if (!fileId && !draggedFolderId) return;
          e.preventDefault();
          e.stopPropagation();
          if (fileId) onFileDrop(folder.id, fileId);
          else if (draggedFolderId) onFolderDrop(folder.id, draggedFolderId);
          onDropTargetChange(null);
        }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            draggable={false}
            className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded"
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
          >
            <span className="text-xs">{isOpen ? "▾" : isArabic ? "◂" : "▸"}</span>
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-start text-sm"
          onClick={() => onSelectFolder(folder.id)}
        >
          <Folder className="text-amber-600 dark:text-amber-400 size-4 shrink-0" />
          <span className="truncate font-medium">{folder.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs">({count})</span>
        </button>
        <div className="flex shrink-0 flex-nowrap items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable={false}
            className="size-7 shrink-0"
            aria-label={isArabic ? "مشاركة" : "Share"}
            onClick={(e) => {
              e.stopPropagation();
              onShareRequest(folder);
            }}
          >
            <Share2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable={false}
            className="size-7 shrink-0"
            aria-label={isArabic ? "صلاحيات" : "Access"}
            onClick={(e) => {
              e.stopPropagation();
              onAccessRequest(folder);
            }}
          >
            <Users className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable={false}
            className="size-7 shrink-0"
            aria-label={isArabic ? "إعادة تسمية" : "Rename"}
            onClick={(e) => {
              e.stopPropagation();
              onRenameRequest(folder);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            draggable={false}
            className="text-destructive hover:text-destructive size-7 shrink-0"
            aria-label={isArabic ? "حذف" : "Delete"}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(folder);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {isOpen && children.length > 0 ? (
        <div>
          {children.map((ch) => (
            <TreeBranch
              key={ch.id}
              folder={ch}
              depth={depth + 1}
              childrenMap={childrenMap}
              files={files}
              expanded={expanded}
              toggle={toggle}
              currentFolderId={currentFolderId}
              onSelectFolder={onSelectFolder}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              onAccessRequest={onAccessRequest}
              onShareRequest={onShareRequest}
              onFileDrop={onFileDrop}
              onFolderDrop={onFolderDrop}
              dropTargetFolderId={dropTargetFolderId}
              onDropTargetChange={onDropTargetChange}
              draggingFolderId={draggingFolderId}
              onDragFolderStart={onDragFolderStart}
              onDragFolderEnd={onDragFolderEnd}
              isArabic={isArabic}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type FolderTreeProps = {
  folders: FolderRow[];
  files: FileRow[];
  currentFolderId: string | null;
  onSelectAllFiles: () => void;
  onSelectFolder: (id: string) => void;
  onCreateFolder: () => void;
  onRenameFolderRequest: (folder: FolderRow) => void;
  onDeleteFolderRequest: (folder: FolderRow) => void;
  onFolderAccessRequest: (folder: FolderRow) => void;
  onFolderShareRequest: (folder: FolderRow) => void;
  onFileDropToFolder: (targetFolderId: string, draggedFileId: string) => void;
  onFolderDropToFolder: (targetFolderId: string, draggedFolderId: string) => void;
  dropTargetFolderId: string | null;
  onDropTargetChange: (folderId: string | null) => void;
  draggingFolderId: string | null;
  onDragFolderStart: (folder: FolderRow, e: React.DragEvent) => void;
  onDragFolderEnd: () => void;
  sidebarFooter?: React.ReactNode;
  /** Desktop: collapse inner sidebar */
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  className?: string;
};

export function FolderTree({
  folders,
  files,
  currentFolderId,
  onSelectAllFiles,
  onSelectFolder,
  onCreateFolder,
  onRenameFolderRequest,
  onDeleteFolderRequest,
  onFolderAccessRequest,
  onFolderShareRequest,
  onFileDropToFolder,
  onFolderDropToFolder,
  dropTargetFolderId,
  onDropTargetChange,
  draggingFolderId,
  onDragFolderStart,
  onDragFolderEnd,
  sidebarFooter,
  collapsed = false,
  onCollapsedChange,
  className,
}: FolderTreeProps) {
  const isArabic = useLocale() === "ar";
  const treeDir = isArabic ? "rtl" : "ltr";
  const childrenMap = React.useMemo(() => buildChildrenMap(folders), [folders]);
  const roots = childrenMap.get(null) ?? [];
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (currentFolderId) {
      setExpanded((prev) => {
        const next = new Set(prev);
        let walk: FolderRow | undefined = folders.find((f) => f.id === currentFolderId);
        while (walk?.parentId) {
          next.add(walk.parentId);
          walk = folders.find((f) => f.id === walk!.parentId!);
        }
        return next;
      });
    }
  }, [currentFolderId, folders]);

  const treeBody = (
    <>
      <button
        type="button"
        onClick={() => {
          onSelectAllFiles();
          setMobileOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm font-medium transition-colors",
          currentFolderId === null
            ? "border-primary/30 bg-primary/5"
            : "border-transparent hover:bg-muted/80"
        )}
      >
        <Folder className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate">{isArabic ? "جميع الملفات" : "All files"}</span>
      </button>
      <Separator className="my-2" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-2 ps-2 pe-2" dir={treeDir}>
          {roots.map((f) => (
            <TreeBranch
              key={f.id}
              folder={f}
              depth={0}
              childrenMap={childrenMap}
              files={files}
              expanded={expanded}
              toggle={toggle}
              currentFolderId={currentFolderId}
              onSelectFolder={(id) => {
                onSelectFolder(id);
                setMobileOpen(false);
              }}
              onRenameRequest={onRenameFolderRequest}
              onDeleteRequest={onDeleteFolderRequest}
              onAccessRequest={onFolderAccessRequest}
              onShareRequest={onFolderShareRequest}
              onFileDrop={onFileDropToFolder}
              onFolderDrop={onFolderDropToFolder}
              dropTargetFolderId={dropTargetFolderId}
              onDropTargetChange={onDropTargetChange}
              draggingFolderId={draggingFolderId}
              onDragFolderStart={onDragFolderStart}
              onDragFolderEnd={onDragFolderEnd}
              isArabic={isArabic}
            />
          ))}
        </div>
      </ScrollArea>
      <Separator className="my-2 shrink-0" />
      <Button type="button" variant="outline" className="w-full shrink-0 gap-2" onClick={onCreateFolder}>
        <Plus className="size-4" />
        {isArabic ? "مجلد جديد" : "New folder"}
      </Button>
      {sidebarFooter ? (
        <>
          <Separator className="my-2 shrink-0" />
          <div className="shrink-0">{sidebarFooter}</div>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <div className={cn("flex lg:hidden", className)} dir={treeDir}>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Folder className="size-4" />
              {isArabic ? "المجلدات" : "Folders"}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isArabic ? "left" : "right"}
            dir={treeDir}
            className="flex w-[min(100%,280px)] flex-col gap-3"
          >
            <SheetHeader>
              <SheetTitle>{isArabic ? "المجلدات" : "Folders"}</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2">{treeBody}</div>
          </SheetContent>
        </Sheet>
      </div>

      {collapsed ? (
        <div
          dir={treeDir}
          className={cn("border-border hidden shrink-0 flex-col items-center gap-2 border-s bg-card p-2 lg:flex", className)}
        >
          {onCollapsedChange ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isArabic ? "إظهار المجلدات" : "Show folders"}
              onClick={() => onCollapsedChange(false)}
            >
              <PanelRightOpen className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : (
        <aside
          dir={treeDir}
          className={cn(
            "border-border bg-card hidden w-[240px] shrink-0 flex-col gap-2 rounded-lg border p-3 lg:flex",
            className
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {isArabic ? "المجلدات" : "Folders"}
            </span>
            {onCollapsedChange ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={isArabic ? "طي الشريط الجانبي" : "Collapse sidebar"}
                onClick={() => onCollapsedChange(true)}
              >
                <PanelRightClose className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">{treeBody}</div>
        </aside>
      )}

    </>
  );
}
