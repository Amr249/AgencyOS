"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type UpcomingMilestoneDashboardItem = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  dueDate: string;
  status: string;
  overdue: boolean;
};

export function UpcomingMilestonesCard({ items }: { items: UpcomingMilestoneDashboardItem[] }) {
  const t = useTranslations("dashboardHome.milestones");

  function statusLabel(status: string): string {
    const key = status as "pending" | "in_progress" | "completed" | "cancelled";
    if (key === "pending" || key === "in_progress" || key === "completed" || key === "cancelled") {
      return t(key);
    }
    return status;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex flex-col gap-0.5 text-sm",
                  m.overdue &&
                    "rounded-md border border-red-200 bg-red-50/60 p-2 dark:border-red-900/50 dark:bg-red-950/25"
                )}
              >
                <Link
                  href={`/dashboard/projects/${m.projectId}`}
                  className={cn(
                    "font-medium hover:underline",
                    m.overdue ? "text-red-700 dark:text-red-400" : "text-primary"
                  )}
                >
                  {m.name}
                </Link>
                <span
                  className={cn(
                    "text-muted-foreground text-xs",
                    m.overdue && "font-medium text-red-700 dark:text-red-400"
                  )}
                >
                  {t("lineDue", { project: m.projectName, date: m.dueDate })}
                  {m.overdue ? t("overdueSuffix") : ""}
                </span>
                <Badge variant="outline" className="w-fit text-xs">
                  {statusLabel(m.status)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
