import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPortalActivityFeed,
  getPortalDashboardSummary,
} from "@/actions/portal-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PortalHomePage() {
  const summaryRes = await getPortalDashboardSummary();
  if (!summaryRes.ok) {
    if (summaryRes.error === "unauthorized") redirect("/portal/login");
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">Something went wrong loading your portal.</p>
      </div>
    );
  }

  const summary = summaryRes.data;
  const activityRes = await getPortalActivityFeed(12);
  const activity = activityRes.ok ? activityRes.data ?? [] : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview for {summary.clientName || "your organization"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active projects</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.activeProjectCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            <Link href="/portal/projects" className="text-primary hover:underline">
              View projects
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open balance due</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {summary.currency}{" "}
              {summary.openAmountDue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            <Link href="/portal/invoices" className="text-primary hover:underline">
              View invoices
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall delivery</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.overallTaskPercent}%</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {summary.tasksDone} / {summary.tasksTotal} tasks completed across projects
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Link href="/portal/progress" className="text-primary hover:underline">
              Milestones & progress
            </Link>
            <Link href="/portal/files" className="text-primary hover:underline">
              Shared files
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent activity</CardTitle>
          <CardDescription>Invoices and shared files</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent activity yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {activity.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <span className="font-medium">{item.label}</span>
                    {item.sublabel ? (
                      <span className="text-muted-foreground ml-2 text-sm">· {item.sublabel}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.kind === "invoice" ? item.meta : item.meta.split("/")[0]}
                    </Badge>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.at.toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
