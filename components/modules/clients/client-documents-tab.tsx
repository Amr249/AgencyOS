"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Eye, Download, Trash2, Plus, FileText } from "lucide-react";

import { createFile, deleteFile } from "@/actions/files";
import {
  FILE_DOCUMENT_TYPES,
  type FileDocumentType,
  type FileRow,
} from "@/lib/file-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilePreviewModal } from "@/components/modules/files/file-preview-modal";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<FileDocumentType, string> = {
  contract: "Contract",
  agreement: "Agreement",
  proposal: "Proposal",
  nda: "NDA",
  other: "Other",
};

const TYPE_ORDER: FileDocumentType[] = ["contract", "agreement", "proposal", "nda", "other"];

const DOC_BADGE: Record<FileDocumentType, string> = {
  contract: "border-blue-200 bg-blue-100 text-blue-800",
  agreement: "border-violet-200 bg-violet-100 text-violet-800",
  proposal: "border-emerald-200 bg-emerald-100 text-emerald-800",
  nda: "border-amber-200 bg-amber-100 text-amber-900",
  other: "border-slate-200 bg-slate-100 text-slate-800",
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
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ClientDocumentsTabProps = {
  clientId: string;
  initialDocuments: FileRow[];
};

export function ClientDocumentsTab({ clientId, initialDocuments }: ClientDocumentsTabProps) {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<FileRow[]>(initialDocuments);
  const [typeFilter, setTypeFilter] = React.useState<"all" | FileDocumentType>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [pickType, setPickType] = React.useState<FileDocumentType>("contract");
  const [description, setDescription] = React.useState("");
  const [pickedFile, setPickedFile] = React.useState<globalThis.File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [previewFile, setPreviewFile] = React.useState<FileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const folder = `agencyos/clients/${clientId}/documents/`;

  React.useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const filtered = React.useMemo(() => {
    const withType = documents.filter((d) => d.documentType != null);
    if (typeFilter === "all") return withType;
    return withType.filter((d) => d.documentType === typeFilter);
  }, [documents, typeFilter]);

  const groupedForAll = React.useMemo(() => {
    if (typeFilter !== "all") return null;
    const map = new Map<FileDocumentType, FileRow[]>();
    for (const t of TYPE_ORDER) map.set(t, []);
    for (const d of filtered) {
      if (d.documentType) map.get(d.documentType)?.push(d);
    }
    return TYPE_ORDER.map((t) => {
      const items = (map.get(t) ?? []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { type: t, items };
    }).filter((g) => g.items.length > 0);
  }, [filtered, typeFilter]);

  const sortedFlat = React.useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filtered]);

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const resetAddForm = () => {
    setPickType("contract");
    setDescription("");
    setPickedFile(null);
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAddDocument = async () => {
    if (!pickedFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.set("file", pickedFile);
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
        toast.error(res.error ?? "Upload failed.");
        setUploading(false);
        return;
      }

      const createResult = await createFile({
        name: res.name ?? pickedFile.name,
        imagekitFileId: res.fileId,
        imagekitUrl: res.url,
        filePath: res.filePath ?? `${folder}${pickedFile.name}`,
        mimeType: res.mimeType ?? null,
        sizeBytes: res.size ?? pickedFile.size ?? null,
        clientId,
        documentType: pickType,
        description: description.trim() ? description.trim() : null,
      });

      if (createResult.ok && createResult.data) {
        const row = createResult.data;
        const newDoc: FileRow = {
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
          documentType: row.documentType ?? null,
          description: row.description ?? null,
          createdAt: row.createdAt,
        };
        setDocuments((prev) => [newDoc, ...prev]);
        toast.success("Document uploaded.");
        setAddOpen(false);
        resetAddForm();
        router.refresh();
      } else {
        toast.error("Failed to save document.");
      }
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const removeId = deleteTarget.id;
    setIsDeleting(true);
    const result = await deleteFile(removeId);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== removeId));
      toast.success("Document deleted.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Delete failed.");
    }
  };

  const renderRow = (d: FileRow) => {
    const dt = d.documentType!;
    return (
      <TableRow key={d.id}>
        <TableCell className="max-w-[200px] font-medium">
          <span className="line-clamp-2" title={d.name}>
            {d.name}
          </span>
          {d.description ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{d.description}</p>
          ) : null}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("text-xs font-medium", DOC_BADGE[dt])}>
            {TYPE_LABELS[dt]}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
          {formatDateSafe(d.createdAt)}
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
          {formatSize(d.sizeBytes)}
        </TableCell>
        <TableCell className="text-end">
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => setPreviewFile(d)}
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => handleDownload(d.imagekitUrl, d.name)}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 gap-1 px-2"
              onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderTable = (rows: FileRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead>Size</TableHead>
          <TableHead className="text-end">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(renderRow)}</TableBody>
    </Table>
  );

  return (
    <div className="space-y-4" dir="ltr" lang="en">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setTypeFilter("all")}
          >
            All
          </Button>
          {FILE_DOCUMENT_TYPES.map((t) => (
            <Button
              key={t}
              type="button"
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setTypeFilter(t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          + Add Document
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-14">
          <FileText className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground text-sm">No documents yet</p>
        </div>
      ) : typeFilter === "all" && groupedForAll ? (
        <div className="space-y-8">
          {groupedForAll.map(({ type, items }) => (
            <div key={type}>
              <h3 className="text-foreground mb-2 text-sm font-semibold tracking-tight">
                {TYPE_LABELS[type]}{" "}
                <span className="text-muted-foreground font-normal">({items.length})</span>
              </h3>
              {renderTable(items)}
            </div>
          ))}
        </div>
      ) : (
        renderTable(sortedFlat)
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetAddForm();
        }}
      >
        <DialogContent className="sm:max-w-md" dir="ltr">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>File</Label>
              <input
                ref={inputRef}
                type="file"
                className="text-muted-foreground w-full text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
                onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select value={pickType} onValueChange={(v) => setPickType(v as FileDocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILE_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Internal notes about this document…"
                rows={3}
                className="resize-none"
              />
            </div>
            {uploading ? (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-muted-foreground text-xs">Uploading…</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddDocument} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreviewModal
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        onDeleteRequest={(f) => {
          setPreviewFile(null);
          setDeleteTarget({ id: f.id, name: f.name });
        }}
        onDownload={handleDownload}
        onCopyLink={async (url) => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied.");
          } catch {
            toast.error("Failed to copy link.");
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTarget?.name}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
