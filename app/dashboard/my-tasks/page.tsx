import { getMyTasks } from "@/actions/assignments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const t = await getTranslations("myTasks");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US";

  const { data: tasks, error } = await getMyTasks();

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    todo: { label: t("statusTodo"), variant: "outline" },
    in_progress: { label: t("statusInProgress"), variant: "default" },
    in_review: { label: t("statusInReview"), variant: "secondary" },
    done: { label: t("statusDone"), variant: "secondary" },
  };

  const priorityMap: Record<string, { label: string; className: string }> = {
    low: { label: t("prioLow"), className: "text-muted-foreground" },
    medium: { label: t("prioMedium"), className: "text-amber-600" },
    high: { label: t("prioHigh"), className: "text-orange-600" },
    urgent: { label: t("prioUrgent"), className: "text-destructive font-semibold" },
  };

  const grouped = (tasks ?? []).reduce<
    Record<
      string,
      {
        projectName: string;
        tasks: NonNullable<typeof tasks>;
      }
    >
  >((acc, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = { projectName: task.projectName, tasks: [] };
    }
    acc[task.projectId].tasks.push(task);
    return acc;
  }, {});

  const projectGroups = Object.values(grouped);

  return (
    <div dir="auto" className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("welcome", { name: session.user.name ?? "" })}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-end text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && projectGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center space-y-3 py-24 text-center">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}

      {projectGroups.map((group) => (
        <div key={group.projectName} className="space-y-3">
          <h2 className="border-b border-border pb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {group.projectName}
          </h2>
          <div className="space-y-2">
            {group.tasks?.map((task) => {
              const status = statusMap[task.taskStatus] ?? { label: task.taskStatus, variant: "outline" as const };
              const priority = priorityMap[task.taskPriority ?? "low"] ?? priorityMap.low;
              return (
                <Card key={task.taskId} className="border border-border shadow-none">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-1 text-end">
                      <p className="truncate text-sm font-medium">{task.taskTitle}</p>
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-xs ${priority.className}`}>{priority.label}</span>
                        {task.taskDueDate && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.taskDueDate).toLocaleDateString(dateLocale)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={status.variant} className="shrink-0 text-xs">
                      {status.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
