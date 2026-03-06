"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Upload, FileText, File, Download, Copy, Trash2, FolderOpen } from "lucide-react";
import { getFiles, createFile, deleteFile, type FileRow } from "@/actions/files";
import { FilePreviewModal } from "@/components/modules/files/file-preview-modal";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function formatDateSafe(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return format(date, "dd/MM/yyyy", { locale: ar });
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

function isImage(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

function isPdf(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime === "application/pdf" || mime.toLowerCase().endsWith("pdf");
}

type FileManagerProps = {
  clientId?: string;
  projectId?: string;
  initialFiles: FileRow[];
};

export function FileManager({ clientId, projectId, initialFiles }: FileManagerProps) {
  const router = useRouter();
  const [files, setFiles] = React.useState<FileRow[]>(initialFiles);
  const [uploading, setUploading] = React.useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = React.useState<FileRow | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const folder = clientId
    ? `agencyos/clients/${clientId}/`
    : projectId
      ? `agencyos/projects/${projectId}/`
      : null;

  React.useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length || !folder) return;
    uploadFiles(Array.from(selected));
    e.target.value = "";
  };

  const uploadOne = async (file: globalThis.File, key: string): Promise<FileRow | null> => {
    if (!folder) return null;
    setUploading((prev) => new Set(prev).add(key));
    setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", folder);

    try {
      const res = await new Promise<{ url?: string; fileId?: string; name?: string; size?: number; mimeType?: string | null; filePath?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress((p) => ({ ...p, [key]: Math.round((ev.loaded / ev.total) * 100) }));
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

      setUploading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setUploadProgress((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });

      if (res.error || !res.url || !res.fileId) {
        toast.error("فشل رفع الملف. حاول مرة أخرى.");
        return null;
      }

      const createResult = await createFile({
        name: res.name ?? file.name,
        imagekitFileId: res.fileId,
        imagekitUrl: res.url,
        filePath: res.filePath ?? `${folder}${file.name}`,
        mimeType: res.mimeType ?? null,
        sizeBytes: res.size ?? file.size ?? null,
        clientId: clientId ?? null,
        projectId: projectId ?? null,
      });

      if (createResult.ok && createResult.data) {
        const row = createResult.data;
        const newFile: FileRow = {
          id: row.id,
          name: row.name,
          imagekitFileId: row.imagekitFileId,
          imagekitUrl: row.imagekitUrl,
          filePath: row.filePath,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
          clientId: row.clientId,
          projectId: row.projectId,
          createdAt: row.createdAt,
        };
        toast.success("تم رفع الملف بنجاح");
        return newFile;
      }
      toast.error("فشل حفظ الملف في القاعدة.");
      return null;
    } catch {
      setUploading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setUploadProgress((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      toast.error("فشل رفع الملف. حاول مرة أخرى.");
      return null;
    }
  };

  const uploadFiles = async (fileList: globalThis.File[]) => {
    if (!folder) return;
    const keys = fileList.map((f, i) => `${f.name}-${f.size}-${Date.now()}-${i}`);
    const results = await Promise.all(fileList.map((file, i) => uploadOne(file, keys[i])));
    const added = results.filter((r): r is FileRow => r != null);
    if (added.length > 0) {
      setFiles((prev) => [...added, ...prev]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!folder) return;
    const items = e.dataTransfer.files;
    if (items?.length) uploadFiles(Array.from(items));
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteFile(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      toast.success("تم حذف الملف");
      router.refresh();
    } else {
      toast.error(result.error ?? "فشل الحذف");
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("فشل نسخ الرابط");
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

  const thumbUrl = (f: FileRow) => {
    if (isImage(f.mimeType)) return `${f.imagekitUrl}?tr=w-200,h-150,c-at_max`;
    return null;
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">الملفات</h2>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={!folder}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          رفع ملف +
        </Button>
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
        role="button"
        tabIndex={0}
        className="border-border bg-muted/20 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/40"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <p className="text-muted-foreground text-sm">
          اسحب الملفات هنا أو انقر للاختيار
        </p>
      </div>

      {/* Uploading placeholders */}
      {Array.from(uploading).map((key) => (
        <Card key={key} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="bg-muted h-[100px] w-[140px] shrink-0 rounded animate-pulse" />
              <div className="min-w-0 flex-1 text-right">
                <p className="text-muted-foreground truncate text-sm">جاري الرفع…</p>
                <Progress value={uploadProgress[key] ?? 0} className="mt-2 h-2 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {files.length === 0 && uploading.size === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/20 py-12">
          <FolderOpen className="text-muted-foreground h-12 w-12" />
          <p className="text-muted-foreground text-sm">
            لا توجد ملفات بعد. ارفع أول ملف.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {files.map((f) => {
            const thumb = thumbUrl(f);
            return (
              <Card
                key={f.id}
                role="button"
                tabIndex={0}
                className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                onClick={() => setPreviewFile(f)}
                onKeyDown={(e) => e.key === "Enter" && setPreviewFile(f)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-[4/3] bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : isPdf(f.mimeType) ? (
                      <div className="flex h-full w-full items-center justify-center bg-red-50 dark:bg-red-950/30">
                        <FileText className="text-red-600 h-12 w-12" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <File className="text-muted-foreground h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(f.imagekitUrl, f.name);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        تحميل
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(f.imagekitUrl);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        نسخ الرابط
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: f.id, name: f.name });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 text-right">
                    <p className="truncate text-sm font-medium" title={f.name}>
                      {f.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatSize(f.sizeBytes)} · {formatDateSafe(f.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FilePreviewModal
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        onDeleteRequest={(f) => {
          setPreviewFile(null);
          setDeleteTarget({ id: f.id, name: f.name });
        }}
        onDownload={handleDownload}
        onCopyLink={handleCopyLink}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الملف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف {deleteTarget?.name}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "جاري الحذف…" : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
