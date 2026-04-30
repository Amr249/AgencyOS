"use client";

import { Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FolderCardProps = {
  name: string;
  itemCount: number;
  onOpen: () => void;
  className?: string;
};

export function FolderCard({ name, itemCount, onOpen, className }: FolderCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className={cn(
        "cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex size-14 items-center justify-center rounded-lg">
          <Folder className="size-8" />
        </div>
        <p className="line-clamp-2 w-full text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-muted-foreground text-xs">
          {itemCount} {itemCount === 1 ? "عنصر" : "عناصر"}
        </p>
      </CardContent>
    </Card>
  );
}
