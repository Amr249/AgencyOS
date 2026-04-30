"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type RenameFolderDialogProps = {
  open: boolean;
  initialName: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void | Promise<void>;
};

export function RenameFolderDialog({
  open,
  initialName,
  busy = false,
  onOpenChange,
  onSave,
}: RenameFolderDialogProps) {
  const isArabic = useLocale() === "ar";
  const [value, setValue] = React.useState(initialName);

  React.useEffect(() => {
    if (open) setValue(initialName);
  }, [open, initialName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isArabic ? "إعادة تسمية المجلد" : "Rename folder"}</DialogTitle>
        </DialogHeader>
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus disabled={busy} />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={busy || !value.trim()}
            onClick={() => void onSave(value.trim())}
          >
            {busy ? (isArabic ? "جاري الحفظ…" : "Saving...") : isArabic ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
