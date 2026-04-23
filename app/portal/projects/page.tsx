import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalProjects } from "@/actions/portal-dashboard";
import {
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_PILL_CLASS,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default async function PortalProjectsPage() {
  const res = await getPortalProjects();
  if (!res.ok) {
    if (res.error === "unauthorized") redirect("/portal/login");
    return <ErrorMsg />;
  }

  const rows = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1 text-sm">Projects linked to your organization</p>
      </div>

      <div className="grid gap-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              No projects yet.
            </CardContent>
          </Card>
        ) : (
          rows.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    <Link href={`/portal/projects/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {p.startDate ? String(p.startDate).slice(0, 10) : "—"} →{" "}
                    {p.endDate ? String(p.endDate).slice(0, 10) : "—"}
                  </CardDescription>
                </div>
                <Badge
                  variant="secondary"
                  className={PROJECT_STATUS_PILL_CLASS[p.status] ?? ""}
                >
                  {PROJECT_STATUS_LABELS_EN[p.status] ?? p.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tasks completed</span>
                  <span className="tabular-nums">
                    {p.taskDone} / {p.taskTotal} ({p.taskPercent}%)
                  </span>
                </div>
                <Progress value={p.taskPercent} className="h-2" />
                <Link
                  href={`/portal/projects/${p.id}`}
                  className="text-primary inline-block text-sm hover:underline"
                >
                  Milestones & details
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ErrorMsg() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-destructive text-sm">Could not load projects.</p>
    </div>
  );
}
