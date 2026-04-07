"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";
import { Upload, Download, Trash2, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { createFile, deleteFile, type FileRow } from "@/actions/files";

function formatDateSafe(value: Date | string | null | undefined): string {
  if (value == null) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return format(date, "dd/MM/yyyy HH:mm", { locale: enUS });
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

function isPdfFile(f: FileRow): boolean {
  const mime = f.mimeType?.toLowerCase() ?? "";
  if (mime.includes("pdf")) return true;
  return f.name.toLowerCase().endsWith(".pdf");
}

type InvoiceAttachmentsProps = {
  invoiceId: string;
  initialFiles: FileRow[];
};

export function InvoiceAttachments({ invoiceId, initialFiles }: InvoiceAttachmentsProps) {
  const router = useRouter();
  const [files, setFiles] = React.useState<FileRow[]>(initialFiles);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pdfPreview, setPdfPreview] = React.useState<FileRow | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pdfFiles = React.useMemo(() => files.filter(isPdfFile), [files]);
  const otherFiles = React.useMemo(() => files.filter((f) => !isPdfFile(f)), [files]);

  const folder = `agencyos/invoices/${invoiceId}`;

  React.useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const uploadOne = async (file: globalThis.File) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("scope", "invoice-attachment");
    formData.set("invoiceId", invoiceId);
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

      setUploading(false);
      setUploadProgress(0);

      if (res.error || !res.url || !res.fileId) {
        toast.error(res.error ?? "Upload failed. Please try again.");
        return;
      }

      const createResult = await createFile({
        name: res.name ?? file.name,
        imagekitFileId: res.fileId,
        imagekitUrl: res.url,
        filePath: res.filePath ?? `${folder}/${file.name}`,
        mimeType: res.mimeType ?? null,
        sizeBytes: res.size ?? file.size ?? null,
        invoiceId,
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
          invoiceId: row.invoiceId,
          expenseId: row.expenseId,
          createdAt: row.createdAt,
        };
        setFiles((prev) => [newFile, ...prev]);
        toast.success("File uploaded.");
        router.refresh();
        return;
      }
      toast.error("Failed to save file record.");
    } catch {
      setUploading(false);
      setUploadProgress(0);
      toast.error("Upload failed. Please try again.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    void (async () => {
      for (const file of Array.from(list)) {
        await uploadOne(file);
      }
    })();
    e.target.value = "";
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
      toast.success("Attachment removed.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Delete failed.");
    }
  };

  return (
    <>
      <Card dir="ltr" className="text-left">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            Attachments
          </CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload file
          </Button>
          <input ref={inputRef} type="file" className="hidden" multiple onChange={handleFileSelect} />
        </CardHeader>
        <CardContent className="space-y-4">
          {uploading ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Uploading…</p>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : null}

          {files.length === 0 && !uploading ? (
            <p className="text-muted-foreground text-sm">
              No attachments yet. Upload PDFs, receipts, or images linked to this invoice.
            </p>
          ) : (
            <div className="space-y-8">
              {pdfFiles.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-3 text-sm">PDF documents — click a card to preview</p>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pdfFiles.map((f) => (
                      <li key={f.id}>
                        <div className="bg-card overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
                          <div
                            role="button"
                            tabIndex={0}
                            className="hover:bg-muted/30 focus-visible:ring-ring block w-full cursor-pointer p-4 pb-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            onClick={() => setPdfPreview(f)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setPdfPreview(f);
                              }
                            }}
                          >
                            <div className="bg-muted/40 flex aspect-4/3 items-center justify-center rounded-lg border border-dashed">
                              <FileText
                                className="text-primary h-14 w-14 opacity-80"
                                aria-hidden
                              />
                            </div>
                            <p className="mt-3 truncate font-medium" title={f.name}>
                              {f.name}
                            </p>
                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center justify-between gap-1 text-xs">
                              <span>{formatSize(f.sizeBytes)}</span>
                              <span>{formatDateSafe(f.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1 border-t px-4 py-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              onClick={() => handleDownload(f.imagekitUrl, f.name)}
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">Download</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-8 px-2"
                              onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {otherFiles.length > 0 ? (
                <div>
                  {pdfFiles.length > 0 ? (
                    <p className="text-muted-foreground mb-3 text-sm">Other attachments</p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[100px]">Size</TableHead>
                        <TableHead className="w-[160px]">Uploaded</TableHead>
                        <TableHead className="w-[140px] text-end">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otherFiles.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="max-w-[240px] truncate font-medium" title={f.name}>
                            {f.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatSize(f.sizeBytes)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDateSafe(f.createdAt)}</TableCell>
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownload(f.imagekitUrl, f.name)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive h-8 w-8"
                                onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pdfPreview} onOpenChange={(open) => !open && setPdfPreview(null)}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90dvh,900px)] w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,56rem)]"
        >
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-12 text-left">
            <DialogTitle className="truncate text-base font-semibold leading-tight">
              {pdfPreview?.name ?? "PDF preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/20 min-h-0 flex-1">
            {pdfPreview ? (
              <iframe
                src={pdfPreview.imagekitUrl}
                title={pdfPreview.name}
                className="h-[min(70dvh,780px)] w-full border-0 bg-white"
              />
            ) : null}
          </div>
          {pdfPreview ? (
            <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
              <span>Preview loads in the browser; use Download on the card if you need a local copy.</span>
              <a
                href={pdfPreview.imagekitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary shrink-0 font-medium underline-offset-4 hover:underline"
              >
                Open in new tab
              </a>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteTarget?.name} from this invoice? The file will be deleted from storage and cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel type="button" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
