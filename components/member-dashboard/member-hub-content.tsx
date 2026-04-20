import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberProjectRow, MemberSalaryExpenseRow } from "@/actions/member-dashboard";
import { MemberPaymentsDataTable } from "@/components/member-dashboard/member-financial-tables";
import { MemberTaskCharts, MemberEarningsChart } from "@/components/member-dashboard/member-hub-charts";
import { MemberMyTasksTable } from "@/components/member-dashboard/member-my-tasks-table";
import type { WorkspaceMyTaskGroups } from "@/actions/workspace";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_PILL_CLASS } from "@/types";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MemberHubContentProps = {
  displayName: string;
  groups: WorkspaceMyTaskGroups;
  projects: MemberProjectRow[];
  salaryExpenses: MemberSalaryExpenseRow[];
};

const DUE_SECTION_KEYS = ["overdue", "today", "tomorrow", "this_week", "later", "no_date"] as const;

export async function MemberHubContent({
  displayName,
  groups,
  projects,
  salaryExpenses,
}: MemberHubContentProps) {
  const t = await getTranslations("memberDashboard");
  const welcomeName = displayName.trim() || "عضو";

  const allTasks = DUE_SECTION_KEYS.flatMap((k) => groups[k]);

  const activeProjects = projects.filter((p) => p.status === "active").length;

  const taskChartInput = allTasks.map((t) => ({
    status: t.status,
    dueDate: t.dueDate,
  }));

  const expenseChartInput = salaryExpenses.map((e) => ({
    amount: e.amount,
    date: e.date,
  }));

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#c8f542] p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-800">إجمالي المشاريع</p>
          <p className="text-4xl font-bold text-black">{projects.length}</p>
          <p className="mt-1 text-xs text-neutral-600">إجمالي المشاريع في النظام</p>
        </div>
        <div className="rounded-2xl border border-neutral-900 bg-white p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">المشاريع النشطة</p>
          <p className="text-4xl font-bold text-black">{activeProjects}</p>
          <p className="mt-1 text-xs text-neutral-400">من جميع المشاريع</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-300">المشاريع المكتملة</p>
          <p className="text-4xl font-bold text-white">{projects.filter((p) => p.status === "completed").length}</p>
          <p className="mt-1 text-xs text-neutral-400">المشاريع المكتملة</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">قيد المراجعة</p>
          <p className="text-4xl font-bold text-black">{projects.filter((p) => p.status === "review").length}</p>
          <p className="mt-1 text-xs text-neutral-400">مشاريع قيد المراجعة</p>
        </div>
      </div>

      {/* Welcome */}
      <div>
        <p className="text-xl font-medium leading-snug">
          مرحبًا،{" "}
          <span className="text-primary" dir="auto">
            {welcomeName}
          </span>
        </p>
      </div>

      {/* Task Charts */}
      <MemberTaskCharts tasks={taskChartInput} />

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("projects")}</CardTitle>
          <CardDescription>{t("projectsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("projectsEmpty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("projectName")}</TableHead>
                  <TableHead>{t("client")}</TableHead>
                  <TableHead>الأعضاء</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={p.coverImageUrl ?? p.clientLogoUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(p.name ?? "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={p.clientLogoUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(p.clientName ?? "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{p.clientName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.members.length > 0 ? (
                        <div className="flex -space-x-2 space-x-reverse">
                          {p.members.slice(0, 4).map((m) => (
                            <Avatar key={m.id} className="h-6 w-6 border-2 border-background shrink-0" title={m.name}>
                              <AvatarImage src={m.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">{(m.name ?? "?").slice(0, 1)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {p.members.length > 4 && (
                            <div className="h-6 w-6 rounded-full bg-muted text-xs flex items-center justify-center border-2 border-background shrink-0" title={`+${p.members.length - 4}`}>
                              +{p.members.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        PROJECT_STATUS_PILL_CLASS[p.status] ?? "bg-gray-50 text-gray-700"
                      )}>
                        {PROJECT_STATUS_LABELS[p.status] ?? p.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tasks Workspace */}
      <Card>
        <CardHeader>
          <CardTitle>{t("tasks")}</CardTitle>
          <CardDescription>{t("tasksHint")}</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <MemberMyTasksTable groups={groups} />
        </CardContent>
      </Card>

      {/* Earnings Chart */}
      <MemberEarningsChart expenses={expenseChartInput} />

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("projectPayments")}</CardTitle>
          <CardDescription>{t("projectPaymentsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberPaymentsDataTable
            data={salaryExpenses}
            emptyMessage={t("projectPaymentsEmpty")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
