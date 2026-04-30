"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FileRow } from "@/lib/file-types";
import { sharePageUrl } from "@/lib/public-app-url";
import { toggleFilePublic, revokeShareLink, setShareLinkExpiryDays } from "@/actions/files";
import { Copy, Link2, Share2 } from "lucide-react";

type ExpiryChoice = "unlimited" | "7" | "30" | "90";

function expiryChoiceFromFile(file: FileRow): ExpiryChoice {
  if (!file.shareExpiresAt) return "unlimited";
  const exp = new Date(file.shareExpiresAt).getTime();
  const now = Date.now();
  if (exp <= now) return "unlimited";
  const days = Math.round((exp - now) / (24 * 60 * 60 * 1000));
  if (days <= 8) return "7";
  if (days <= 35) return "30";
  return "90";
}

function patchFromDbRow(row: {
  id: string;
  isPublic: boolean;
  shareToken: string | null;
  shareExpiresAt: Date | null;
}): Pick<FileRow, "id" | "isPublic" | "shareToken" | "shareExpiresAt"> {
  return {
    id: row.id,
    isPublic: row.isPublic,
    shareToken: row.shareToken,
    shareExpiresAt: row.shareExpiresAt,
  };
}

type FileShareDialogProps = {
  file: FileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUpdated: (patch: Pick<FileRow, "id" | "isPublic" | "shareToken" | "shareExpiresAt">) => void;
};

export function FileShareDialog({ file, open, onOpenChange, onFileUpdated }: FileShareDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const [expiryChoice, setExpiryChoice] = React.useState<ExpiryChoice>("unlimited");

  React.useEffect(() => {
    if (file && open) {
      setExpiryChoice(expiryChoiceFromFile(file));
    }
  }, [file, open]);

  const shareUrl =
    file?.shareToken && file.isPublic ? sharePageUrl(file.shareToken) : "";

  const qrSrc =
    shareUrl.length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`
      : null;

  const handlePublicToggle = async (next: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await toggleFilePublic(file.id);
      if (res.ok && res.data) {
        onFileUpdated(patchFromDbRow(res.data));
        toast.success(next ? "تم تفعيل الرابط العام" : "تم إيقاف المشاركة");
      } else if (!res.ok) {
        const msg =
          "_form" in res.error && Array.isArray(res.error._form)
            ? res.error._form.join(", ")
            : "تعذر التحديث";
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const applyExpiry = async (choice: ExpiryChoice) => {
    if (!file?.isPublic || !file.shareToken) return;
    setBusy(true);
    try {
      const days = choice === "unlimited" ? null : Number(choice);
      const res = await setShareLinkExpiryDays(file.id, days);
      if (res.ok && res.data) {
        onFileUpdated(patchFromDbRow(res.data));
        toast.success("تم تحديث مدة الصلاحية");
      } else if (!res.ok) {
        const msg =
          "_form" in res.error && Array.isArray(res.error._form)
            ? res.error._form.join(", ")
            : "تعذر الحفظ";
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await revokeShareLink(file.id);
      if (res.ok && res.data) {
        onFileUpdated(patchFromDbRow(res.data));
        toast.success("تم إلغاء المشاركة");
      } else if (!res.ok) {
        const msg =
          "_form" in res.error && Array.isArray(res.error._form)
            ? res.error._form.join(", ")
            : "تعذر الإلغاء";
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("تم نسخ رابط المشاركة");
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            مشاركة الملف
          </DialogTitle>
          <DialogDescription className="truncate" title={file.name}>
            {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="share-public">رابط عام</Label>
              <p className="text-muted-foreground text-xs">يسمح لأي شخص يملك الرابط بعرض الملف</p>
            </div>
            <Switch
              id="share-public"
              checked={Boolean(file.isPublic && file.shareToken)}
              disabled={busy}
              onCheckedChange={(v) => void handlePublicToggle(v)}
            />
          </div>

          {file.isPublic && file.shareToken ? (
            <>
              <div className="space-y-2">
                <Label>صلاحية الرابط</Label>
                <Select
                  value={expiryChoice}
                  disabled={busy}
                  onValueChange={(v) => {
                    const c = v as ExpiryChoice;
                    setExpiryChoice(c);
                    void applyExpiry(c);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">بدون انتهاء</SelectItem>
                    <SelectItem value="7">7 أيام</SelectItem>
                    <SelectItem value="30">30 يوماً</SelectItem>
                    <SelectItem value="90">90 يوماً</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>رابط المشاركة</Label>
                <div className="bg-muted flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <Link2 className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" dir="ltr">
                    {shareUrl}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={copyShare}>
                    <Copy className="size-3.5" />
                    نسخ الرابط
                  </Button>
                </div>
              </div>

              {qrSrc ? (
                <div className="flex flex-col items-center gap-2">
                  <Label>رمز QR</Label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="" width={140} height={140} className="rounded-md border bg-white p-1" />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {file.isPublic && file.shareToken ? (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleRevoke()}>
              إلغاء المشاركة
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
