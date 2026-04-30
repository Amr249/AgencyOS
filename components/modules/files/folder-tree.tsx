"use client";

import * as React from "react";
import { Folder, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import type { FolderRow } from "@/actions/folders";
import type { FileRow } from "@/lib/file-types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
}: TreeBranchProps) {
  const children = childrenMap.get(folder.id) ?? [];
  const isOpen = expanded.has(folder.id);
  const isActive = currentFolderId === folder.id;
  const count = countFilesInFolder(folder.id, files);

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pe-1 ps-1 hover:bg-muted/80",
          isActive && "bg-muted"
        )}
        style={{ paddingInlineStart: 8 + depth * 12 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded"
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
          >
            <span className="text-xs">{isOpen ? "▾" : "▸"}</span>
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-start text-sm"
          onClick={() => onSelectFolder(folder.id)}
        >
          <Folder className="text-amber-600 dark:text-amber-400 size-4 shrink-0" />
          <span className="truncate font-medium">{folder.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs">({count})</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="قائمة المجلد"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRenameRequest(folder)}>إعادة تسمية</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDeleteRequest(folder)}
            >
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolderRequest: (folder: FolderRow) => void;
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
  onRenameFolder,
  onDeleteFolderRequest,
  collapsed = false,
  onCollapsedChange,
  className,
}: FolderTreeProps) {
  const childrenMap = React.useMemo(() => buildChildrenMap(folders), [folders]);
  const roots = childrenMap.get(null) ?? [];
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [renameTarget, setRenameTarget] = React.useState<FolderRow | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renameBusy, setRenameBusy] = React.useState(false);
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

  const openRename = (f: FolderRow) => {
    setRenameTarget(f);
    setRenameValue(f.name);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      await onRenameFolder(renameTarget.id, name);
      setRenameTarget(null);
    } finally {
      setRenameBusy(false);
    }
  };

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
        <span className="truncate">جميع الملفات</span>
      </button>
      <Separator className="my-2" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="pe-2 pb-2">
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
              onRenameRequest={openRename}
              onDeleteRequest={onDeleteFolderRequest}
            />
          ))}
        </div>
      </ScrollArea>
      <Separator className="my-2 shrink-0" />
      <Button type="button" variant="outline" className="w-full shrink-0 gap-2" onClick={onCreateFolder}>
        <Plus className="size-4" />
        مجلد جديد
      </Button>
    </>
  );

  return (
    <>
      <div className={cn("flex lg:hidden", className)}>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Folder className="size-4" />
              المجلدات
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-[min(100%,280px)] flex-col gap-3">
            <SheetHeader>
              <SheetTitle>المجلدات</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2">{treeBody}</div>
          </SheetContent>
        </Sheet>
      </div>

      {collapsed ? (
        <div className={cn("border-border hidden shrink-0 flex-col items-center gap-2 border-s bg-card p-2 lg:flex", className)}>
          {onCollapsedChange ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="إظهار المجلدات"
              onClick={() => onCollapsedChange(false)}
            >
              <PanelRightOpen className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : (
        <aside
          className={cn(
            "border-border bg-card hidden w-[240px] shrink-0 flex-col gap-2 rounded-lg border p-3 lg:flex",
            className
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              المجلدات
            </span>
            {onCollapsedChange ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label="طي الشريط الجانبي"
                onClick={() => onCollapsedChange(true)}
              >
                <PanelRightClose className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">{treeBody}</div>
        </aside>
      )}

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إعادة تسمية المجلد</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)} disabled={renameBusy}>
              إلغاء
            </Button>
            <Button type="button" onClick={submitRename} disabled={renameBusy}>
              {renameBusy ? "جاري الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
