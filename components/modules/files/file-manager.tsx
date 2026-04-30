"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Grid3x3, List, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { getFiles, createFile, deleteFile } from "@/actions/files";
import {
  getAllFoldersForScope,
  getAllStandaloneFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  type FolderRow,
} from "@/actions/folders";
import type { FileRow } from "@/lib/file-types";
import { driveEntityPathFromFolder } from "@/lib/drive-upload-path";
import { FilePreviewModal } from "@/components/modules/files/file-preview-modal";
import { FileShareDialog } from "@/components/modules/files/file-share-dialog";
import { FolderTree } from "@/components/modules/files/folder-tree";
import { FileGrid } from "@/components/modules/files/file-grid";
import { FileListView } from "@/components/modules/files/file-list-view";
import { CreateFolderDialog } from "@/components/modules/files/create-folder-dialog";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
export type FileRecord = FileRow;
export type FolderRecord = FolderRow;

type SortKey = "name" | "date" | "size";
type ViewMode = "grid" | "list";

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

function breadcrumbsForFolder(all: FolderRow[], folderId: string | null): { id: string; name: string }[] {
  if (!folderId) return [];
  const out: { id: string; name: string }[] = [];
  let cur: FolderRow | undefined = all.find((f) => f.id === folderId);
  const guard = new Set<string>();
  while (cur != null && !guard.has(cur.id)) {
    guard.add(cur.id);
    out.unshift({ id: cur.id, name: cur.name });
    const parentId = cur.parentId;
    cur = parentId ? all.find((f) => f.id === parentId) : undefined;
  }
  return out;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length) as R[];
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function collectSubtreeFolderIds(rootId: string, allFolders: FolderRow[]): Set<string> {
  const out = new Set<string>();
  let frontier: string[] = [rootId];
  while (frontier.length) {
    for (const id of frontier) out.add(id);
    const children = allFolders.filter((f) => f.parentId != null && frontier.includes(f.parentId));
    frontier = children.map((c) => c.id);
  }
  return out;
}

const FOLDER_ID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FileManagerProps = {
  clientId?: string;
  projectId?: string;
  initialFiles: FileRow[];
  initialFolders: FolderRow[];
  currentFolderId?: string;
  standalone?: boolean;
  /** When set with `standalone`, folder navigation updates this URL (`?folder=`). */
  folderRouteBase?: string;
  /** R2 path prefix without slashes, e.g. `drive/user/{userId}` for standalone uploads at root. */
  driveUploadPathPrefix?: string;
};

export function FileManager({
  clientId,
  projectId,
  initialFiles,
  initialFolders,
  currentFolderId: initialCurrentFolderId,
  standalone = false,
  folderRouteBase,
  driveUploadPathPrefix,
}: FileManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [files, setFiles] = React.useState<FileRow[]>(initialFiles);
  const [folders, setFolders] = React.useState<FolderRow[]>(initialFolders);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(
    initialCurrentFolderId ?? null
  );
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [search, setSearch] = React.useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const [uploadQueue, setUploadQueue] = React.useState<{ key: string; name: string }[]>([]);
  const [deleteFileTarget, setDeleteFileTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = React.useState<FolderRow | null>(null);
  const [previewFile, setPreviewFile] = React.useState<FileRow | null>(null);
  const [shareFile, setShareFile] = React.useState<FileRow | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false);
  const [isDeletingFile, setIsDeletingFile] = React.useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = React.useState(false);
  const [dragDepth, setDragDepth] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  const canUpload = Boolean(clientId || projectId || standalone);

  const navigateToFolder = React.useCallback(
    (id: string | null) => {
      setCurrentFolderId(id);
      if (standalone && folderRouteBase) {
        if (id == null) {
          router.replace(folderRouteBase, { scroll: false });
        } else {
          router.replace(`${folderRouteBase}?folder=${encodeURIComponent(id)}`, { scroll: false });
        }
      }
    },
    [standalone, folderRouteBase, router]
  );

  React.useEffect(() => {
    if (standalone && folderRouteBase) {
      const raw = searchParams.get("folder");
      const id = raw && FOLDER_ID_PARAM_RE.test(raw) ? raw : null;
      setCurrentFolderId(id);
      return;
    }
    if (initialCurrentFolderId !== undefined) {
      setCurrentFolderId(initialCurrentFolderId ?? null);
    }
  }, [standalone, folderRouteBase, searchParams, initialCurrentFolderId]);

  React.useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  React.useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const refreshFolders = React.useCallback(() => {
    startTransition(async () => {
      if (standalone) {
        const res = await getAllStandaloneFolders();
        if (res.ok) setFolders(res.data);
        return;
      }
      if (!clientId && !projectId) return;
      const res = await getAllFoldersForScope(
        clientId ? { clientId } : { projectId: projectId! }
      );
      if (res.ok) setFolders(res.data);
    });
  }, [clientId, projectId, standalone]);

  const currentFolder = React.useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId) ?? null : null),
    [folders, currentFolderId]
  );

  const childFolders = React.useMemo(() => {
    const pid = currentFolderId;
    return folders.filter((f) => (pid == null ? f.parentId == null : f.parentId === pid));
  }, [folders, currentFolderId]);

  const fileCountByFolderId = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const f of files) {
      if (!f.folderId) continue;
      m.set(f.folderId, (m.get(f.folderId) ?? 0) + 1);
    }
    return m;
  }, [files]);

  const filesInScope = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      currentFolderId === null
        ? [...files]
        : files.filter((f) => f.folderId === currentFolderId);

    if (q.length) {
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }

    const dir = sortKey === "name" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") {
        return dir * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortKey === "size") {
        const sa = a.sizeBytes ?? 0;
        const sb = b.sizeBytes ?? 0;
        return dir * (sa - sb);
      }
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return dir * (ta - tb);
    });

    return list;
  }, [files, currentFolderId, search, sortKey]);

  const childFoldersFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q.length) return childFolders;
    return childFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [childFolders, search]);

  const crumbs = React.useMemo(
    () => breadcrumbsForFolder(folders, currentFolderId),
    [folders, currentFolderId]
  );

  const uploadOne = React.useCallback(
    async (file: globalThis.File, key: string): Promise<FileRow | null> => {
      if (!canUpload) return null;
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

      const drivePath = driveEntityPathFromFolder(
        currentFolder,
        clientId,
        projectId,
        driveUploadPathPrefix
      );
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "drive");
      formData.set("folderId", drivePath);
      formData.set("fileId", crypto.randomUUID());

      try {
        const res = await new Promise<{
          url?: string;
          key?: string;
          name?: string;
          size?: number;
          mimeType?: string | null;
          error?: string;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) {
              setUploadProgress((p) => ({
                ...p,
                [key]: Math.round((ev.loaded / ev.total) * 100),
              }));
            }
          });
          xhr.addEventListener("load", () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(data);
              else resolve({ error: data.error || "Upload failed" });
            } catch {
              reject(new Error("Invalid response"));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        setUploadProgress((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });

        if (res.error || !res.url || !res.key) {
          toast.error(res.error ?? "فشل الرفع");
          return null;
        }

        const createResult = await createFile({
          name: res.name ?? file.name,
          imagekitFileId: res.key,
          imagekitUrl: res.url,
          filePath: res.key,
          r2Key: res.key,
          mimeType: res.mimeType ?? null,
          sizeBytes: res.size ?? file.size ?? null,
          clientId: standalone ? null : clientId ?? null,
          projectId: standalone ? null : projectId ?? null,
          folderId: currentFolderId ?? undefined,
        });

        if (createResult.ok && createResult.data) {
          const row = createResult.data;
          const newFile: FileRow = {
            ...row,
            sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
          };
          toast.success("تم رفع الملف.");
          return newFile;
        }
        toast.error("تعذر حفظ الملف في قاعدة البيانات.");
        return null;
      } catch {
        setUploadProgress((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });
        toast.error("فشل الرفع.");
        return null;
      }
    },
    [canUpload, clientId, projectId, currentFolder, currentFolderId, standalone, driveUploadPathPrefix]
  );

  const uploadFiles = React.useCallback(
    async (fileList: globalThis.File[]) => {
      if (!canUpload || fileList.length === 0) return;
      const base = Date.now();
      const keys = fileList.map((f, i) => `${f.name}-${f.size}-${base}-${i}`);
      setUploadQueue(keys.map((key, i) => ({ key, name: fileList[i]!.name })));
      const results = await mapPool(fileList, 3, (f, i) => uploadOne(f, keys[i]!));
      setUploadQueue([]);
      setUploadProgress({});
      const added = results.filter((r): r is FileRow => r != null);
      if (added.length > 0) {
        setFiles((prev) => [...added, ...prev]);
        router.refresh();
      }
    },
    [canUpload, router, uploadOne]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length || !canUpload) return;
    void uploadFiles(Array.from(selected));
    e.target.value = "";
  };

  const handleDeleteFile = async () => {
    if (!deleteFileTarget) return;
    const id = deleteFileTarget.id;
    setIsDeletingFile(true);
    const result = await deleteFile(id);
    setIsDeletingFile(false);
    setDeleteFileTarget(null);
    if (result.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success("تم حذف الملف.");
      router.refresh();
    } else {
      toast.error(result.error ?? "فشل الحذف.");
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    setIsDeletingFolder(true);
    const id = deleteFolderTarget.id;
    const result = await deleteFolder(id);
    setIsDeletingFolder(false);
    setDeleteFolderTarget(null);
    if (result.ok) {
      const subtree = collectSubtreeFolderIds(id, folders);
      setFolders((prev) => prev.filter((f) => !subtree.has(f.id)));
      setFiles((prev) => prev.filter((f) => !f.folderId || !subtree.has(f.folderId)));
      if (currentFolderId && subtree.has(currentFolderId)) {
        navigateToFolder(null);
      }
      toast.success("تم حذف المجلد.");
      refreshFolders();
      router.refresh();
    } else {
      toast.error(result.error ?? "فشل حذف المجلد.");
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط.");
    } catch {
      toast.error("تعذر نسخ الرابط.");
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const applySharePatch = React.useCallback(
    (patch: Pick<FileRow, "id" | "isPublic" | "shareToken" | "shareExpiresAt">) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === patch.id ? { ...f, ...patch } : f))
      );
      setPreviewFile((prev) => (prev?.id === patch.id ? { ...prev, ...patch } : prev));
      setShareFile((prev) => (prev?.id === patch.id ? { ...prev, ...patch } : prev));
    },
    []
  );

  const openShareDialog = React.useCallback((f: FileRow) => {
    setShareFile(f);
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canUpload) return;
    setDragDepth((d) => d + 1);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(0);
    if (!canUpload) return;
    const items = e.dataTransfer.files;
    if (items?.length) void uploadFiles(Array.from(items));
  };

  const handleCreateFolder = async (name: string) => {
    const res = standalone
      ? await createFolder({
          name,
          parentId: currentFolderId,
          ...(currentFolderId ? {} : { standaloneRoot: true as const }),
        })
      : await createFolder({
          name,
          parentId: currentFolderId,
          clientId: clientId ?? undefined,
          projectId: projectId ?? undefined,
        });
    if (res.ok && res.data) {
      setFolders((prev) => [...prev, res.data]);
      toast.success("تم إنشاء المجلد.");
      router.refresh();
    } else if (!res.ok) {
      const msg =
        "_form" in res.error && Array.isArray(res.error._form)
          ? res.error._form.join(", ")
          : "فشل إنشاء المجلد.";
      toast.error(msg);
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const res = await renameFolder(id, name);
    if (res.ok && res.data) {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: res.data!.name } : f)));
      toast.success("تم تحديث الاسم.");
      router.refresh();
    } else {
      toast.error("فشلت إعادة التسمية.");
    }
  };

  const empty =
    childFoldersFiltered.length === 0 && filesInScope.length === 0 && uploadQueue.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <FolderTree
          folders={folders}
          files={files}
          currentFolderId={currentFolderId}
          onSelectAllFiles={() => navigateToFolder(null)}
          onSelectFolder={(id) => navigateToFolder(id)}
          onCreateFolder={() => setCreateFolderOpen(true)}
          onRenameFolder={handleRenameFolder}
          onDeleteFolderRequest={(f) => setDeleteFolderTarget(f)}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Breadcrumb>
              <BreadcrumbList className="flex-wrap">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => navigateToFolder(null)}
                    >
                      جميع الملفات
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c) => (
                  <React.Fragment key={c.id}>
                    <BreadcrumbSeparator>
                      <ChevronRight className="size-3.5" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      {c.id === currentFolderId ? (
                        <BreadcrumbPage>{c.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={() => navigateToFolder(c.id)}
                          >
                            {c.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 start-2 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث في الأسماء…"
                  className="ps-8"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label="شبكة"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label="قائمة"
                  onClick={() => setViewMode("list")}
                >
                  <List className="size-4" />
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={isPending}>
                    ترتيب
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortKey("name")}>حسب الاسم</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey("date")}>حسب التاريخ</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey("size")}>حسب الحجم</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                className="gap-2"
                disabled={!canUpload}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                رفع ملف +
              </Button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="*"
            onChange={handleFileSelect}
          />

          <div
            ref={dropZoneRef}
            className="relative min-h-[240px] rounded-lg border border-dashed bg-muted/10 p-3 sm:p-4"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {dragDepth > 0 && canUpload ? (
              <div className="bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-primary border-dashed">
                <p className="text-primary font-medium">أفلت الملفات للرفع</p>
              </div>
            ) : null}

            {uploadQueue.length > 0 ? (
              <div className="mb-4 space-y-2">
                {uploadQueue.map((u) => (
                  <div key={u.key} className="rounded-md border bg-card p-3">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <Progress value={uploadProgress[u.key] ?? 0} className="mt-2 h-2" />
                  </div>
                ))}
              </div>
            ) : null}

            {empty ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-muted-foreground text-sm">لا توجد ملفات أو مجلدات هنا.</p>
                {canUpload ? (
                  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                    <Upload className="me-2 size-4" />
                    رفع ملف
                  </Button>
                ) : null}
              </div>
            ) : viewMode === "grid" ? (
              <FileGrid
                childFolders={childFoldersFiltered}
                files={filesInScope}
                fileCountByFolderId={fileCountByFolderId}
                onOpenFolder={(id) => navigateToFolder(id)}
                onOpenFile={setPreviewFile}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDeleteFile={(f) => setDeleteFileTarget({ id: f.id, name: f.name })}
                onShareFile={openShareDialog}
                formatSize={formatSize}
                formatDate={formatDateSafe}
              />
            ) : (
              <FileListView
                childFolders={childFoldersFiltered}
                files={filesInScope}
                fileCountByFolderId={fileCountByFolderId}
                onOpenFolder={(id) => navigateToFolder(id)}
                onOpenFile={setPreviewFile}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDeleteFile={(f) => setDeleteFileTarget({ id: f.id, name: f.name })}
                onShareFile={openShareDialog}
                formatSize={formatSize}
                formatDate={formatDateSafe}
              />
            )}
          </div>
        </div>
      </div>

      <FilePreviewModal
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        onDeleteRequest={(f) => {
          setPreviewFile(null);
          setDeleteFileTarget({ id: f.id, name: f.name });
        }}
        onDownload={handleDownload}
        onCopyLink={handleCopyLink}
        onShare={(f) => {
          setPreviewFile(null);
          setShareFile(f);
        }}
      />

      <FileShareDialog
        file={shareFile}
        open={!!shareFile}
        onOpenChange={(open) => {
          if (!open) setShareFile(null);
        }}
        onFileUpdated={applySharePatch}
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        parentFolderId={currentFolderId}
        onSubmit={handleCreateFolder}
      />

      <AlertDialog open={!!deleteFileTarget} onOpenChange={(open) => !open && setDeleteFileTarget(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ملف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذا الملف؟ لا يمكن التراجع عن هذا الإجراء.
              {deleteFileTarget ? (
                <>
                  <br />
                  <span className="font-medium">{deleteFileTarget.name}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFile}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFile();
              }}
              disabled={isDeletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFile ? "جاري الحذف…" : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مجلد</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذا المجلد وجميع محتوياته؟ سيتم حذف الملفات المرتبطة نهائياً.
              {deleteFolderTarget ? (
                <>
                  <br />
                  <span className="font-medium">{deleteFolderTarget.name}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFolder}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFolder();
              }}
              disabled={isDeletingFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFolder ? "جاري الحذف…" : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
