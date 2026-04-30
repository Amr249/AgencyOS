"use client";

import { Folder, Pencil, Share2, Trash2, Users } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FolderRow } from "@/actions/folders";
import { cn } from "@/lib/utils";

type FolderCardProps = {
  folder: FolderRow;
  itemCount: number;
  totalBytes: number;
  displayDateMs: number;
  onOpen: () => void;
  onRename: (folder: FolderRow) => void;
  onDelete: (folder: FolderRow) => void;
  onShare: (folder: FolderRow) => void;
  onAccess: (folder: FolderRow) => void;
  formatSize: (n: number | null | undefined) => string;
  formatDate: (d: Date | string | null | undefined) => string;
  className?: string;
};

export function FolderCard({
  folder,
  itemCount,
  totalBytes,
  displayDateMs,
  onOpen,
  onRename,
  onDelete,
  onShare,
  onAccess,
  formatSize,
  formatDate,
  className,
}: FolderCardProps) {
  const isArabic = useLocale() === "ar";
  const dateLabel = formatDate(new Date(displayDateMs));

  return (
    <Card
      role="button"
      tabIndex={0}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="relative mx-auto w-full max-w-[200px]">
          <div className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex h-[120px] w-full items-center justify-center rounded-lg border-b">
            <Folder className="size-14 opacity-90" />
          </div>
          <div className="absolute inset-0 flex flex-nowrap items-center justify-center gap-1 bg-black/55 px-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-9 shrink-0"
              aria-label={isArabic ? "مشاركة" : "Share"}
              onClick={(e) => {
                e.stopPropagation();
                onShare(folder);
              }}
            >
              <Share2 className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-9 shrink-0"
              aria-label={isArabic ? "صلاحيات" : "Access"}
              onClick={(e) => {
                e.stopPropagation();
                onAccess(folder);
              }}
            >
              <Users className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-9 shrink-0"
              aria-label={isArabic ? "إعادة تسمية" : "Rename"}
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-9 shrink-0"
              aria-label={isArabic ? "حذف" : "Delete"}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <p className="line-clamp-2 w-full text-sm font-medium" title={folder.name}>
          {folder.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {itemCount} {isArabic ? (itemCount === 1 ? "عنصر" : "عناصر") : itemCount === 1 ? "item" : "items"}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatSize(totalBytes)} · {dateLabel}
        </p>
      </CardContent>
    </Card>
  );
}
