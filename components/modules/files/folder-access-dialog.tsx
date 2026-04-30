"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  excludeSubfolder,
  getFolderAccessList,
  grantFolderAccess,
  listDirectChildFoldersForAccess,
  removeExclusion,
  revokeFolderAccess,
  type FolderAccessListEntry,
} from "@/actions/folder-access";
import type { FolderRow } from "@/actions/folders";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type TeamPick = { id: string; name: string; avatarUrl?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderRow | null;
  teamMembers: TeamPick[];
  isArabic: boolean;
  formatError: (msg: string) => string;
  /** Refresh sidebar badges / counts after grants or exclusions change. */
  onAccessMutated?: () => void | Promise<void>;
};

export function FolderAccessDialog({
  open,
  onOpenChange,
  folder,
  teamMembers,
  isArabic,
  formatError,
  onAccessMutated,
}: Props) {
  const [list, setList] = React.useState<FolderAccessListEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyMemberId, setBusyMemberId] = React.useState<string | null>(null);
  const [exclusionsOpen, setExclusionsOpen] = React.useState(false);
  const [exclusionsMember, setExclusionsMember] = React.useState<FolderAccessListEntry | null>(null);
  const [children, setChildren] = React.useState<{ id: string; name: string }[]>([]);
  const [excludedSet, setExcludedSet] = React.useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = React.useState<FolderAccessListEntry | null>(null);

  const loadList = React.useCallback(async () => {
    if (!folder) return;
    setLoading(true);
    try {
      const res = await getFolderAccessList(folder.id);
      if (res.ok) setList(res.data);
      else {
        setList([]);
        toast.error(formatError(typeof res.error === "string" ? res.error : "Failed"));
      }
    } finally {
      setLoading(false);
    }
  }, [folder, formatError]);

  React.useEffect(() => {
    if (open && folder) void loadList();
    if (!open) {
      setExclusionsOpen(false);
      setExclusionsMember(null);
      setRemoveTarget(null);
    }
  }, [open, folder, loadList]);

  const memberIdsWithAccess = React.useMemo(() => new Set(list.map((r) => r.teamMemberId)), [list]);
  const addableMembers = React.useMemo(
    () => teamMembers.filter((m) => !memberIdsWithAccess.has(m.id)),
    [teamMembers, memberIdsWithAccess]
  );

  const openExclusions = async (entry: FolderAccessListEntry) => {
    if (!folder) return;
    setExclusionsMember(entry);
    setExcludedSet(new Set(entry.excludedSubfolderIds));
    const res = await listDirectChildFoldersForAccess(folder.id);
    setChildren(res.ok ? res.data : []);
    setExclusionsOpen(true);
  };

  const toggleExclusion = async (childId: string, nextExcluded: boolean) => {
    if (!folder || !exclusionsMember) return;
    setBusyMemberId(exclusionsMember.teamMemberId);
    try {
      const res = nextExcluded
        ? await excludeSubfolder(childId, exclusionsMember.teamMemberId)
        : await removeExclusion(childId, exclusionsMember.teamMemberId);
      if (!res.ok) {
        toast.error(formatError(typeof res.error === "string" ? res.error : "Failed"));
        return;
      }
      setExcludedSet((prev) => {
        const n = new Set(prev);
        if (nextExcluded) n.add(childId);
        else n.delete(childId);
        return n;
      });
      await loadList();
      void onAccessMutated?.();
    } finally {
      setBusyMemberId(null);
    }
  };

  if (!folder) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{isArabic ? "إدارة الوصول" : "Manage access"}</DialogTitle>
            <DialogDescription className="truncate">{folder.name}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                {isArabic ? "إضافة عضو" : "Add member"}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={loading || addableMembers.length === 0}>
                    {isArabic ? "اختر عضوًا…" : "Choose member…"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 min-w-48 overflow-y-auto">
                  {addableMembers.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => {
                        void (async () => {
                          const res = await grantFolderAccess(folder.id, m.id, "view");
                          if (!res.ok) {
                            toast.error(formatError(typeof res.error === "string" ? res.error : "Failed"));
                            return;
                          }
                          toast.success(isArabic ? "تم منح الوصول." : "Access granted.");
                          await loadList();
                          void onAccessMutated?.();
                        })();
                      }}
                    >
                      {m.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ScrollArea className="h-72 rounded-md border">
              <div className="space-y-2 p-3">
                {loading ? (
                  <p className="text-muted-foreground text-sm">{isArabic ? "جاري التحميل…" : "Loading…"}</p>
                ) : list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {isArabic ? "لا يوجد أعضاء لديهم وصول لهذا المجلد." : "No members have access to this folder yet."}
                  </p>
                ) : (
                  list.map((row) => (
                    <div
                      key={row.teamMemberId}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-8 shrink-0">
                            {row.memberAvatar ? <AvatarImage src={row.memberAvatar} alt="" /> : null}
                            <AvatarFallback>{row.memberName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.memberName}</p>
                            <Badge variant="secondary" className="mt-0.5 text-xs capitalize">
                              {row.accessType}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive shrink-0"
                          disabled={busyMemberId === row.teamMemberId}
                          onClick={() => setRemoveTarget(row)}
                        >
                          {isArabic ? "إزالة" : "Remove"}
                        </Button>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <span>{row.isDirect ? (isArabic ? "وصول مباشر" : "Direct access") : (isArabic ? "موروث" : "Inherited")}</span>
                        {row.excludedSubfolderIds.length > 0 ? (
                          <span>
                            {isArabic ? "استثناءات:" : "Exclusions:"} {row.excludedSubfolderIds.length}
                          </span>
                        ) : (
                          <span>{isArabic ? "لا استثناءات" : "No exclusions"}</span>
                        )}
                        <Button type="button" variant="link" className="h-auto px-0 py-0 text-xs" onClick={() => void openExclusions(row)}>
                          {isArabic ? "إدارة الاستثناءات" : "Manage exclusions"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {isArabic ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exclusionsOpen} onOpenChange={setExclusionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? "استثناء المجلدات الفرعية" : "Exclude subfolders"}</DialogTitle>
            <DialogDescription>
              {exclusionsMember?.memberName} — {isArabic ? "المحدد = مخفي عن العضو" : "Checked = hidden from member"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-2 pe-2">
              {children.length === 0 ? (
                <p className="text-muted-foreground text-sm">{isArabic ? "لا توجد مجلدات فرعية." : "No subfolders."}</p>
              ) : (
                children.map((ch) => (
                  <label key={ch.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      checked={excludedSet.has(ch.id)}
                      disabled={busyMemberId === exclusionsMember?.teamMemberId}
                      onCheckedChange={(v) => void toggleExclusion(ch.id, v === true)}
                    />
                    <span className="truncate">{ch.name}</span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" onClick={() => setExclusionsOpen(false)}>
              {isArabic ? "تم" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "إزالة الوصول؟" : "Remove access?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.memberName}
              {isArabic
                ? " لن يتمكن من رؤية هذا المجلد وفق قواعد الوراثة الحالية."
                : " will lose access to this folder based on current inheritance rules."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = removeTarget;
                if (!t || !folder) return;
                void (async () => {
                  setBusyMemberId(t.teamMemberId);
                  const res = await revokeFolderAccess(folder.id, t.teamMemberId);
                  setBusyMemberId(null);
                  setRemoveTarget(null);
                  if (!res.ok) {
                    toast.error(formatError(typeof res.error === "string" ? res.error : "Failed"));
                    return;
                  }
                  toast.success(isArabic ? "تمت إزالة الوصول." : "Access removed.");
                  await loadList();
                  void onAccessMutated?.();
                })();
              }}
            >
              {isArabic ? "إزالة" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
