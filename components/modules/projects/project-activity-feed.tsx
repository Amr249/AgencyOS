"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Activity,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  CircleDot,
  FileText,
  Flag,
  FolderKanban,
  Pencil,
  PlusCircle,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { getProjectActivity } from "@/actions/activity-log";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS_EN } from "@/types";

export type ActivityFeedEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string | null;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
};

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

function humanTaskStatus(status: string | undefined): string {
  if (!status) return status ?? "";
  return TASK_STATUS_LABELS_EN[status] ?? status.replace(/_/g, " ");
}

export function formatActivityDescription(entry: ActivityFeedEntry): string {
  const meta = entry.metadata;
  const actor = entry.actorName?.trim() || "System";
  const title =
    metaString(meta, "title") ??
    metaString(meta, "taskTitle") ??
    metaString(meta, "name") ??
    "Untitled";
  const invoiceNumber = metaString(meta, "invoiceNumber");
  const newStatus = metaString(meta, "newStatus") ?? metaString(meta, "status");
  const milestoneName = metaString(meta, "milestoneName") ?? title;

  switch (entry.entityType) {
    case "task": {
      if (entry.action === "created") {
        return `Task "${title}" was created by ${actor}`;
      }
      if (entry.action === "deleted") {
        return `Task "${title}" was deleted by ${actor}`;
      }
      if (entry.action === "status_changed" || entry.action === "updated") {
        if (newStatus) {
          const label = humanTaskStatus(newStatus);
          return `Task "${title}" status changed to ${label} by ${actor}`;
        }
        return `Task "${title}" was updated by ${actor}`;
      }
      if (entry.action === "assigned") {
        return `Task "${title}" assignment updated by ${actor}`;
      }
      if (entry.action === "completed") {
        return `Task "${title}" was completed by ${actor}`;
      }
      return `Task "${title}" — ${entry.action.replace(/_/g, " ")} (${actor})`;
    }
    case "invoice": {
      const inv = invoiceNumber ? `Invoice ${invoiceNumber}` : "Invoice";
      if (
        entry.action === "paid" ||
        entry.action === "payment_recorded" ||
        (entry.action === "status_changed" && newStatus === "paid")
      ) {
        return `${inv} marked as paid`;
      }
      if (entry.action === "created") {
        return `${inv} was created by ${actor}`;
      }
      if (entry.action === "updated") {
        return `${inv} was updated by ${actor}`;
      }
      return `${inv} — ${entry.action.replace(/_/g, " ")}`;
    }
    case "milestone": {
      if (entry.action === "completed" || newStatus === "completed") {
        return `Milestone "${milestoneName}" completed`;
      }
      if (entry.action === "created") {
        return `Milestone "${milestoneName}" was created by ${actor}`;
      }
      return `Milestone "${milestoneName}" — ${entry.action.replace(/_/g, " ")}`;
    }
    case "project": {
      return `Project was ${entry.action.replace(/_/g, " ")} by ${actor}`;
    }
    case "client": {
      return `Client "${title}" — ${entry.action.replace(/_/g, " ")} by ${actor}`;
    }
    default:
      return `${entry.entityType} ${entry.action.replace(/_/g, " ")}${
        entry.actorName ? ` · ${actor}` : ""
      }`;
  }
}

function activityIcon(entry: ActivityFeedEntry) {
  const { action, entityType } = entry;
  if (action === "deleted") return Trash2;
  if (action === "created") return PlusCircle;
  if (action === "paid" || action === "payment_recorded") return Banknote;
  if (action === "completed" || action === "status_changed") {
    if (entityType === "task" && action === "status_changed") return ArrowRightLeft;
    if (entityType === "milestone" || action === "completed") return CheckCircle2;
  }
  if (action === "assigned") return UserPlus;
  if (action === "updated" || action === "edited") return Pencil;
  if (entityType === "invoice") return FileText;
  if (entityType === "milestone") return Flag;
  if (entityType === "project") return FolderKanban;
  if (entityType === "client") return Users;
  if (entityType === "task") return CircleDot;
  return Activity;
}

function formatRelativeTime(createdAt: Date | string): string {
  try {
    const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true, locale: enUS });
  } catch {
    return "";
  }
}

type ProjectActivityFeedProps = {
  projectId: string;
  variant: "compact" | "full";
  entries: ActivityFeedEntry[];
  /** True when the server fetch returned more rows than displayed in this variant's window. */
  trailingHasMore: boolean;
};

export function ProjectActivityFeed({
  projectId,
  variant,
  entries,
  trailingHasMore,
}: ProjectActivityFeedProps) {
  const [fullEntries, setFullEntries] = React.useState<ActivityFeedEntry[] | null>(null);
  const [loadingAll, setLoadingAll] = React.useState(false);

  const displayed =
    variant === "full" && fullEntries != null
      ? fullEntries
      : entries;

  const handleViewAll = async () => {
    setLoadingAll(true);
    try {
      const res = await getProjectActivity(projectId, 100);
      if (res.ok) {
        setFullEntries(res.data as ActivityFeedEntry[]);
      }
    } finally {
      setLoadingAll(false);
    }
  };

  const showViewAllButton =
    variant === "full" && trailingHasMore && fullEntries == null;

  return (
    <Card className="text-left" dir="ltr" lang="en">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        {variant === "compact" && trailingHasMore ? (
          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
            <Link href={`/dashboard/projects/${projectId}?tab=activity`}>View all</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-0">
        {displayed.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No activity yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {displayed.map((entry) => {
              const Icon = activityIcon(entry);
              const description = formatActivityDescription(entry);
              const rel = formatRelativeTime(entry.createdAt);
              const actor = entry.actorName?.trim();
              const showActor =
                actor &&
                !description.includes(actor);
              const meta = [showActor ? actor : null, rel].filter(Boolean).join(" · ");
              return (
                <li key={entry.id} className="flex gap-3 py-3 first:pt-0">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm leading-snug">{description}</p>
                    {meta ? (
                      <p className="text-muted-foreground text-xs">{meta}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {showViewAllButton ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={loadingAll}
              onClick={() => void handleViewAll()}
            >
              {loadingAll ? "Loading…" : "View all"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
