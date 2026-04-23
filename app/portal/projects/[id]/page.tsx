import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalMilestonesByProjectId } from "@/actions/milestones";
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

type Props = { params: Promise<{ id: string }> };

export default async function PortalProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getPortalSession();
  if (!ctx) redirect("/portal/login");

  const [proj] = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      description: projects.description,
      startDate: projects.startDate,
      endDate: projects.endDate,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  if (!proj || proj.clientId !== ctx.clientId) {
    notFound();
  }

  const msRes = await getPortalMilestonesByProjectId(id);
  const milestones = msRes.ok ? msRes.data ?? [] : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/portal/projects" className="text-primary text-sm hover:underline">
            ← All projects
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{proj.name}</h1>
          {proj.description ? (
            <p className="text-muted-foreground max-w-2xl text-sm">{proj.description}</p>
          ) : null}
          <p className="text-muted-foreground text-sm tabular-nums">
            {proj.startDate ? String(proj.startDate).slice(0, 10) : "—"} →{" "}
            {proj.endDate ? String(proj.endDate).slice(0, 10) : "—"}
          </p>
        </div>
        <Badge variant="secondary" className={PROJECT_STATUS_PILL_CLASS[proj.status] ?? ""}>
          {PROJECT_STATUS_LABELS_EN[proj.status] ?? proj.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Milestones</CardTitle>
          <CardDescription>High-level checkpoints and linked task completion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {milestones.length === 0 ? (
            <p className="text-muted-foreground text-sm">No milestones on this project yet.</p>
          ) : (
            milestones.map((m) => (
              <div key={m.id} className="border-b pb-6 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{m.name}</h3>
                    {m.description ? (
                      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{m.description}</p>
                    ) : null}
                    <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                      {String(m.startDate).slice(0, 10)} → {String(m.dueDate).slice(0, 10)} ·{" "}
                      <span className="capitalize">{m.status.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <Badge variant="outline">{m.taskProgress.percent}%</Badge>
                </div>
                <Progress value={m.taskProgress.percent} className="mt-3 h-2" />
                <p className="text-muted-foreground mt-2 text-xs">
                  {m.taskProgress.completed} / {m.taskProgress.total} tasks linked to this milestone
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
