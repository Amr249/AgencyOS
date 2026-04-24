import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("clientPortal");
  const res = await getPortalProjects();
  if (!res.ok) {
    if (res.error === "unauthorized") {
      redirect(`/login?callbackUrl=${encodeURIComponent("/portal/progress")}`);
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">{t("loadProjectsError")}</p>
      </div>
    );
  }

  const rows = res.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("deliveryTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("deliverySubtitle")}</p>
      </div>

      <div className="grid gap-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              {t("noProjectsShort")}
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
                  {t("taskProgressLine", { done: p.taskDone, total: p.taskTotal })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={p.taskPercent} className="h-3" />
                <Link href={`/portal/projects/${p.id}`} className="text-primary text-sm hover:underline">
                  {t("viewMilestones")}
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
