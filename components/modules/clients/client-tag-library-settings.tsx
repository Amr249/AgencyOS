"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createTag, deleteTag, updateTag } from "@/actions/client-tags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CLIENT_TAG_COLOR_OPTIONS } from "@/lib/client-metadata";
import type { clientTags } from "@/lib/db/schema";

type TagRow = typeof clientTags.$inferSelect;

export function ClientTagLibrarySettings({ initialTags }: { initialTags: TagRow[] }) {
  const router = useRouter();
  const t = useTranslations("settings.clientTags");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";
  const fieldAlign = pageDir === "rtl" ? "text-end" : "text-start";

  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>("blue");
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [pendingColorById, setPendingColorById] = React.useState<Record<string, string>>({});

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("toastNameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await createTag({ name: trimmed, color: color as "blue" | "green" | "red" | "purple" | "orange" | "gray" });
      if (res.ok) {
        toast.success(t("toastCreated"));
        setName("");
        setColor("blue");
        router.refresh();
      } else {
        const err = res.error;
        const msg =
          typeof err === "string"
            ? err
            : "name" in err && err.name?.[0]
              ? err.name[0]
              : t("toastCreateFailed");
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onColorChange(tagId: string, nextColor: string) {
    setPendingColorById((p) => ({ ...p, [tagId]: nextColor }));
    const res = await updateTag({
      id: tagId,
      color: nextColor as "blue" | "green" | "red" | "purple" | "orange" | "gray",
    });
    setPendingColorById((p) => {
      const { [tagId]: _, ...rest } = p;
      return rest;
    });
    if (res.ok) {
      toast.success(t("toastUpdated"));
      router.refresh();
    } else {
      const err = res.error;
      const msg =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && "_form" in err && Array.isArray((err as { _form?: string[] })._form)
            ? (err as { _form: string[] })._form[0]
            : t("toastUpdateFailed");
      toast.error(msg);
    }
  }

  return (
    <>
      <Card dir={pageDir}>
        <CardHeader className={fieldAlign}>
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className={`grid min-w-[160px] flex-1 gap-1.5 ${fieldAlign}`}>
              <Label htmlFor="new-tag-name">{t("newTagName")}</Label>
              <Input
                id="new-tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                maxLength={120}
                className={fieldAlign}
              />
            </div>
            <div className={`grid w-36 gap-1.5 ${fieldAlign}`}>
              <Label>{t("color")}</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className={fieldAlign}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={pageDir}>
                  {CLIENT_TAG_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("adding") : t("addTag")}
            </Button>
          </form>

          <div className={`space-y-2 ${fieldAlign}`}>
            <Label>{t("existingTags")}</Label>
            {initialTags.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noTagsYet")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {initialTags.map((tag) => (
                  <li
                    key={tag.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${pageDir === "rtl" ? "flex-row-reverse" : ""}`}
                  >
                    <span className="text-sm font-medium">{tag.name}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={tag.color}
                        disabled={!!pendingColorById[tag.id]}
                        onValueChange={(v) => onColorChange(tag.id, v)}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir={pageDir}>
                          {CLIENT_TAG_COLOR_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("deleteAriaLabel", { name: tag.name })}
                        onClick={() => setDeleteId(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir={pageDir}>
          <AlertDialogHeader className={fieldAlign}>
            <AlertDialogTitle>{t("deleteTagTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteTagDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={pageDir === "rtl" ? "sm:flex-row-reverse sm:justify-start" : undefined}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                const res = await deleteTag(deleteId);
                setDeleteId(null);
                if (res.ok) {
                  toast.success(t("toastDeleted"));
                  router.refresh();
                } else {
                  toast.error(typeof res.error === "string" ? res.error : t("toastDeleteFailed"));
                }
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
