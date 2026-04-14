"use client";

import * as React from "react";
import Link from "next/link";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import type { ClientTimelineItem, TimelineIconKind } from "@/actions/activity-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Building2,
  CheckCircle2,
  DollarSign,
  FileUp,
  FolderKanban,
  StickyNote,
  UserPlus,
  ListTodo,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

function timelineIcon(kind: TimelineIconKind) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  switch (kind) {
    case "client":
      return <Building2 className={cls} aria-hidden />;
    case "status":
      return <CheckCircle2 className={cls} aria-hidden />;
    case "project":
      return <FolderKanban className={cls} aria-hidden />;
    case "invoice":
      return <DollarSign className={cls} aria-hidden />;
    case "file":
      return <FileUp className={cls} aria-hidden />;
    case "note":
      return <StickyNote className={cls} aria-hidden />;
    case "proposal":
      return <UserPlus className={cls} aria-hidden />;
    case "task":
      return <ListTodo className={cls} aria-hidden />;
    case "milestone":
      return <Flag className={cls} aria-hidden />;
    default:
      return <Activity className={cls} aria-hidden />;
  }
}

function sectionKey(d: Date): "today" | "yesterday" | "thisWeek" | "earlier" {
  if (isToday(d)) return "today";
  if (isYesterday(d)) return "yesterday";
  const sow = startOfWeek(new Date(), { weekStartsOn: 0 });
  if (d.getTime() >= sow.getTime()) return "thisWeek";
  return "earlier";
}

const SECTION_TITLES: Record<ReturnType<typeof sectionKey>, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  earlier: "Earlier",
};

function formatWhen(d: Date): string {
  if (isToday(d)) {
    return formatDistanceToNow(d, { addSuffix: true, locale: enUS });
  }
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, "h:mm a", { locale: enUS })}`;
  }
  return format(d, "MMM d, yyyy 'at' h:mm a", { locale: enUS });
}

type ClientActivityTimelineProps = {
  items: ClientTimelineItem[];
  isRtl?: boolean;
};

export function ClientActivityTimeline({ items, isRtl = false }: ClientActivityTimelineProps) {
  const grouped = React.useMemo(() => {
    const order: Array<keyof typeof SECTION_TITLES> = [
      "today",
      "yesterday",
      "thisWeek",
      "earlier",
    ];
    const buckets = new Map<string, ClientTimelineItem[]>();
    for (const k of order) buckets.set(k, []);
    for (const item of items) {
      const d = new Date(item.createdAt);
      const key = sectionKey(d);
      buckets.get(key)!.push(item);
    }
    return order.map((key) => ({
      key,
      title: SECTION_TITLES[key],
      entries: buckets.get(key)!,
    }));
  }, [items]);

  const hasAny = items.length > 0;

  return (
    <Card className={cn(isRtl && "text-right")} dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(
              (section) =>
                section.entries.length > 0 && (
                  <div key={section.key}>
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                      {section.title}
                    </h3>
                    <ul
                      className={cn(
                        "relative space-y-0 border-border",
                        isRtl ? "border-e pe-4" : "border-s ps-4"
                      )}
                    >
                      {section.entries.map((item) => {
                        const d = new Date(item.createdAt);
                        const when = formatWhen(d);
                        const dotSide = isRtl ? "-end-[9px]" : "-start-[9px]";
                        return (
                          <li key={item.id} className="relative">
                            <div
                              className={cn(
                                "absolute top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background",
                                dotSide
                              )}
                            >
                              {timelineIcon(item.iconKind)}
                            </div>
                            <div className="space-y-0.5 pb-4">
                              {item.entityHref ? (
                                <Link
                                  href={item.entityHref}
                                  className="text-sm leading-snug font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {item.description}
                                </Link>
                              ) : (
                                <p className="text-sm leading-snug">{item.description}</p>
                              )}
                              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0 text-xs">
                                <time dateTime={item.createdAt}>{when}</time>
                                {item.actorName ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{item.actorName}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
