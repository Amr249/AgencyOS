"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  CreditCard,
  Folder,
  ImageIcon,
  KeyRound,
  ListChecks,
  Mail,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import {
  deleteNotifications,
  getMyUnreadNotificationCount,
  listMyNotifications,
  markNotificationsRead,
  type NotificationRow,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

function timeAgo(date: Date, locale: "ar" | "en"): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return locale === "ar" ? "الآن" : "just now";
  if (diffSec < 3_600) {
    const n = Math.floor(diffSec / 60);
    return locale === "ar" ? `منذ ${n} دقيقة` : `${n}m ago`;
  }
  if (diffSec < 86_400) {
    const n = Math.floor(diffSec / 3600);
    return locale === "ar" ? `منذ ${n} ساعة` : `${n}h ago`;
  }
  if (diffSec < 604_800) {
    const days = Math.floor(diffSec / 86_400);
    return locale === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  }
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

type IconTone =
  | "primary"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

const TONE_CLASS: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-muted text-muted-foreground",
};

function iconForType(type: string): {
  Icon: React.ComponentType<{ className?: string }>;
  tone: IconTone;
} {
  if (type.startsWith("profile.email")) return { Icon: Mail, tone: "blue" };
  if (type.startsWith("profile.password")) return { Icon: KeyRound, tone: "amber" };
  if (type.startsWith("profile.avatar")) return { Icon: ImageIcon, tone: "violet" };
  if (type.startsWith("profile.name")) return { Icon: UserCircle2, tone: "primary" };
  if (type.startsWith("profile")) return { Icon: UserCircle2, tone: "primary" };
  if (type.startsWith("task")) return { Icon: ListChecks, tone: "emerald" };
  if (type.startsWith("project")) return { Icon: Folder, tone: "blue" };
  if (type.startsWith("payment") || type.startsWith("invoice"))
    return { Icon: CreditCard, tone: "amber" };
  return { Icon: Bell, tone: "slate" };
}

export function NotificationBell() {
  const locale = (useLocale() as "ar" | "en") ?? "ar";
  const isAr = locale === "ar";
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<NotificationRow[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<NotificationRow | null>(null);

  const refreshUnread = React.useCallback(async () => {
    const res = await getMyUnreadNotificationCount();
    if (res.ok) setUnread(res.count);
  }, []);

  const refreshList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyNotifications(30);
      if (res.ok) setRows(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => {
      void refreshUnread();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  React.useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  async function onMarkAllRead() {
    const prev = rows;
    setRows((curr) => curr.map((r) => (r.readAt ? r : { ...r, readAt: new Date() })));
    setUnread(0);
    const res = await markNotificationsRead({ all: true });
    if (!res.ok) {
      setRows(prev);
      void refreshUnread();
    }
  }

  async function onClearAll() {
    const prev = rows;
    setRows([]);
    setUnread(0);
    const res = await deleteNotifications({ all: true });
    if (!res.ok) {
      setRows(prev);
      void refreshUnread();
    }
  }

  async function dismissOne(id: string, wasUnread: boolean) {
    setRows((curr) => curr.filter((r) => r.id !== id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    const res = await deleteNotifications({ ids: [id] });
    if (!res.ok) {
      void refreshUnread();
      void refreshList();
    }
  }

  function openDetails(n: NotificationRow) {
    setSelected(n);
    if (!n.readAt) {
      setRows((curr) =>
        curr.map((r) => (r.id === n.id ? { ...r, readAt: new Date() } : r))
      );
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationsRead({ ids: [n.id] });
    }
  }

  async function onDialogOpenChange(next: boolean) {
    if (!next && selected) {
      const toDismiss = selected;
      setSelected(null);
      await dismissOne(toDismiss.id, false);
      return;
    }
    if (!next) setSelected(null);
  }

  const badge = unread > 99 ? "99+" : String(unread);
  const headerTitle = isAr ? "الإشعارات" : "Notifications";
  const emptyText = isAr ? "لا توجد إشعارات بعد." : "No notifications yet.";
  const loadingText = isAr ? "جارٍ التحميل…" : "Loading…";
  const markAllText = isAr ? "تعليم الكل كمقروء" : "Mark all read";
  const clearAllText = isAr ? "مسح الكل" : "Clear all";
  const closeText = isAr ? "إغلاق" : "Close";
  const openLinkText = isAr ? "فتح الصفحة" : "Open page";
  const dismissLabel = isAr ? "حذف الإشعار" : "Dismiss notification";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            aria-label={headerTitle}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="bg-destructive text-destructive-foreground pointer-events-none absolute -end-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-[18px]">
                {badge}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[360px] overflow-hidden p-0 sm:w-[400px]"
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{headerTitle}</p>
              {unread > 0 ? (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  {unread}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={unread === 0}
                onClick={() => void onMarkAllRead()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {markAllText}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                disabled={rows.length === 0}
                onClick={() => void onClearAll()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearAllText}
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[420px]">
            {loading && rows.length === 0 ? (
              <p className="text-muted-foreground px-3 py-10 text-center text-xs">
                {loadingText}
              </p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-3 py-12 text-center">
                <div className="bg-muted/60 text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">{emptyText}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {isAr
                    ? "ستظهر هنا التحديثات الجديدة."
                    : "New updates will show up here."}
                </p>
              </div>
            ) : (
              <ul className="divide-border/60 divide-y">
                {rows.map((n) => {
                  const isUnread = !n.readAt;
                  const { Icon, tone } = iconForType(n.type);
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "group relative",
                        isUnread ? "bg-accent/30" : "bg-transparent"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openDetails(n)}
                        className="hover:bg-accent/60 flex w-full items-start gap-3 px-3 py-3 text-start transition-colors"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            TONE_CLASS[tone]
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-sm leading-5",
                                isUnread ? "font-semibold" : "font-medium"
                              )}
                            >
                              {n.title}
                            </p>
                            {isUnread ? (
                              <span className="bg-primary mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" />
                            ) : null}
                          </div>
                          {n.body ? (
                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-5">
                              {n.body}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground mt-1 text-[10px]">
                            {timeAgo(new Date(n.createdAt), locale)}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={dismissLabel}
                        title={dismissLabel}
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismissOne(n.id, isUnread);
                        }}
                        className="text-muted-foreground hover:bg-background hover:text-foreground absolute end-2 top-2 hidden h-6 w-6 items-center justify-center rounded-md border border-transparent group-hover:flex"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={selected !== null} onOpenChange={onDialogOpenChange}>
        <DialogContent
          dir={isAr ? "rtl" : "ltr"}
          className="sm:max-w-md"
        >
          {selected ? (
            <>
              <DialogHeader className="items-start">
                <div className="flex items-center gap-3">
                  {(() => {
                    const { Icon, tone } = iconForType(selected.type);
                    return (
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          TONE_CLASS[tone]
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    );
                  })()}
                  <div className="min-w-0 flex-1 text-start">
                    <DialogTitle className="text-base">{selected.title}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-[11px]">
                      {timeAgo(new Date(selected.createdAt), locale)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {selected.body ? (
                <p className="text-foreground text-sm leading-6 whitespace-pre-wrap">
                  {selected.body}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {isAr ? "لا يوجد تفاصيل إضافية." : "No additional details."}
                </p>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                {selected.linkUrl ? (
                  <Button asChild variant="outline">
                    <Link
                      href={selected.linkUrl}
                      onClick={() => {
                        const id = selected.id;
                        setSelected(null);
                        setOpen(false);
                        void dismissOne(id, false);
                      }}
                    >
                      {openLinkText}
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => {
                    void onDialogOpenChange(false);
                  }}
                >
                  {closeText}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
