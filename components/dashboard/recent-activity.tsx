"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  FileText,
  FolderKanban,
  Flag,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecentActivityEntry } from "@/actions/activity-log";

function actionIcon(action: string, entityType: string): LucideIcon {
  const a = action.toLowerCase();
  const ent = entityType.toLowerCase();
  if (a.includes("complete") || a.includes("done") || a.includes("paid") || a.includes("finish")) {
    return CheckCircle2;
  }
  if (a.includes("creat") || a.includes("add") || a.includes("new")) {
    return Plus;
  }
  if (a.includes("updat") || a.includes("edit") || a.includes("chang") || a.includes("modif")) {
    return Pencil;
  }
  if (a.includes("delet") || a.includes("remov")) {
    return Trash2;
  }
  if (ent === "invoice") return FileText;
  if (ent === "milestone") return Flag;
  if (ent === "project") return FolderKanban;
  if (ent === "client") return User;
  return MoreHorizontal;
}

function iconClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("complete") || a.includes("done") || a.includes("paid") || a.includes("finish")) {
    return "text-green-600 dark:text-green-500";
  }
  if (a.includes("creat") || a.includes("add") || a.includes("new")) {
    return "text-blue-600 dark:text-blue-400";
  }
  if (a.includes("updat") || a.includes("edit") || a.includes("chang") || a.includes("modif")) {
    return "text-amber-600 dark:text-amber-500";
  }
  if (a.includes("delet") || a.includes("remov")) {
    return "text-red-600 dark:text-red-400";
  }
  return "text-muted-foreground";
}

function humanizeAction(action: string, fallback: string): string {
  if (!action.trim()) return fallback;
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityTypeLabel(type: string, tEntity: (key: string) => string): string {
  const ent = type.toLowerCase();
  if (ent === "task") return tEntity("entityTask");
  if (ent === "project") return tEntity("entityProject");
  if (ent === "milestone") return tEntity("entityMilestone");
  if (ent === "invoice") return tEntity("entityInvoice");
  if (ent === "client") return tEntity("entityClient");
  return type;
}

export function RecentActivity({
  items,
  showViewAll = true,
}: {
  items: RecentActivityEntry[];
  showViewAll?: boolean;
}) {
  const t = useTranslations("dashboardHome.activity");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {showViewAll ? (
          <Link href="/dashboard/activity" className="text-primary text-sm font-medium hover:underline">
            {t("viewAll")}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((entry) => {
              const Cmp = actionIcon(entry.action, entry.entityType);
              return (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5">
                    <Cmp className={cn("h-4 w-4 shrink-0", iconClass(entry.action))} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="leading-snug">
                      <span className="text-muted-foreground">
                        {humanizeAction(entry.action, t("fallbackAction"))}
                      </span>{" "}
                      {entry.entityHref ? (
                        <Link href={entry.entityHref} className="font-medium text-primary hover:underline">
                          {entry.entityLabel ?? t("fallbackItem")}
                        </Link>
                      ) : (
                        <span className="font-medium">{entry.entityLabel ?? t("fallbackItem")}</span>
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        · {entityTypeLabel(entry.entityType, t)}
                      </span>
                    </p>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-xs">
                      {entry.projectId && entry.projectName ? (
                        <Link
                          href={`/dashboard/projects/${entry.projectId}`}
                          className="text-foreground/80 hover:text-primary hover:underline"
                        >
                          {entry.projectName}
                        </Link>
                      ) : (
                        <span>—</span>
                      )}
                      <span aria-hidden>·</span>
                      <time dateTime={entry.createdAt}>{entry.relativeTime}</time>
                      {entry.actorName ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{entry.actorName}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
