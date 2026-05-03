"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FolderOpen, CheckCircle2, AlertCircle, ListTodo } from "lucide-react";
import { updateTask } from "@/actions/tasks";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_BADGE_CLASS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_LABELS_EN,
  TASK_PRIORITY_BADGE_CLASS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_BADGE_CLASS,
} from "@/types";
import type {
  ProjectsSummary,
  ProjectsByStatusRow,
  WeeklyTaskCompletionRow,
  OverdueTaskRow,
  ActiveProjectRow,
  NewClientsPerMonthRow,
  RecentClientRow,
} from "@/actions/reports";

type TeamCostRow = { teamMemberId: string; name: string; role: string | null; totalSalary: number };
import { SarMoney } from "@/components/ui/sar-money";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";
import { format, parseISO, isValid } from "date-fns";
import { arSA, enUS } from "date-fns/locale";

const CLIENT_STATUS_EN: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  closed: "Closed",
};

const DONUT_COLORS: Record<string, string> = {
  active: "#22c55e",
  on_hold: "#f59e0b",
  review: "#a855f7",
  completed: "#6b7280",
  cancelled: "#ef4444",
  lead: "#3b82f6",
};

type Props = {
  summary: ProjectsSummary;
  byStatus: ProjectsByStatusRow[];
  weeklyCompletion: WeeklyTaskCompletionRow[];
  overdueTasks: OverdueTaskRow[];
  activeProjects: ActiveProjectRow[];
  newClientsTotal: number;
  newClientsByMonth: NewClientsPerMonthRow[];
  recentClients: RecentClientRow[];
  teamCostBreakdown?: TeamCostRow[];
};

export function ProductivityReportsTab({
  summary,
  byStatus,
  weeklyCompletion,
  overdueTasks,
  activeProjects,
  newClientsTotal,
  newClientsByMonth,
  recentClients,
  teamCostBreakdown = [],
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const isAr = locale === "ar";
  const tp = useTranslations("reports.productivity");
  const dateFnsLocale = isAr ? arSA : enUS;
  const chartDir = isAr ? "rtl" : "ltr";
  const tooltipAlign = isAr ? "right" : "left";

  const activeProjectsPagination = useReportPagination(activeProjects, { fixedPageSize: 8 });
  const overduePagination = useReportPagination(overdueTasks, { fixedPageSize: 8 });
  const teamCostPagination = useReportPagination(teamCostBreakdown, { fixedPageSize: 8 });
  const recentClientsPagination = useReportPagination(recentClients, { fixedPageSize: 6 });

  function formatDateSafe(value: string | Date | null | undefined, fmt = "dd/MM/yyyy"): string {
    if (value == null || value === "") return "—";
    let date: Date;
    if (typeof value === "string") {
      date = parseISO(value);
      if (!isValid(date)) date = new Date(value);
    } else {
      date = value;
    }
    if (!isValid(date)) return "—";
    try {
      return format(date, fmt, { locale: dateFnsLocale });
    } catch {
      return "—";
    }
  }

  function projectStatusLabel(status: string) {
    return isAr ? (PROJECT_STATUS_LABELS[status] ?? status) : (PROJECT_STATUS_LABELS_EN[status] ?? status);
  }

  function taskPriorityLabel(priority: string) {
    return isAr ? (TASK_PRIORITY_LABELS[priority] ?? priority) : (TASK_PRIORITY_LABELS_EN[priority] ?? priority);
  }

  function clientStatusLabel(status: string) {
    return isAr ? (CLIENT_STATUS_LABELS[status] ?? status) : (CLIENT_STATUS_EN[status] ?? status);
  }

  async function handleMarkDone(taskId: string) {
    const result = await updateTask({ id: taskId, status: "done" });
    if (result.ok) {
      toast.success(tp("toastTaskDone"));
      router.refresh();
    } else {
      toast.error((result.error as { _form?: string[] })?._form?.[0] ?? tp("toastUpdateFailed"));
    }
  }

  return (
    <div className="space-y-5" dir={chartDir}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-start text-sm font-medium">{tp("kpiActiveProjects")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{summary.activeProjectsCount}</div>
            <p className="text-xs text-muted-foreground">{tp("kpiActiveProjectsHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-start text-sm font-medium">{tp("kpiCompletedYear")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{summary.completedThisYearCount}</div>
            <p className="text-xs text-muted-foreground">{tp("kpiCompletedYearHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-start text-sm font-medium">{tp("kpiOverdueTasks")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold text-red-600">{summary.overdueTasksCount}</div>
            <p className="text-xs text-muted-foreground">{tp("kpiOverdueHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-start text-sm font-medium">{tp("kpiCompletionRate")}</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{summary.taskCompletionRate}%</div>
            <Progress value={summary.taskCompletionRate} className="mt-2 h-2 w-full" />
            <p className="mt-1 text-xs text-muted-foreground">
              {tp("kpiTasksFraction", { done: summary.doneTasks, total: summary.totalTasks })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-start">{tp("chartProjectsByStatus")}</CardTitle>
            <CardDescription className="text-start">{tp("chartProjectsByStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {byStatus.length > 0 ? (
              <div className="h-[280px] w-full min-w-0 sm:h-[300px] lg:h-[350px]" dir={chartDir}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="42%"
                      outerRadius="74%"
                      paddingAngle={2}
                      label={false}
                    >
                      {byStatus.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={DONUT_COLORS[entry.status] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ textAlign: tooltipAlign, direction: chartDir }}
                      formatter={(value: number, _name: string, props: unknown) => {
                        const payload = (props as { payload?: ProjectsByStatusRow }).payload;
                        const total = byStatus.reduce((s, x) => s + x.count, 0);
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                        return [`${value} (${pct}%)`, payload?.label ?? ""];
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      formatter={(value, entry: unknown) => {
                        const p = (entry as { payload?: { label?: string; count?: number } }).payload;
                        return (
                          <span className="text-sm">
                            {p?.label ?? value}: {p?.count ?? 0}
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground sm:h-[300px] lg:h-[350px]">
                {tp("emptyNoProjects")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-start">{tp("weeklyCompletedTitle")}</CardTitle>
            <CardDescription className="text-start">{tp("weeklyCompletedDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyCompletion.some((w) => w.count > 0) || weeklyCompletion.length > 0 ? (
              <div className="h-[280px] w-full min-w-0 sm:h-[300px] lg:h-[350px]" dir={chartDir}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyCompletion} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="weekLabel"
                      fontSize={11}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      fontSize={11}
                      width={36}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ textAlign: tooltipAlign, direction: chartDir }}
                      formatter={(value: number) => [value, tp("weeklyTooltipTasks")]}
                      labelFormatter={(label) => label}
                    />
                    <Bar
                      dataKey="count"
                      name={tp("weeklyBarCompleted")}
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground sm:h-[300px] lg:h-[350px]">
                {tp("emptyNoWeeklyTasks")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-start">{tp("activeProjectsTitle")}</CardTitle>
            <CardDescription className="text-start">{tp("activeProjectsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{tp("emptyNoActiveProjects")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{tp("colDaysRemaining")}</TableHead>
                      <TableHead className="text-start">{tp("colTaskProgress")}</TableHead>
                      <TableHead className="text-start">
                        <span className="inline-flex items-center gap-1">
                          {tp("colBudget")}
                          <SarCurrencyIcon className="h-3 w-3 shrink-0" />
                        </span>
                      </TableHead>
                      <TableHead className="text-start">{tp("colDeadline")}</TableHead>
                      <TableHead className="text-start">{tp("colStatus")}</TableHead>
                      <TableHead className="text-start">{tp("colClient")}</TableHead>
                      <TableHead className="text-start">{tp("colProject")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeProjectsPagination.pageItems.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-start">
                          <span
                            className={
                              p.daysRemaining == null
                                ? "text-muted-foreground"
                                : p.daysRemaining < 0
                                  ? "font-medium text-red-600"
                                  : p.daysRemaining <= 14
                                    ? "text-amber-600"
                                    : "text-green-600"
                            }
                          >
                            {p.daysRemaining == null ? "—" : p.daysRemaining}
                          </span>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={
                                p.totalTasks > 0 ? (p.doneTasks / p.totalTasks) * 100 : 0
                              }
                              className="w-20"
                            />
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {p.doneTasks}/{p.totalTasks}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-start">
                          {p.budget != null ? <SarMoney value={p.budget} className="justify-start" /> : "—"}
                        </TableCell>
                        <TableCell className="text-start">
                          <span
                            className={
                              (() => {
                                if (!p.endDate) return false;
                                const d = parseISO(p.endDate);
                                return isValid(d) && d.getTime() < Date.now();
                              })()
                                ? "text-red-600"
                                : undefined
                            }
                          >
                            {formatDateSafe(p.endDate)}
                          </span>
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge
                            variant="outline"
                            className={PROJECT_STATUS_BADGE_CLASS[p.status]}
                          >
                            {projectStatusLabel(p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <Link
                            href={`/dashboard/clients/${p.clientId}`}
                            className="flex items-center gap-2 font-medium hover:text-primary"
                          >
                            {p.clientName}
                            {p.clientLogoUrl ? (
                              <img
                                src={p.clientLogoUrl}
                                alt=""
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">
                                {(p.clientName ?? "?").slice(0, 1)}
                              </span>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-start font-medium">
                          <Link
                            href={`/dashboard/projects/${p.id}`}
                            className="text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ReportTablePaginationBar
                  page={activeProjectsPagination.page}
                  pageSize={activeProjectsPagination.pageSize}
                  pageCount={activeProjectsPagination.pageCount}
                  total={activeProjectsPagination.total}
                  onPageChange={activeProjectsPagination.setPage}
                  onPageSizeChange={activeProjectsPagination.setPageSize}
                  hidePageSizeSelect={activeProjectsPagination.isPageSizeFixed}
                  className="mt-3 border-t-0 pt-3"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-start">{tp("overdueTitle")}</CardTitle>
            <CardDescription className="text-start">{tp("overdueDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-green-500/50 bg-green-500/5 py-12">
                <p className="text-lg font-medium text-green-700 dark:text-green-400">{tp("overdueEmpty")}</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{tp("colAction")}</TableHead>
                      <TableHead className="text-start">{tp("colDaysLate")}</TableHead>
                      <TableHead className="text-start">{tp("colDueDate")}</TableHead>
                      <TableHead className="text-start">{tp("colPriority")}</TableHead>
                      <TableHead className="text-start">{tp("colProject")}</TableHead>
                      <TableHead className="text-start">{tp("colTask")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overduePagination.pageItems.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="text-start">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkDone(task.id)}
                          >
                            {tp("markDone")}
                          </Button>
                        </TableCell>
                        <TableCell className="text-start font-medium text-red-600">
                          {task.daysOverdue}
                        </TableCell>
                        <TableCell className="text-start">
                          {formatDateSafe(task.dueDate)}
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge
                            variant="outline"
                            className={TASK_PRIORITY_BADGE_CLASS[task.priority]}
                          >
                            {taskPriorityLabel(task.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <Link
                            href={`/dashboard/projects/${task.projectId}`}
                            className="text-primary hover:underline"
                          >
                            {task.projectName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-start font-medium">{task.title}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ReportTablePaginationBar
                  page={overduePagination.page}
                  pageSize={overduePagination.pageSize}
                  pageCount={overduePagination.pageCount}
                  total={overduePagination.total}
                  onPageChange={overduePagination.setPage}
                  onPageSizeChange={overduePagination.setPageSize}
                  hidePageSizeSelect={overduePagination.isPageSizeFixed}
                  className="mt-3 border-t-0 pt-3"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-start">{tp("teamCostsTitle")}</CardTitle>
            <CardDescription className="text-start">{tp("teamCostsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {teamCostBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{tp("emptyNoSalaryExpenses")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">
                        <span className="inline-flex items-center gap-1">
                          {tp("colTotalSalary")}
                          <SarCurrencyIcon className="h-3 w-3 shrink-0" />
                        </span>
                      </TableHead>
                      <TableHead className="text-start">{tp("colRole")}</TableHead>
                      <TableHead className="text-start">{tp("colName")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamCostPagination.pageItems.map((row) => (
                      <TableRow key={row.teamMemberId}>
                        <TableCell className="text-start font-medium">
                          <SarMoney value={row.totalSalary} className="justify-start font-medium" />
                        </TableCell>
                        <TableCell className="text-start text-muted-foreground">
                          {row.role ?? "—"}
                        </TableCell>
                        <TableCell className="text-start">{row.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ReportTablePaginationBar
                  page={teamCostPagination.page}
                  pageSize={teamCostPagination.pageSize}
                  pageCount={teamCostPagination.pageCount}
                  total={teamCostPagination.total}
                  onPageChange={teamCostPagination.setPage}
                  onPageSizeChange={teamCostPagination.setPageSize}
                  hidePageSizeSelect={teamCostPagination.isPageSizeFixed}
                  className="mt-3 border-t-0 pt-3"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle className="text-start">{tp("newClientsTitle")}</CardTitle>
            <CardDescription className="text-start">{tp("newClientsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-4">
            <div className="text-start">
              <div className="text-3xl font-bold lg:text-4xl">{newClientsTotal}</div>
              <p className="text-sm text-muted-foreground">{tp("newClientsLabel")}</p>
            </div>
            {newClientsByMonth.some((m) => m.count > 0) || newClientsByMonth.length > 0 ? (
              <div className="h-[160px] lg:h-[200px]" dir={chartDir}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={newClientsByMonth}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="monthLabel"
                      fontSize={11}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      fontSize={12}
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{ textAlign: tooltipAlign, direction: chartDir }}
                      formatter={(value: number) => [value, tp("newClientsTooltip")]}
                      labelFormatter={(label) => label}
                    />
                    <Bar
                      dataKey="count"
                      name={tp("newClientsBar")}
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-start text-sm font-medium text-muted-foreground">
                {tp("recentClientsTitle")}
              </p>
              {recentClients.length === 0 ? (
                <p className="text-start text-sm text-muted-foreground">{tp("emptyNoNewClientsYear")}</p>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-2">
                    {recentClientsPagination.pageItems.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/clients/${c.id}`}
                          className="flex items-center gap-3 rounded-lg p-2 text-start hover:bg-muted/50"
                        >
                          <Badge
                            variant="outline"
                            className={CLIENT_STATUS_BADGE_CLASS[c.status]}
                          >
                            {clientStatusLabel(c.status)}
                          </Badge>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDateSafe(c.createdAt)}
                          </span>
                          <span className="min-w-0 flex-1 font-medium">{c.companyName}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ReportTablePaginationBar
                    page={recentClientsPagination.page}
                    pageSize={recentClientsPagination.pageSize}
                    pageCount={recentClientsPagination.pageCount}
                    total={recentClientsPagination.total}
                    onPageChange={recentClientsPagination.setPage}
                    onPageSizeChange={recentClientsPagination.setPageSize}
                    hidePageSizeSelect={recentClientsPagination.isPageSizeFixed}
                    className="border-t-0 pt-1"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
