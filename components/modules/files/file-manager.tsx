"use client";

import * as React from "react";
import JSZip from "jszip";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { isDriveActionErrorKey } from "@/lib/drive-action-error-keys";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Grid3x3, List, Search, Upload } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  getFiles,
  createFile,
  deleteFile,
  moveFile,
  getDriveFolderDirectFileStats,
  type DriveFolderDirectFileStat,
} from "@/actions/files";
import {
  getAllFoldersForScope,
  getAllStandaloneFolders,
  getDriveFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderPublicSharing,
  moveFolder,
  type FolderRow,
} from "@/actions/folders";
import { DRIVE_FILE_DRAG_MIME, DRIVE_FOLDER_DRAG_MIME } from "@/lib/drive-dnd";
import type { FileRow } from "@/lib/file-types";
import { driveEntityPathFromFolder } from "@/lib/drive-upload-path";
import { folderSharePageUrl } from "@/lib/public-app-url";
import { FilePreviewModal } from "@/components/modules/files/file-preview-modal";
import { FileShareDialog } from "@/components/modules/files/file-share-dialog";
import { FolderTree } from "@/components/modules/files/folder-tree";
import { FileGrid } from "@/components/modules/files/file-grid";
import { FileListView } from "@/components/modules/files/file-list-view";
import { CreateFolderDialog } from "@/components/modules/files/create-folder-dialog";
import { RenameFolderDialog } from "@/components/modules/files/rename-folder-dialog";
import { FolderAccessDialog } from "@/components/modules/files/folder-access-dialog";
import { getFolderAccessDirectCountsByFolderId } from "@/actions/folder-access";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
export type FileRecord = FileRow;
export type FolderRecord = FolderRow;

type SortKey = "name" | "date" | "size";
type ViewMode = "grid" | "list";

const DRIVE_BATCH_TOAST_ID = "drive-batch-upload";

type UploadOneOptions = {
  /** Omit per-file success toasts (batch uploads). */
  quiet?: boolean;
  /** 0–1 for this file (presign + storage PUT). */
  onFraction?: (fraction: number) => void;
};

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
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
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

/** Max file rows loaded per open folder on agency drive (avoids huge payloads). */
const AGENCY_DRIVE_FILES_PAGE_LIMIT = 8000;

type FolderAggregateMaps = {
  fileCountByFolderId: Map<string, number>;
  folderSizeBytesByFolderId: Map<string, number>;
  folderDisplayDateMsByFolderId: Map<string, number>;
};

/** Sidebar + folder cards: roll up direct per-folder file stats to ancestors (matches all-file scan behavior). */
function rollUpFolderMetricsFromDirectStats(
  folderRows: FolderRow[],
  direct: Map<string, { fileCount: number; totalBytes: number; newestMs: number }>
): FolderAggregateMaps {
  const folderById = new Map(folderRows.map((f) => [f.id, f]));
  const countMap = new Map<string, number>();
  const sizeMap = new Map<string, number>();
  const touchMap = new Map<string, number>();

  for (const fo of folderRows) {
    sizeMap.set(fo.id, 0);
    const t = new Date(fo.createdAt).getTime();
    touchMap.set(fo.id, Number.isNaN(t) ? 0 : t);
  }

  for (const folder of folderRows) {
    let parentId = folder.parentId ?? null;
    while (parentId) {
      countMap.set(parentId, (countMap.get(parentId) ?? 0) + 1);
      parentId = folderById.get(parentId)?.parentId ?? null;
    }
  }

  for (const folder of folderRows) {
    const d = direct.get(folder.id);
    if (!d) continue;
    let cur: string | null = folder.id;
    while (cur) {
      countMap.set(cur, (countMap.get(cur) ?? 0) + d.fileCount);
      sizeMap.set(cur, (sizeMap.get(cur) ?? 0) + d.totalBytes);
      touchMap.set(cur, Math.max(touchMap.get(cur) ?? 0, d.newestMs));
      cur = folderById.get(cur)?.parentId ?? null;
    }
  }

  const depth = new Map<string, number>();
  for (const fo of folderRows) {
    let d = 0;
    let w: FolderRow | undefined = fo;
    const guard = new Set<string>();
    while (w?.parentId && !guard.has(w.id)) {
      guard.add(w.id);
      d++;
      w = folderById.get(w.parentId);
    }
    depth.set(fo.id, d);
  }
  const sortedByDepth = [...folderRows].sort((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0));
  for (const fo of sortedByDepth) {
    const p = fo.parentId;
    if (!p) continue;
    touchMap.set(p, Math.max(touchMap.get(p) ?? 0, touchMap.get(fo.id) ?? 0));
  }

  return {
    fileCountByFolderId: countMap,
    folderSizeBytesByFolderId: sizeMap,
    folderDisplayDateMsByFolderId: touchMap,
  };
}

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
  sidebarFooter?: React.ReactNode;
  availableProjects?: { id: string; name: string; iconUrl?: string | null }[];
  availableTeamMembers?: { id: string; name: string; avatarUrl?: string | null }[];
  allowStandaloneRoot?: boolean;
  /** Agency drive only: lightweight per-folder counts from DB (see getDriveFolderDirectFileStats). */
  initialDriveFolderDirectStats?: DriveFolderDirectFileStat[];
  /** When false, hide folder ACL UI (e.g. member drive). */
  canManageFolderAccess?: boolean;
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
  sidebarFooter,
  availableProjects = [],
  availableTeamMembers = [],
  allowStandaloneRoot = true,
  initialDriveFolderDirectStats,
  canManageFolderAccess = true,
}: FileManagerProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
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
  const [draggingFileId, setDraggingFileId] = React.useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = React.useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = React.useState<string | null>(null);
  const [extractingLabel, setExtractingLabel] = React.useState<string | null>(null);
  const [accessFolder, setAccessFolder] = React.useState<FolderRow | null>(null);
  const [folderAccessCounts, setFolderAccessCounts] = React.useState<ReadonlyMap<string, number>>(
    () => new Map()
  );
  const [shareFolder, setShareFolder] = React.useState<FolderRow | null>(null);
  const [shareBusy, setShareBusy] = React.useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = React.useState<FolderRow | null>(null);
  const [renameFolderBusy, setRenameFolderBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  const canUpload = Boolean(clientId || projectId || standalone);
  const tDriveErrors = useTranslations("driveActionErrors");
  const formatDriveActionError = React.useCallback(
    (msg: string) => (isDriveActionErrorKey(msg) ? tDriveErrors(msg) : msg),
    [tDriveErrors]
  );
  /** Member aggregate drive: uploads only inside an opened folder. */
  const effectiveCanUpload =
    canUpload && !(standalone && !allowStandaloneRoot && currentFolderId == null);
  const isAgencyStandaloneDrive = standalone && !clientId && !projectId;

  const [driveDirectStats, setDriveDirectStats] = React.useState<DriveFolderDirectFileStat[]>(
    () => initialDriveFolderDirectStats ?? []
  );
  const [agencyDriveListLoading, setAgencyDriveListLoading] = React.useState(false);

  React.useEffect(() => {
    setDriveDirectStats(initialDriveFolderDirectStats ?? []);
  }, [initialDriveFolderDirectStats]);

  const refreshFolderAccessCounts = React.useCallback(async () => {
    if (!isAgencyStandaloneDrive || !canManageFolderAccess) return;
    const res = await getFolderAccessDirectCountsByFolderId();
    if (res.ok) setFolderAccessCounts(new Map(Object.entries(res.data)));
  }, [isAgencyStandaloneDrive, canManageFolderAccess]);

  React.useEffect(() => {
    void refreshFolderAccessCounts();
  }, [refreshFolderAccessCounts]);

  const refreshDriveFolderStats = React.useCallback(async () => {
    if (!isAgencyStandaloneDrive) return;
    const res = await getDriveFolderDirectFileStats();
    if (res.ok) setDriveDirectStats(res.data);
  }, [isAgencyStandaloneDrive]);

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
    if (isAgencyStandaloneDrive) return;
    setFiles(initialFiles);
  }, [initialFiles, isAgencyStandaloneDrive]);

  React.useEffect(() => {
    if (!isAgencyStandaloneDrive) return;
    if (currentFolderId == null) {
      setFiles([]);
      setAgencyDriveListLoading(false);
      return;
    }
    let cancelled = false;
    setAgencyDriveListLoading(true);
    startTransition(async () => {
      const res = await getFiles({
        driveView: true,
        folderId: currentFolderId,
        takeLimit: AGENCY_DRIVE_FILES_PAGE_LIMIT,
      });
      if (!cancelled) {
        if (res.ok) setFiles(res.data);
        setAgencyDriveListLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAgencyStandaloneDrive, currentFolderId]);

  React.useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const refreshFolders = React.useCallback(() => {
    startTransition(async () => {
      if (standalone && isAgencyStandaloneDrive) {
        const res = await getDriveFolders();
        if (res.ok) setFolders(res.data);
        return;
      }
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
  }, [clientId, projectId, standalone, isAgencyStandaloneDrive]);

  const currentFolder = React.useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId) ?? null : null),
    [folders, currentFolderId]
  );

  const childFolders = React.useMemo(() => {
    const pid = currentFolderId;
    return folders.filter((f) => (pid == null ? f.parentId == null : f.parentId === pid));
  }, [folders, currentFolderId]);

  const aggregatesFromDriveStats = React.useMemo((): FolderAggregateMaps | null => {
    if (!isAgencyStandaloneDrive) return null;
    const direct = new Map<string, { fileCount: number; totalBytes: number; newestMs: number }>();
    for (const s of driveDirectStats) {
      direct.set(s.folderId, {
        fileCount: s.fileCount,
        totalBytes: s.totalBytes,
        newestMs: s.newestAt ? Date.parse(s.newestAt) : 0,
      });
    }
    return rollUpFolderMetricsFromDirectStats(folders, direct);
  }, [isAgencyStandaloneDrive, driveDirectStats, folders]);

  const aggregatesFromFiles = React.useMemo((): FolderAggregateMaps => {
    const m = new Map<string, number>();
    const folderById = new Map(folders.map((f) => [f.id, f]));

    for (const folder of folders) {
      let parentId = folder.parentId ?? null;
      while (parentId) {
        m.set(parentId, (m.get(parentId) ?? 0) + 1);
        parentId = folderById.get(parentId)?.parentId ?? null;
      }
    }

    for (const f of files) {
      if (!f.folderId) continue;
      let cur: string | null = f.folderId;
      while (cur) {
        m.set(cur, (m.get(cur) ?? 0) + 1);
        cur = folderById.get(cur)?.parentId ?? null;
      }
    }

    const sizeMap = new Map<string, number>();
    const touchMap = new Map<string, number>();
    for (const fo of folders) {
      sizeMap.set(fo.id, 0);
      const t = new Date(fo.createdAt).getTime();
      touchMap.set(fo.id, Number.isNaN(t) ? 0 : t);
    }
    for (const file of files) {
      if (!file.folderId) continue;
      const sz = file.sizeBytes != null ? Number(file.sizeBytes) : 0;
      const ft = new Date(file.createdAt).getTime();
      let cur: string | null = file.folderId;
      while (cur) {
        sizeMap.set(cur, (sizeMap.get(cur) ?? 0) + sz);
        if (!Number.isNaN(ft)) {
          touchMap.set(cur, Math.max(touchMap.get(cur) ?? 0, ft));
        }
        cur = folderById.get(cur)?.parentId ?? null;
      }
    }
    const depth = new Map<string, number>();
    for (const fo of folders) {
      let d = 0;
      let w: FolderRow | undefined = fo;
      const guard = new Set<string>();
      while (w?.parentId && !guard.has(w.id)) {
        guard.add(w.id);
        d++;
        w = folderById.get(w.parentId);
      }
      depth.set(fo.id, d);
    }
    const sortedByDepth = [...folders].sort((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0));
    for (const fo of sortedByDepth) {
      const p = fo.parentId;
      if (!p) continue;
      touchMap.set(p, Math.max(touchMap.get(p) ?? 0, touchMap.get(fo.id) ?? 0));
    }
    return {
      fileCountByFolderId: m,
      folderSizeBytesByFolderId: sizeMap,
      folderDisplayDateMsByFolderId: touchMap,
    };
  }, [files, folders]);

  const fileCountByFolderId =
    aggregatesFromDriveStats?.fileCountByFolderId ?? aggregatesFromFiles.fileCountByFolderId;
  const folderSizeBytesByFolderId =
    aggregatesFromDriveStats?.folderSizeBytesByFolderId ?? aggregatesFromFiles.folderSizeBytesByFolderId;
  const folderDisplayDateMsByFolderId =
    aggregatesFromDriveStats?.folderDisplayDateMsByFolderId ??
    aggregatesFromFiles.folderDisplayDateMsByFolderId;

  const directFileCountByFolderIdForTree = React.useMemo((): ReadonlyMap<string, number> | null => {
    if (!isAgencyStandaloneDrive) return null;
    const m = new Map<string, number>();
    for (const s of driveDirectStats) {
      m.set(s.folderId, s.fileCount);
    }
    return m;
  }, [isAgencyStandaloneDrive, driveDirectStats]);

  const filesInScope = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      currentFolderId === null
        ? isAgencyStandaloneDrive
          ? []
          : [...files]
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
  }, [files, currentFolderId, search, sortKey, isAgencyStandaloneDrive]);

  const childFoldersFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q.length) return childFolders;
    return childFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [childFolders, search]);

  const childFoldersSorted = React.useMemo(() => {
    const list = [...childFoldersFiltered];
    const dir = sortKey === "name" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") {
        return dir * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortKey === "size") {
        const sa = folderSizeBytesByFolderId.get(a.id) ?? 0;
        const sb = folderSizeBytesByFolderId.get(b.id) ?? 0;
        return dir * (sa - sb);
      }
      const ta = folderDisplayDateMsByFolderId.get(a.id) ?? new Date(a.createdAt).getTime();
      const tb = folderDisplayDateMsByFolderId.get(b.id) ?? new Date(b.createdAt).getTime();
      return dir * (ta - tb);
    });
    return list;
  }, [
    childFoldersFiltered,
    sortKey,
    folderSizeBytesByFolderId,
    folderDisplayDateMsByFolderId,
  ]);

  const crumbs = React.useMemo(
    () => breadcrumbsForFolder(folders, currentFolderId),
    [folders, currentFolderId]
  );

  const createFolderInScope = React.useCallback(
    async (name: string, parentId: string | null): Promise<FolderRow | null> => {
      if (standalone && !parentId && !allowStandaloneRoot) {
        toast.error(formatDriveActionError("memberDriveFolderRequired"));
        return null;
      }
      const res = standalone
        ? await createFolder({
            name,
            parentId,
            ...(parentId
              ? {}
              : { standaloneRoot: true as const }),
          })
        : await createFolder({
            name,
            parentId,
            clientId: clientId ?? undefined,
            projectId: projectId ?? undefined,
          });
      if (!res.ok || !res.data) return null;
      return res.data;
    },
    [standalone, allowStandaloneRoot, clientId, projectId, formatDriveActionError]
  );

  const uploadOne = React.useCallback(
    async (
      file: globalThis.File,
      key: string,
      targetFolderId: string | null,
      options?: UploadOneOptions
    ): Promise<FileRow | null> => {
      if (!canUpload) return null;
      if (standalone && !allowStandaloneRoot && !targetFolderId) {
        toast.error(formatDriveActionError("memberDriveFolderRequired"));
        return null;
      }
      const quiet = options?.quiet ?? false;
      const onFraction = options?.onFraction;
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }));
      onFraction?.(0);

      const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) ?? null : null;
      const drivePath = driveEntityPathFromFolder(
        targetFolder ?? currentFolder,
        clientId,
        projectId,
        driveUploadPathPrefix
      );
      const formData = new FormData();
      formData.set("filename", file.name);
      formData.set("sizeBytes", String(file.size ?? 0));
      formData.set("mimeType", file.type || "application/octet-stream");
      formData.set("scope", "drive");
      formData.set("folderId", drivePath);
      formData.set("fileId", crypto.randomUUID());

      try {
        const res = await new Promise<{
          uploadUrl?: string;
          url?: string;
          key?: string;
          name?: string;
          size?: number;
          mimeType?: string | null;
          error?: string;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
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
          xhr.open("POST", "/api/upload/presign");
          xhr.send(formData);
        });

        if (res.error || !res.uploadUrl || !res.url || !res.key) {
          setUploadProgress((p) => {
            const n = { ...p };
            delete n[key];
            return n;
          });
          toast.error(res.error ?? (isArabic ? "فشل الرفع" : "Upload failed"));
          return null;
        }

        onFraction?.(0.08);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              setUploadProgress((p) => ({ ...p, [key]: pct }));
              onFraction?.(0.08 + 0.92 * (ev.loaded / ev.total));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error("Upload failed"));
          });
          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.open("PUT", res.uploadUrl!);
          xhr.setRequestHeader("Content-Type", res.mimeType || file.type || "application/octet-stream");
          xhr.send(file);
        });

        onFraction?.(1);

        setUploadProgress((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });

        const createResult = await createFile({
          name: res.name ?? file.name,
          r2Key: res.key,
          mimeType: res.mimeType ?? null,
          sizeBytes: res.size ?? file.size ?? null,
          clientId: standalone ? null : clientId ?? null,
          projectId: standalone ? null : projectId ?? null,
          folderId: targetFolderId ?? undefined,
        });

        if (createResult.ok && createResult.data) {
          const row = createResult.data;
          const newFile: FileRow = {
            ...row,
            sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
          };
          if (!quiet) {
            toast.success(isArabic ? "تم رفع الملف." : "File uploaded.");
          }
          return newFile;
        }
        const createError =
          !createResult.ok && "_form" in createResult.error && Array.isArray(createResult.error._form)
            ? createResult.error._form[0]
            : null;
        toast.error(
          createError
            ? formatDriveActionError(createError)
            : isArabic
              ? "تعذر حفظ الملف في قاعدة البيانات."
              : "Could not save file in database."
        );
        return null;
      } catch {
        setUploadProgress((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });
        toast.error(isArabic ? "فشل الرفع." : "Upload failed.");
        return null;
      }
    },
    [
      canUpload,
      allowStandaloneRoot,
      formatDriveActionError,
      clientId,
      projectId,
      folders,
      currentFolder,
      standalone,
      driveUploadPathPrefix,
      isArabic,
    ]
  );

  type UploadEntry = { file: globalThis.File; relativePath: string };

  const uploadEntries = React.useCallback(
    async (entries: UploadEntry[], rootFolderId: string | null) => {
      if (!effectiveCanUpload || entries.length === 0) return;
      const hasNested = entries.some((e) => e.relativePath.includes("/"));
      const isBatch = entries.length > 1 || hasNested;

      if (hasNested) {
        setExtractingLabel(isArabic ? "جاري استخراج المجلد..." : "Extracting your folder...");
      }

      const renderBatchToast = (pct: number, doneFiles: number, totalFiles: number) => {
        const p = Math.max(0, Math.min(100, pct));
        toast.custom(
          () => (
            <div className="w-[min(100vw-2rem,22rem)] px-1 py-0.5" dir={isArabic ? "rtl" : "ltr"}>
              <Field className="w-full max-w-none">
                <FieldLabel
                  htmlFor={DRIVE_BATCH_TOAST_ID}
                  className="flex w-full items-center justify-between gap-2"
                >
                  <span className="text-foreground text-sm font-medium">
                    {isArabic ? "جاري رفع الملفات…" : "Uploading files…"}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">{Math.round(p)}%</span>
                </FieldLabel>
                <Progress value={p} id={DRIVE_BATCH_TOAST_ID} className="mt-1.5" />
              </Field>
              {totalFiles > 1 ? (
                <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                  {isArabic ? `${doneFiles} / ${totalFiles} ملف` : `${doneFiles} / ${totalFiles} files`}
                </p>
              ) : null}
            </div>
          ),
          { id: DRIVE_BATCH_TOAST_ID, duration: Infinity }
        );
      };

      try {
        const folderMap = new Map<string, string | null>();
        folderMap.set("", rootFolderId);
        const createdFolders: FolderRow[] = [];

        const allFoldersLookup = (): FolderRow[] => [...folders, ...createdFolders];

        const ensurePath = async (dirPath: string): Promise<string | null> => {
          const normalized = dirPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          if (folderMap.has(normalized)) return folderMap.get(normalized)!;
          const parts = normalized.split("/").filter(Boolean);
          let current = rootFolderId;
          let acc = "";
          for (const p of parts) {
            acc = acc ? `${acc}/${p}` : p;
            if (folderMap.has(acc)) {
              current = folderMap.get(acc)!;
              continue;
            }
            const existing = allFoldersLookup().find((f) => f.parentId === current && f.name === p);
            if (existing) {
              current = existing.id;
              folderMap.set(acc, existing.id);
              continue;
            }
            const created = await createFolderInScope(p, current);
            if (!created) return null;
            current = created.id;
            createdFolders.push(created);
            folderMap.set(acc, created.id);
          }
          return current;
        };

        if (hasNested) {
          const dirPaths = new Set<string>();
          for (const e of entries) {
            if (!e.relativePath.includes("/")) continue;
            const dir = e.relativePath.slice(0, e.relativePath.lastIndexOf("/"));
            if (!dir) continue;
            let acc = "";
            for (const part of dir.split("/").filter(Boolean)) {
              acc = acc ? `${acc}/${part}` : part;
              dirPaths.add(acc);
            }
          }
          const sortedDirs = Array.from(dirPaths).sort(
            (a, b) =>
              a.split("/").length - b.split("/").length ||
              a.localeCompare(b, undefined, { sensitivity: "base" })
          );
          for (const d of sortedDirs) {
            const resolved = await ensurePath(d);
            if (resolved == null) {
              toast.error(isArabic ? "تعذر إنشاء المجلدات." : "Could not create folders.");
              return;
            }
          }
        }

        const base = Date.now();
        const keys = entries.map((e, i) => `${e.file.name}-${e.file.size}-${base}-${i}`);
        const totalFiles = entries.length;
        const weights = entries.map((e) => Math.max(1, e.file.size));
        const sumW = weights.reduce((a, b) => a + b, 0);

        if (isBatch) {
          setUploadQueue([]);
          renderBatchToast(0, 0, totalFiles);
        } else {
          setUploadQueue(keys.map((key, i) => ({ key, name: entries[i]!.relativePath })));
        }

        let completedW = 0;
        let filesDone = 0;
        const inflightFrac = new Map<number, number>();

        const reportOverall = () => {
          if (!isBatch) return;
          let inflightSum = 0;
          for (const [idx, frac] of inflightFrac) {
            inflightSum += weights[idx]! * frac;
          }
          const pct = sumW > 0 ? ((completedW + inflightSum) / sumW) * 100 : 100;
          renderBatchToast(pct, filesDone, totalFiles);
        };

        const results = await mapPool(entries, 3, async (entry, i) => {
          const dir = entry.relativePath.includes("/")
            ? entry.relativePath.slice(0, entry.relativePath.lastIndexOf("/"))
            : "";
          const normalizedDir = dir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          let target: string | null = rootFolderId;
          if (normalizedDir) {
            if (!folderMap.has(normalizedDir)) {
              const resolved = await ensurePath(normalizedDir);
              if (resolved == null) return null;
            }
            target = folderMap.get(normalizedDir) ?? rootFolderId;
          } else {
            target = folderMap.get("") ?? rootFolderId;
          }

          if (isBatch) {
            inflightFrac.set(i, 0);
            reportOverall();
          }

          try {
            const row = await uploadOne(entry.file, keys[i]!, target, {
              quiet: isBatch,
              onFraction: isBatch
                ? (f) => {
                    inflightFrac.set(i, f);
                    reportOverall();
                  }
                : undefined,
            });
            return row;
          } finally {
            if (isBatch) {
              inflightFrac.delete(i);
              completedW += weights[i]!;
              filesDone += 1;
              reportOverall();
            }
          }
        });

        setUploadQueue([]);
        setUploadProgress({});
        if (isBatch) {
          toast.dismiss(DRIVE_BATCH_TOAST_ID);
        }

        const added = results.filter((r): r is FileRow => r != null);
        if (createdFolders.length > 0) {
          setFolders((prev) => {
            const map = new Map(prev.map((f) => [f.id, f]));
            for (const f of createdFolders) map.set(f.id, f);
            return Array.from(map.values());
          });
        }
        if (added.length > 0) {
          setFiles((prev) => [...added, ...prev]);
          router.refresh();
          if (isAgencyStandaloneDrive) void refreshDriveFolderStats();
          if (isBatch) {
            toast.success(
              isArabic
                ? `تم رفع ${added.length} من أصل ${totalFiles} ملفًا`
                : `Uploaded ${added.length} of ${totalFiles} file(s)`
            );
          }
        } else if (isBatch && totalFiles > 0) {
          toast.error(isArabic ? "لم يُرفع أي ملف." : "No files were uploaded.");
        }
      } catch (e) {
        if (isBatch) {
          toast.dismiss(DRIVE_BATCH_TOAST_ID);
        }
        setUploadQueue([]);
        setUploadProgress({});
        throw e;
      } finally {
        if (hasNested) {
          setExtractingLabel(null);
        }
      }
    },
    [
      effectiveCanUpload,
      folders,
      createFolderInScope,
      uploadOne,
      router,
      isArabic,
      isAgencyStandaloneDrive,
      refreshDriveFolderStats,
    ]
  );

  const uploadFiles = React.useCallback(
    async (fileList: globalThis.File[]) => {
      if (!effectiveCanUpload || fileList.length === 0) return;
      await uploadEntries(
        fileList.map((f) => ({
          file: f,
          relativePath: (f as globalThis.File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        })),
        currentFolderId
      );
    },
    [effectiveCanUpload, uploadEntries, currentFolderId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length || !effectiveCanUpload) return;
    void uploadFiles(Array.from(selected));
    e.target.value = "";
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length || !effectiveCanUpload) return;
    void uploadFiles(Array.from(selected));
    e.target.value = "";
  };

  const extractZipEntries = React.useCallback(
    async (zipFile: globalThis.File): Promise<UploadEntry[]> => {
      const zip = await JSZip.loadAsync(zipFile);
      const out: UploadEntry[] = [];
      const root = zipFile.name.replace(/\.zip$/i, "").trim() || "archive";
      for (const [path, obj] of Object.entries(zip.files)) {
        if (obj.dir) continue;
        const clean = path.replace(/^\/+/, "");
        if (!clean) continue;
        const blob = await obj.async("blob");
        const name = clean.split("/").pop() || "file";
        const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
        out.push({ file, relativePath: `${root}/${clean}` });
      }
      return out;
    },
    []
  );

  const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || !effectiveCanUpload) return;
    void (async () => {
      try {
        setExtractingLabel(isArabic ? "جاري استخراج ملف ZIP..." : "Extracting your ZIP...");
        const entries = await extractZipEntries(selected);
        if (entries.length === 0) {
          toast.error(isArabic ? "ملف ZIP فارغ." : "ZIP file is empty.");
          setExtractingLabel(null);
          return;
        }
        await uploadEntries(entries, currentFolderId);
      } catch {
        toast.error(isArabic ? "تعذر فك ملف ZIP." : "Could not extract ZIP.");
      } finally {
        setExtractingLabel(null);
      }
    })();
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
      toast.success(isArabic ? "تم حذف الملف." : "File deleted.");
      router.refresh();
      if (isAgencyStandaloneDrive) void refreshDriveFolderStats();
    } else {
      toast.error(result.error ?? (isArabic ? "فشل الحذف." : "Delete failed."));
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
      toast.success(isArabic ? "تم حذف المجلد." : "Folder deleted.");
      refreshFolders();
      router.refresh();
      if (isAgencyStandaloneDrive) void refreshDriveFolderStats();
    } else {
      toast.error(result.error ?? (isArabic ? "فشل حذف المجلد." : "Delete folder failed."));
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(isArabic ? "تم نسخ الرابط." : "Link copied.");
    } catch {
      toast.error(isArabic ? "تعذر نسخ الرابط." : "Could not copy link.");
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

  const isExternalFileDrag = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types ?? []);
    if (types.includes(DRIVE_FILE_DRAG_MIME)) return false;
    if (types.includes(DRIVE_FOLDER_DRAG_MIME)) return false;
    return types.includes("Files") || types.includes("application/x-moz-file");
  };

  const collectDroppedEntries = React.useCallback(async (dt: DataTransfer): Promise<UploadEntry[]> => {
    const items = Array.from(dt.items ?? []);
    const hasEntryApi = items.some(
      (i) => typeof (i as DataTransferItem & { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry === "function"
    );
    const flatFromFileList = (): UploadEntry[] =>
      Array.from(dt.files ?? []).map((f) => ({
        file: f,
        relativePath: (f as globalThis.File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      }));

    if (!hasEntryApi) {
      return flatFromFileList();
    }

    const readFile = (entry: any): Promise<globalThis.File> =>
      new Promise((resolve, reject) => {
        entry.file((f: globalThis.File) => resolve(f), reject);
      });

    const readDirEntries = (reader: any): Promise<any[]> =>
      new Promise((resolve, reject) => {
        reader.readEntries((entries: any[]) => resolve(entries), reject);
      });

    const walk = async (entry: any, prefix: string): Promise<UploadEntry[]> => {
      if (entry.isFile) {
        const file = await readFile(entry);
        return [{ file, relativePath: `${prefix}${entry.name}` }];
      }
      if (!entry.isDirectory) return [];
      const reader = entry.createReader();
      const all: any[] = [];
      while (true) {
        const batch = await readDirEntries(reader);
        if (batch.length === 0) break;
        all.push(...batch);
      }
      const nested = await Promise.all(all.map((child) => walk(child, `${prefix}${entry.name}/`)));
      return nested.flat();
    };

    const roots = items
      .map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry?.())
      .filter(Boolean);

    if (roots.length === 0) {
      return flatFromFileList();
    }

    const nested = await Promise.all(roots.map((r) => walk(r, "")));
    return nested.flat();
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!effectiveCanUpload) return;
    if (!isExternalFileDrag(e)) return;
    setDragDepth((d) => d + 1);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExternalFileDrag(e)) return;
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (effectiveCanUpload) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    if (!effectiveCanUpload) return;
    if (!isExternalFileDrag(e)) return;
    void (async () => {
      const dropped = await collectDroppedEntries(e.dataTransfer);
      if (dropped.length === 0) return;
      const zip = dropped.length === 1 && /\.zip$/i.test(dropped[0]!.file.name);
      if (zip) {
        try {
          const entries = await extractZipEntries(dropped[0]!.file);
          await uploadEntries(entries, currentFolderId);
        } catch {
          toast.error(isArabic ? "تعذر فك ملف ZIP." : "Could not extract ZIP.");
        }
        return;
      }
      await uploadEntries(dropped, currentFolderId);
    })();
  };

  const handleMoveFileToFolder = React.useCallback(
    async (targetFolderId: string, fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file) return;
      if (file.folderId === targetFolderId) return;
      const res = await moveFile(fileId, targetFolderId);
      if (!res.ok) {
        const msg =
          "_form" in res.error && Array.isArray(res.error._form)
            ? formatDriveActionError(res.error._form[0]!)
            : isArabic
              ? "تعذر نقل الملف."
              : "Could not move file.";
        toast.error(msg);
        return;
      }
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, folderId: targetFolderId } : f)));
      toast.success(isArabic ? "تم نقل الملف." : "File moved.");
      router.refresh();
      if (isAgencyStandaloneDrive) void refreshDriveFolderStats();
    },
    [files, isArabic, router, isAgencyStandaloneDrive, refreshDriveFolderStats, formatDriveActionError]
  );

  const handleMoveFolderToFolder = React.useCallback(
    async (targetFolderId: string, draggedFolderId: string) => {
      if (targetFolderId === draggedFolderId) return;
      const moving = folders.find((f) => f.id === draggedFolderId);
      if (!moving) return;
      if (moving.parentId === targetFolderId) return;
      const subtree = collectSubtreeFolderIds(draggedFolderId, folders);
      if (subtree.has(targetFolderId)) {
        toast.error(
          isArabic ? "لا يمكن نقل المجلد إلى داخل نفسه." : "Cannot move a folder into itself or its children."
        );
        return;
      }
      const res = await moveFolder(draggedFolderId, targetFolderId);
      if (!res.ok) {
        const msg =
          "_form" in res.error && Array.isArray(res.error._form)
            ? formatDriveActionError(res.error._form[0]!)
            : isArabic
              ? "تعذر نقل المجلد."
              : "Could not move folder.";
        toast.error(msg);
        return;
      }
      toast.success(isArabic ? "تم نقل المجلد." : "Folder moved.");
      refreshFolders();
      router.refresh();
      if (isAgencyStandaloneDrive) void refreshDriveFolderStats();
    },
    [
      folders,
      isArabic,
      router,
      refreshFolders,
      isAgencyStandaloneDrive,
      refreshDriveFolderStats,
      formatDriveActionError,
    ]
  );

  const handleCreateFolder = async (input: { name: string; scope: "standalone" | "project"; projectId?: string; accessTeamMemberIds?: string[] }) => {
    const res = standalone
      ? await createFolder({
          name: input.name,
          parentId: currentFolderId,
          ...(currentFolderId
            ? {}
            : input.scope === "project" && input.projectId
              ? { projectId: input.projectId }
              : { standaloneRoot: true as const }),
          ...(input.accessTeamMemberIds && input.accessTeamMemberIds.length > 0
            ? { accessTeamMemberIds: input.accessTeamMemberIds }
            : {}),
        })
      : await createFolder({
          name: input.name,
          parentId: currentFolderId,
          clientId: clientId ?? undefined,
          projectId: projectId ?? undefined,
        });
    if (res.ok && res.data) {
      setFolders((prev) => [...prev, res.data]);
      toast.success(isArabic ? "تم إنشاء المجلد." : "Folder created.");
      router.refresh();
    } else if (!res.ok) {
      const msg =
        "_form" in res.error && Array.isArray(res.error._form)
          ? res.error._form.map(formatDriveActionError).join(", ")
          : isArabic
            ? "فشل إنشاء المجلد."
            : "Create folder failed.";
      toast.error(msg);
    }
  };

  const handleRenameFolder = async (id: string, name: string): Promise<boolean> => {
    const res = await renameFolder(id, name);
    if (res.ok && res.data) {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: res.data!.name } : f)));
      toast.success(isArabic ? "تم تحديث الاسم." : "Name updated.");
      router.refresh();
      return true;
    }
    toast.error(isArabic ? "فشلت إعادة التسمية." : "Rename failed.");
    return false;
  };

  const openFolderAccessFlow = React.useCallback((folder: FolderRow) => {
    if (!canManageFolderAccess) return;
    setAccessFolder(folder);
  }, [canManageFolderAccess]);

  const empty =
    childFoldersFiltered.length === 0 && filesInScope.length === 0 && uploadQueue.length === 0;

  return (
    <div className="flex h-full min-h-0 max-h-full flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:max-h-full lg:flex-row lg:items-stretch">
        <FolderTree
          folders={folders}
          files={files}
          directFileCountByFolderId={directFileCountByFolderIdForTree}
          currentFolderId={currentFolderId}
          onSelectAllFiles={() => navigateToFolder(null)}
          onSelectFolder={(id) => navigateToFolder(id)}
          onCreateFolder={() => setCreateFolderOpen(true)}
          onRenameFolderRequest={(f) => setRenameFolderTarget(f)}
          onDeleteFolderRequest={(f) => setDeleteFolderTarget(f)}
          onFolderAccessRequest={openFolderAccessFlow}
          onFolderShareRequest={(folder) => {
            setShareFolder(folder);
          }}
          onFileDropToFolder={(targetFolderId, fileId) => {
            setDropTargetFolderId(targetFolderId);
            void handleMoveFileToFolder(targetFolderId, fileId).finally(() => {
              setDraggingFileId(null);
              setDropTargetFolderId(null);
            });
          }}
          onFolderDropToFolder={(targetFolderId, draggedFolderId) => {
            setDropTargetFolderId(targetFolderId);
            void handleMoveFolderToFolder(targetFolderId, draggedFolderId).finally(() => {
              setDraggingFolderId(null);
              setDropTargetFolderId(null);
            });
          }}
          dropTargetFolderId={dropTargetFolderId}
          onDropTargetChange={setDropTargetFolderId}
          draggingFolderId={draggingFolderId}
          onDragFolderStart={(folder, e) => {
            setDraggingFolderId(folder.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(DRIVE_FOLDER_DRAG_MIME, folder.id);
          }}
          onDragFolderEnd={() => {
            setDraggingFolderId(null);
            setDropTargetFolderId(null);
          }}
          showFolderUploadMenu={effectiveCanUpload}
          onUploadIntoFolder={(id) => {
            navigateToFolder(id);
            queueMicrotask(() => inputRef.current?.click());
          }}
          canManageFolderAccess={canManageFolderAccess}
          folderAccessCountByFolderId={folderAccessCounts}
          sidebarFooter={sidebarFooter}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Breadcrumb dir={isArabic ? "rtl" : "ltr"}>
              <BreadcrumbList className="flex-wrap">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => navigateToFolder(null)}
                    >
                      {isArabic ? "جميع الملفات" : "All files"}
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c) => (
                  <React.Fragment key={c.id}>
                    <BreadcrumbSeparator>
                      {isArabic ? (
                        <ChevronLeft className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
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
                <Search className="text-muted-foreground pointer-events-none absolute inset-s-2 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isArabic ? "بحث في الأسماء…" : "Search names..."}
                  className="ps-8"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label={isArabic ? "شبكة" : "Grid"}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label={isArabic ? "قائمة" : "List"}
                  onClick={() => setViewMode("list")}
                >
                  <List className="size-4" />
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={isPending}>
                    {isArabic ? "ترتيب" : "Sort"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortKey("name")}>{isArabic ? "حسب الاسم" : "By name"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey("date")}>{isArabic ? "حسب التاريخ" : "By date"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey("size")}>{isArabic ? "حسب الحجم" : "By size"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                className="gap-2"
                disabled={!effectiveCanUpload}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                {isArabic ? "رفع ملف +" : "Upload file +"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!effectiveCanUpload}
                onClick={() => folderInputRef.current?.click()}
              >
                {isArabic ? "رفع مجلد" : "Upload folder"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!effectiveCanUpload}
                onClick={() => zipInputRef.current?.click()}
              >
                {isArabic ? "رفع ZIP" : "Upload ZIP"}
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
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFolderSelect}
            {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <input
            ref={zipInputRef}
            type="file"
            className="hidden"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={handleZipSelect}
          />

          <div
            ref={dropZoneRef}
            className="relative min-h-0 flex-1 overflow-y-auto rounded-lg border border-dashed bg-muted/10 p-3 sm:p-4"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {dragDepth > 0 && effectiveCanUpload ? (
              <div className="bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-primary border-dashed">
                <p className="text-primary font-medium">
                  {isArabic ? "أفلت الملفات أو المجلدات للرفع" : "Drop files or folders to upload"}
                </p>
              </div>
            ) : null}
            {extractingLabel ? (
              <div className="bg-background/80 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="rounded-md border bg-card px-4 py-3 text-sm font-medium shadow">
                  {extractingLabel}
                </div>
              </div>
            ) : null}
            {agencyDriveListLoading && currentFolderId ? (
              <div className="bg-background/50 absolute inset-0 z-18 flex items-center justify-center rounded-lg">
                <p className="text-muted-foreground text-sm font-medium">
                  {isArabic ? "جاري تحميل الملفات…" : "Loading files…"}
                </p>
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
                <p className="text-muted-foreground text-sm">{isArabic ? "لا توجد ملفات أو مجلدات هنا." : "No files or folders here."}</p>
                {effectiveCanUpload ? (
                  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                    <Upload className="me-2 size-4" />
                    {isArabic ? "رفع ملف" : "Upload file"}
                  </Button>
                ) : null}
              </div>
            ) : viewMode === "grid" ? (
              <FileGrid
                childFolders={childFoldersSorted}
                files={filesInScope}
                fileCountByFolderId={fileCountByFolderId}
                folderSizeBytesByFolderId={folderSizeBytesByFolderId}
                folderDisplayDateMsByFolderId={folderDisplayDateMsByFolderId}
                onOpenFolder={(id) => navigateToFolder(id)}
                onRenameFolder={(f) => setRenameFolderTarget(f)}
                onDeleteFolder={(f) => setDeleteFolderTarget(f)}
                onShareFolder={(f) => setShareFolder(f)}
                onAccessFolder={openFolderAccessFlow}
                onOpenFile={setPreviewFile}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDeleteFile={(f) => setDeleteFileTarget({ id: f.id, name: f.name })}
                onShareFile={openShareDialog}
                onDragFileStart={(file, e) => {
                  setDraggingFileId(file.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(DRIVE_FILE_DRAG_MIME, file.id);
                }}
                onDragFileEnd={() => {
                  setDraggingFileId(null);
                  setDropTargetFolderId(null);
                }}
                onDragFolderStart={(folder, e) => {
                  setDraggingFolderId(folder.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(DRIVE_FOLDER_DRAG_MIME, folder.id);
                }}
                onDragFolderEnd={() => {
                  setDraggingFolderId(null);
                  setDropTargetFolderId(null);
                }}
                dropTargetFolderId={dropTargetFolderId}
                onDropTargetChange={setDropTargetFolderId}
                onFileDropToFolder={(targetId, fileId) => {
                  setDropTargetFolderId(targetId);
                  void handleMoveFileToFolder(targetId, fileId).finally(() => {
                    setDraggingFileId(null);
                    setDropTargetFolderId(null);
                  });
                }}
                onFolderDropToFolder={(targetId, draggedId) => {
                  setDropTargetFolderId(targetId);
                  void handleMoveFolderToFolder(targetId, draggedId).finally(() => {
                    setDraggingFolderId(null);
                    setDropTargetFolderId(null);
                  });
                }}
                formatSize={formatSize}
                formatDate={formatDateSafe}
                canManageFolderAccess={canManageFolderAccess}
              />
            ) : (
              <FileListView
                childFolders={childFoldersSorted}
                files={filesInScope}
                fileCountByFolderId={fileCountByFolderId}
                folderSizeBytesByFolderId={folderSizeBytesByFolderId}
                folderDisplayDateMsByFolderId={folderDisplayDateMsByFolderId}
                onOpenFolder={(id) => navigateToFolder(id)}
                onRenameFolder={(f) => setRenameFolderTarget(f)}
                onDeleteFolder={(f) => setDeleteFolderTarget(f)}
                onShareFolder={(f) => setShareFolder(f)}
                onAccessFolder={openFolderAccessFlow}
                onOpenFile={setPreviewFile}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDeleteFile={(f) => setDeleteFileTarget({ id: f.id, name: f.name })}
                onShareFile={openShareDialog}
                onDragFileStart={(file, e) => {
                  setDraggingFileId(file.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(DRIVE_FILE_DRAG_MIME, file.id);
                }}
                onDragFileEnd={() => {
                  setDraggingFileId(null);
                  setDropTargetFolderId(null);
                }}
                onDragFolderStart={(folder, e) => {
                  setDraggingFolderId(folder.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(DRIVE_FOLDER_DRAG_MIME, folder.id);
                }}
                onDragFolderEnd={() => {
                  setDraggingFolderId(null);
                  setDropTargetFolderId(null);
                }}
                dropTargetFolderId={dropTargetFolderId}
                onDropTargetChange={setDropTargetFolderId}
                onFileDropToFolder={(targetId, fileId) => {
                  setDropTargetFolderId(targetId);
                  void handleMoveFileToFolder(targetId, fileId).finally(() => {
                    setDraggingFileId(null);
                    setDropTargetFolderId(null);
                  });
                }}
                onFolderDropToFolder={(targetId, draggedId) => {
                  setDropTargetFolderId(targetId);
                  void handleMoveFolderToFolder(targetId, draggedId).finally(() => {
                    setDraggingFolderId(null);
                    setDropTargetFolderId(null);
                  });
                }}
                formatSize={formatSize}
                formatDate={formatDateSafe}
                canManageFolderAccess={canManageFolderAccess}
              />
            )}
          </div>
        </div>
      </div>
      {draggingFileId || draggingFolderId ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="rounded-md border bg-background/95 px-3 py-2 text-sm shadow">
            {draggingFolderId
              ? isArabic
                ? "أفلِت المجلد فوق مجلد آخر لنقله"
                : "Drop the folder on another folder to move it"
              : isArabic
                ? "أفلِت الملف فوق مجلد لنقله"
                : "Drop the file on a folder to move it"}
          </div>
        </div>
      ) : null}

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
        availableProjects={availableProjects}
        availableTeamMembers={availableTeamMembers}
        allowStandaloneRoot={allowStandaloneRoot}
        onSubmit={handleCreateFolder}
      />

      <RenameFolderDialog
        open={!!renameFolderTarget}
        initialName={renameFolderTarget?.name ?? ""}
        busy={renameFolderBusy}
        onOpenChange={(open) => {
          if (!open) setRenameFolderTarget(null);
        }}
        onSave={async (name) => {
          if (!renameFolderTarget) return;
          setRenameFolderBusy(true);
          try {
            const ok = await handleRenameFolder(renameFolderTarget.id, name);
            if (ok) setRenameFolderTarget(null);
          } finally {
            setRenameFolderBusy(false);
          }
        }}
      />

      <FolderAccessDialog
        open={!!accessFolder}
        onOpenChange={(open) => {
          if (!open) setAccessFolder(null);
        }}
        folder={accessFolder}
        teamMembers={availableTeamMembers}
        isArabic={isArabic}
        formatError={formatDriveActionError}
        onAccessMutated={refreshFolderAccessCounts}
      />

      <Dialog open={!!shareFolder} onOpenChange={(open) => !open && setShareFolder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? "مشاركة المجلد" : "Share folder"}</DialogTitle>
            <DialogDescription className="truncate">{shareFolder?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>{isArabic ? "رابط عام" : "Public link"}</Label>
                <p className="text-muted-foreground text-xs">
                  {isArabic ? "أي شخص يملك الرابط يمكنه العرض فقط." : "Anyone with the link can view only."}
                </p>
              </div>
              <Switch
                checked={Boolean(shareFolder?.isPublic)}
                onCheckedChange={(enabled) => void (async () => {
                  if (!shareFolder) return;
                  setShareBusy(true);
                  const res = await setFolderPublicSharing(shareFolder.id, enabled);
                  setShareBusy(false);
                  if (!res.ok) {
                    const raw = res.error?._form?.[0];
                    toast.error(
                      raw ? formatDriveActionError(raw) : isArabic ? "تعذر تحديث المشاركة." : "Could not update sharing."
                    );
                    return;
                  }
                  setFolders((prev) => prev.map((f) => (f.id === res.data.id ? res.data : f)));
                  setShareFolder(res.data);
                })()}
                disabled={shareBusy}
              />
            </div>
            {shareFolder?.isPublic && shareFolder.shareToken ? (
              <div className="space-y-2">
                <Label>{isArabic ? "رابط المشاركة" : "Share link"}</Label>
                <div className="rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" dir="ltr">
                  {folderSharePageUrl(shareFolder.shareToken)}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(folderSharePageUrl(shareFolder.shareToken!));
                    toast.success(isArabic ? "تم نسخ الرابط." : "Link copied to clipboard.");
                  }}
                >
                  {isArabic ? "نسخ الرابط" : "Copy link"}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFileTarget} onOpenChange={(open) => !open && setDeleteFileTarget(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "حذف ملف" : "Delete file"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic ? "هل تريد حذف هذا الملف؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this file? This action cannot be undone."}
              {deleteFileTarget ? (
                <>
                  <br />
                  <span className="font-medium">{deleteFileTarget.name}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFile}>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFile();
              }}
              disabled={isDeletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFile ? (isArabic ? "جاري الحذف…" : "Deleting...") : isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "حذف مجلد" : "Delete folder"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic ? "هل تريد حذف هذا المجلد وجميع محتوياته؟ سيتم حذف الملفات المرتبطة نهائياً." : "Delete this folder and all its contents? Related files will be permanently removed."}
              {deleteFolderTarget ? (
                <>
                  <br />
                  <span className="font-medium">{deleteFolderTarget.name}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFolder}>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFolder();
              }}
              disabled={isDeletingFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFolder ? (isArabic ? "جاري الحذف…" : "Deleting...") : isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
