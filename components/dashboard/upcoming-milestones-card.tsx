import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Milestones</CardTitle>
        <CardDescription>Due in the next 14 days (includes overdue)</CardDescription>
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
                  {m.projectName} · Due {m.dueDate}
                  {m.overdue ? " · Overdue" : ""}
                </span>
                <Badge variant="outline" className="w-fit text-xs">
                  {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No upcoming milestones</p>
        )}
      </CardContent>
    </Card>
  );
}
