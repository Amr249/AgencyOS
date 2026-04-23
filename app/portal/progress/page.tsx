import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalProjects } from "@/actions/portal-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default async function PortalProgressPage() {
  const res = await getPortalProjects();
  if (!res.ok) {
    if (res.error === "unauthorized") redirect("/portal/login");
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">Could not load progress.</p>
      </div>
    );
  }

  const rows = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery progress</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Task completion across your projects (aggregated). Open a project for milestone detail.
        </p>
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
              <CardHeader>
                <CardTitle className="text-lg">
                  <Link href={`/portal/projects/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {p.taskDone} of {p.taskTotal} tasks complete
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={p.taskPercent} className="h-3" />
                <Link href={`/portal/projects/${p.id}`} className="text-primary text-sm hover:underline">
                  View milestones
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
