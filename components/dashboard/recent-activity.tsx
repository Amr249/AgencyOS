import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
  const t = entityType.toLowerCase();
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
  if (t === "invoice") return FileText;
  if (t === "milestone") return Flag;
  if (t === "project") return FolderKanban;
  if (t === "client") return User;
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

function humanizeAction(action: string): string {
  if (!action.trim()) return "Activity";
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "task") return "Task";
  if (t === "project") return "Project";
  if (t === "milestone") return "Milestone";
  if (t === "invoice") return "Invoice";
  if (t === "client") return "Client";
  return type;
}

export function RecentActivity({
  items,
  showViewAll = true,
}: {
  items: RecentActivityEntry[];
  showViewAll?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates across projects</CardDescription>
        </div>
        {showViewAll ? (
          <Link
            href="/dashboard/activity"
            className="text-primary text-sm font-medium hover:underline"
          >
            View all
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
                    <span className="text-muted-foreground">{humanizeAction(entry.action)}</span>{" "}
                    {entry.entityHref ? (
                      <Link href={entry.entityHref} className="font-medium text-primary hover:underline">
                        {entry.entityLabel ?? "Item"}
                      </Link>
                    ) : (
                      <span className="font-medium">{entry.entityLabel ?? "Item"}</span>
                    )}
                    <span className="text-muted-foreground"> · {entityTypeLabel(entry.entityType)}</span>
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
          <p className="text-muted-foreground text-sm">No recent activity</p>
        )}
      </CardContent>
    </Card>
  );
}
