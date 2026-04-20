"use client";

import * as React from "react";
import Image from "next/image";
import { format } from "date-fns";
import { enUS, arSA } from "date-fns/locale";
import { toast } from "sonner";
import { Upload, Download, Trash2, Paperclip, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { createFile, deleteFile, getFiles } from "@/actions/files";
import type { FileRow } from "@/lib/file-types";
import { cn } from "@/lib/utils";

const EN = {
  title: "Attachments",
  upload: "Upload",
  uploading: "Uploading…",
  empty: "No attachments yet. Upload files or images with an optional note.",
  notePlaceholder: "Optional note about this file",
  sendUploads: "Upload files",
  clear: "Clear",
  download: "Download",
  delete: "Delete",
  preview: "Preview",
  by: "by",
  deleteTitle: "Delete attachment",
  deleteBody: (name: string) =>
    `Remove ${name} from this task? The file will be deleted from storage and cannot be undone.`,
  cancel: "Cancel",
  deleting: "Deleting…",
  uploadFailed: "Upload failed. Please try again.",
  uploaded: "Attachment uploaded.",
  deleted: "Attachment removed.",
  deleteFailed: "Delete failed.",
  saveFailed: "Failed to save file record.",
  loadFailed: "Could not load attachments.",
  selected: (n: number) => `${n} file(s) selected`,
};

const AR = {
  title: "المرفقات",
  upload: "إرفاق",
  uploading: "جاري الرفع…",
  empty: "لا توجد مرفقات بعد. ارفع ملفات أو صوراً مع ملاحظة اختيارية.",
  notePlaceholder: "ملاحظة اختيارية عن هذا الملف",
  sendUploads: "رفع الملفات",
  clear: "مسح",
  download: "تنزيل",
  delete: "حذف",
  preview: "معاينة",
  by: "بواسطة",
  deleteTitle: "حذف المرفق",
  deleteBody: (name: string) =>
    `إزالة ${name} من هذه المهمة؟ سيتم حذف الملف من التخزين ولا يمكن التراجع.`,
  cancel: "إلغاء",
  deleting: "جاري الحذف…",
  uploadFailed: "فشل الرفع. حاول مرة أخرى.",
  uploaded: "تم رفع المرفق.",
  deleted: "تم حذف المرفق.",
  deleteFailed: "فشل الحذف.",
  saveFailed: "تعذر حفظ سجل الملف.",
  loadFailed: "تعذر تحميل المرفقات.",
  selected: (n: number) => `تم اختيار ${n} ملف`,
};

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateSafe(value: Date | string | null | undefined, ar: boolean): string {
  if (value == null) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return format(date, "dd/MM/yyyy HH:mm", { locale: ar ? arSA : enUS });
  } catch {
    return "—";
  }
}

function isImage(f: Pick<FileRow, "mimeType" | "name">): boolean {
  const mime = f.mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f.name);
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

type PendingUpload = {
  key: string;
  file: globalThis.File;
  note: string;
};

export type TaskAttachmentsProps = {
  taskId: string;
  /** When true, render RTL Arabic labels. */
  memberView?: boolean;
  /** Whether the current user can upload new attachments. */
  canUpload: boolean;
  /** Admins can delete any attachment. */
  canDeleteAny: boolean;
  /** `users.id` of the signed-in user. Needed to decide delete eligibility for non-admins. */
  currentUserId: string | null;
};

export function TaskAttachments({
  taskId,
  memberView = false,
  canUpload,
  canDeleteAny,
  currentUserId,
}: TaskAttachmentsProps) {
  const L = memberView ? AR : EN;
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [activeFileName, setActiveFileName] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<FileRow | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const res = await getFiles({ taskId });
    setLoading(false);
    if (res.ok) {
      setFiles(res.data);
    } else {
      toast.error(res.error ?? L.loadFailed);
    }
  }, [taskId, L.loadFailed]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const added: PendingUpload[] = Array.from(list).map((f) => ({
      key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      note: "",
    }));
    setPending((prev) => [...prev, ...added]);
    e.target.value = "";
  };

  const removePending = (key: string) => {
    setPending((prev) => prev.filter((p) => p.key !== key));
  };

  const updatePendingNote = (key: string, note: string) => {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, note } : p)));
  };

  const uploadOne = async (item: PendingUpload): Promise<boolean> => {
    setActiveFileName(item.file.name);
    setUploadProgress(0);
    const folder = `agencyos/tasks/${taskId}`;
    const formData = new FormData();
    formData.set("file", item.file);
    formData.set("scope", "task-attachment");
    formData.set("taskId", taskId);
    formData.set("folder", folder);

    try {
      const res = await new Promise<{
        url?: string;
        fileId?: string;
        name?: string;
        size?: number;
        mimeType?: string | null;
        filePath?: string;
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
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

      if (res.error || !res.url || !res.fileId) {
        toast.error(res.error ?? L.uploadFailed);
        return false;
      }

      const createResult = await createFile({
        name: res.name ?? item.file.name,
        imagekitFileId: res.fileId,
        imagekitUrl: res.url,
        filePath: res.filePath ?? `${folder}/${item.file.name}`,
        mimeType: res.mimeType ?? null,
        sizeBytes: res.size ?? item.file.size ?? null,
        taskId,
        description: item.note.trim() || null,
      });

      if (!createResult.ok) {
        const err = createResult.error as Record<string, string[] | undefined>;
        const msg = err?._form?.[0] ?? L.saveFailed;
        toast.error(msg);
        return false;
      }
      setFiles((prev) => [createResult.data, ...prev]);
      return true;
    } catch {
      toast.error(L.uploadFailed);
      return false;
    }
  };

  const runUploads = async () => {
    if (pending.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const item of pending) {
      const ok = await uploadOne(item);
      if (ok) successCount += 1;
    }
    setUploading(false);
    setUploadProgress(0);
    setActiveFileName(null);
    setPending([]);
    if (successCount > 0) toast.success(L.uploaded);
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setIsDeleting(true);
    const result = await deleteFile(id);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success(L.deleted);
    } else {
      toast.error(result.error ?? L.deleteFailed);
    }
  };

  const canDeleteFile = (f: FileRow): boolean => {
    if (canDeleteAny) return true;
    if (!currentUserId) return false;
    return f.uploadedBy === currentUserId;
  };

  const dir = memberView ? "rtl" : "ltr";
  const align = memberView ? "text-right" : "text-left";

  return (
    <div className={cn("space-y-3", align)} dir={dir}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          <span>{L.title}</span>
          {files.length > 0 ? (
            <span className="text-muted-foreground/80">({files.length})</span>
          ) : null}
        </div>
        {canUpload ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {L.upload}
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleSelect}
            />
          </>
        ) : null}
      </div>

      {pending.length > 0 ? (
        <div className="bg-muted/20 space-y-3 rounded-md border p-3">
          <div className="text-muted-foreground text-xs">{L.selected(pending.length)}</div>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.key} className="bg-background space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={p.file.name}>
                      {p.file.name}
                    </p>
                    <p className="text-muted-foreground text-xs">{formatSize(p.file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removePending(p.key)}
                    disabled={uploading}
                    aria-label={L.clear}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={p.note}
                  onChange={(e) => updatePendingNote(p.key, e.target.value)}
                  placeholder={L.notePlaceholder}
                  disabled={uploading}
                  dir={dir}
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPending([])}
              disabled={uploading}
            >
              {L.clear}
            </Button>
            <Button type="button" size="sm" onClick={() => void runUploads()} disabled={uploading}>
              {uploading ? L.uploading : L.sendUploads}
            </Button>
          </div>
          {uploading ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">
                {activeFileName ? `${L.uploading} ${activeFileName}` : L.uploading}
              </p>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">…</p>
      ) : files.length === 0 && pending.length === 0 ? (
        <p className="text-muted-foreground text-sm">{L.empty}</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const img = isImage(f);
            return (
              <li
                key={f.id}
                className="bg-card flex items-start gap-3 rounded-md border p-2.5"
              >
                <div className="bg-muted shrink-0 overflow-hidden rounded-md">
                  {img ? (
                    <button
                      type="button"
                      className="block h-16 w-16 cursor-zoom-in"
                      onClick={() => setPreviewImage(f)}
                      aria-label={L.preview}
                    >
                      <Image
                        src={f.imagekitUrl}
                        alt={f.name}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center">
                      <FileText className="text-muted-foreground h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium" title={f.name}>
                      {f.name}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownload(f.imagekitUrl, f.name)}
                        title={L.download}
                        aria-label={L.download}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDeleteFile(f) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                          title={L.delete}
                          aria-label={L.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {f.description ? (
                    <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                      {f.description}
                    </p>
                  ) : null}
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span>{formatSize(f.sizeBytes)}</span>
                    <span>·</span>
                    <span>{formatDateSafe(f.createdAt, memberView)}</span>
                    {f.uploadedByName ? (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <Avatar className="h-4 w-4">
                            {f.uploadedByAvatarUrl ? (
                              <AvatarImage src={f.uploadedByAvatarUrl} alt={f.uploadedByName} />
                            ) : null}
                            <AvatarFallback className="text-[9px]">
                              {initialsOf(f.uploadedByName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {L.by} {f.uploadedByName}
                          </span>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? L.deleteBody(deleteTarget.name) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel type="button" disabled={isDeleting}>
              {L.cancel}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? L.deleting : L.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewImage ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-background relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-md p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium" title={previewImage.name}>
                {previewImage.name}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setPreviewImage(null)}
                aria-label={L.cancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Image
              src={previewImage.imagekitUrl}
              alt={previewImage.name}
              width={1200}
              height={900}
              unoptimized
              className="h-auto max-h-[75vh] w-auto max-w-[85vw] rounded"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
