"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>("blue");
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [pendingColorById, setPendingColorById] = React.useState<Record<string, string>>({});

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Tag name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await createTag({ name: trimmed, color: color as "blue" | "green" | "red" | "purple" | "orange" | "gray" });
      if (res.ok) {
        toast.success("Tag created");
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
              : "Failed to create tag";
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
      toast.success("Tag updated");
      router.refresh();
    } else {
      const err = res.error;
      const msg =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && "_form" in err && Array.isArray((err as { _form?: string[] })._form)
            ? (err as { _form: string[] })._form[0]
            : "Failed to update";
      toast.error(msg);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client tags</CardTitle>
          <CardDescription>
            Create tags with colors. Assign them on each client or from the client form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-[160px] flex-1 gap-1.5">
              <Label htmlFor="new-tag-name">New tag name</Label>
              <Input
                id="new-tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Enterprise"
                maxLength={120}
              />
            </div>
            <div className="grid w-36 gap-1.5">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TAG_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add tag"}
            </Button>
          </form>

          <div className="space-y-2">
            <Label>Existing tags</Label>
            {initialTags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tags yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {initialTags.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={t.color}
                        disabled={!!pendingColorById[t.id]}
                        onValueChange={(v) => onColorChange(t.id, v)}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                        aria-label={`Delete ${t.name}`}
                        onClick={() => setDeleteId(t.id)}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tag?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from all clients. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                const res = await deleteTag(deleteId);
                setDeleteId(null);
                if (res.ok) {
                  toast.success("Tag deleted");
                  router.refresh();
                } else {
                  toast.error(typeof res.error === "string" ? res.error : "Failed to delete");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
