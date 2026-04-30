"use client";

import {
  File,
  FileText,
  FileArchive,
  FileAudio,
  Image as ImageIcon,
  Film,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FileVisualKind =
  | "image"
  | "video"
  | "pdf"
  | "design"
  | "office"
  | "archive"
  | "audio"
  | "generic";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function getFileVisualKind(
  name: string,
  mimeType: string | null | undefined
): FileVisualKind {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = extOf(name);
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv"].includes(ext)) {
    return "video";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["psd", "ai", "fig", "eps", "sketch"].includes(ext)) return "design";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["zip", "rar", "7z"].includes(ext)) return "archive";
  if (mime.startsWith("audio/") || ["mp3", "wav"].includes(ext)) return "audio";
  return "generic";
}

type FileTypeIconProps = {
  name: string;
  mimeType: string | null | undefined;
  className?: string;
  /** When true, renders a compact square for list rows. */
  compact?: boolean;
};

const DESIGN_COLORS: Record<string, string> = {
  psd: "bg-blue-600 text-white",
  ai: "bg-orange-600 text-white",
  fig: "bg-violet-600 text-white",
  eps: "bg-amber-700 text-white",
  sketch: "bg-yellow-500 text-yellow-950",
};

export function FileTypeIcon({ name, mimeType, className, compact }: FileTypeIconProps) {
  const kind = getFileVisualKind(name, mimeType);
  const ext = extOf(name);
  const box = cn(
    "flex shrink-0 items-center justify-center rounded-md font-bold uppercase",
    compact ? "size-9 text-[10px]" : "size-12 text-xs",
    className
  );

  if (kind === "video") {
    return (
      <div className={cn(box, "bg-blue-600 text-white")} aria-hidden>
        <Film className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  if (kind === "pdf") {
    return (
      <div className={cn(box, "bg-red-600 text-white")} aria-hidden>
        <FileText className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  if (kind === "design") {
    const c = DESIGN_COLORS[ext] ?? "bg-slate-600 text-white";
    return (
      <div className={cn(box, c)} aria-hidden>
        {ext.slice(0, 3)}
      </div>
    );
  }
  if (kind === "office") {
    const isSheet = ["xls", "xlsx"].includes(ext);
    return (
      <div
        className={cn(
          box,
          isSheet ? "bg-emerald-600 text-white" : "bg-blue-700 text-white"
        )}
        aria-hidden
      >
        <Presentation className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  if (kind === "archive") {
    return (
      <div className={cn(box, "bg-muted text-muted-foreground")} aria-hidden>
        <FileArchive className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className={cn(box, "bg-purple-600 text-white")} aria-hidden>
        <FileAudio className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  if (kind === "image") {
    return (
      <div className={cn(box, "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200")} aria-hidden>
        <ImageIcon className={compact ? "size-4" : "size-6"} />
      </div>
    );
  }
  return (
    <div className={cn(box, "bg-muted text-muted-foreground")} aria-hidden>
      <File className={compact ? "size-4" : "size-6"} />
    </div>
  );
}
