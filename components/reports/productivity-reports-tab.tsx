"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  PROJECT_STATUS_BADGE_CLASS,
  TASK_PRIORITY_LABELS,
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
import { ar } from "date-fns/locale";

/** Format a date string or Date for display; returns "—" if invalid. */
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
    return format(date, fmt, { locale: ar });
  } catch {
    return "—";
  }
}

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
  const activeProjectsPagination = useReportPagination(activeProjects, { fixedPageSize: 8 });
  const overduePagination = useReportPagination(overdueTasks, { fixedPageSize: 8 });
  const teamCostPagination = useReportPagination(teamCostBreakdown, { fixedPageSize: 8 });
  const recentClientsPagination = useReportPagination(recentClients, { fixedPageSize: 6 });

  async function handleMarkDone(taskId: string) {
    const result = await updateTask({ id: taskId, status: "done" });
    if (result.ok) {
      toast.success("تم تحديد المهمة كمكتملة");
      router.refresh();
    } else {
      toast.error((result.error as { _form?: string[] })?._form?.[0] ?? "فشل التحديث");
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Section 1 — KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-right">المشاريع النشطة</CardTitle>
            <FolderOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="text-right">
            <div className="text-2xl font-bold">{summary.activeProjectsCount}</div>
            <p className="text-muted-foreground text-xs">حالة = نشط</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-right">مشاريع مكتملة هذا العام</CardTitle>
            <CheckCircle2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="text-right">
            <div className="text-2xl font-bold">{summary.completedThisYearCount}</div>
            <p className="text-muted-foreground text-xs">مكتملة في السنة الحالية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-right">المهام المتأخرة</CardTitle>
            <AlertCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="text-right">
            <div className="text-2xl font-bold text-red-600">{summary.overdueTasksCount}</div>
            <p className="text-muted-foreground text-xs">تجاوز تاريخ الاستحقاق</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-right">معدل إنجاز المهام</CardTitle>
            <ListTodo className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="text-right">
            <div className="text-2xl font-bold">{summary.taskCompletionRate}%</div>
            <Progress value={summary.taskCompletionRate} className="mt-2 h-2 w-full" />
            <p className="text-muted-foreground mt-1 text-xs">
              {summary.doneTasks} / {summary.totalTasks} مهمة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — Two charts side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-right">توزيع المشاريع حسب الحالة</CardTitle>
            <CardDescription className="text-right">عدد المشاريع لكل حالة</CardDescription>
          </CardHeader>
          <CardContent>
            {byStatus.length > 0 ? (
              <div className="h-[280px] w-full min-w-0 sm:h-[300px] lg:h-[350px]" dir="rtl">
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
                      contentStyle={{ textAlign: "right", direction: "rtl" }}
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
              <p className="text-muted-foreground flex h-[280px] items-center justify-center text-sm sm:h-[300px] lg:h-[350px]">
                لا توجد مشاريع بعد.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-right">المهام المنجزة أسبوعياً</CardTitle>
            <CardDescription className="text-right">آخر 8 أسابيع</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyCompletion.some((w) => w.count > 0) || weeklyCompletion.length > 0 ? (
              <div className="h-[280px] w-full min-w-0 sm:h-[300px] lg:h-[350px]" dir="rtl">
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
                      contentStyle={{ textAlign: "right", direction: "rtl" }}
                      formatter={(value: number) => [value, "عدد المهام"]}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="count" name="مكتملة" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-[280px] items-center justify-center text-sm sm:h-[300px] lg:h-[350px]">
                لا توجد بيانات مهام مكتملة بعد.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="min-h-0">
        <CardHeader>
          <CardTitle className="text-right">حالة المشاريع الحالية</CardTitle>
          <CardDescription className="text-right">
            المشاريع غير الملغاة وغير المكتملة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">لا توجد مشاريع نشطة.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الأيام المتبقية</TableHead>
                  <TableHead className="text-right">تقدم المهام</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      الميزانية
                      <SarCurrencyIcon className="h-3 w-3 shrink-0" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">الموعد النهائي</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProjectsPagination.pageItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-right">
                      <span
                        className={
                          p.daysRemaining == null
                            ? "text-muted-foreground"
                            : p.daysRemaining < 0
                              ? "text-red-600 font-medium"
                              : p.daysRemaining <= 14
                                ? "text-amber-600"
                                : "text-green-600"
                        }
                      >
                        {p.daysRemaining == null ? "—" : p.daysRemaining}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Progress
                          value={
                            p.totalTasks > 0 ? (p.doneTasks / p.totalTasks) * 100 : 0
                          }
                          className="w-20"
                        />
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {p.doneTasks}/{p.totalTasks}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.budget != null ? <SarMoney value={p.budget} className="justify-end" /> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
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
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={PROJECT_STATUS_BADGE_CLASS[p.status]}
                      >
                        {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/clients/${p.clientId}`}
                        className="hover:text-primary flex items-center gap-2 justify-end font-medium"
                      >
                        {p.clientName}
                        {p.clientLogoUrl ? (
                          <img
                            src={p.clientLogoUrl}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <span className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-xs">
                            {(p.clientName ?? "?").slice(0, 1)}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">
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
          <CardTitle className="text-right">المهام المتأخرة</CardTitle>
          <CardDescription className="text-right">
            مهام تجاوز تاريخ استحقاقها ولم تُكتمل
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overdueTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-green-500/50 bg-green-500/5 py-12">
              <p className="text-green-700 dark:text-green-400 text-lg font-medium">
                🎉 لا توجد مهام متأخرة!
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">إجراء</TableHead>
                  <TableHead className="text-right">أيام التأخير</TableHead>
                  <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">المهمة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overduePagination.pageItems.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkDone(t.id)}
                      >
                        تحديد كمكتملة
                      </Button>
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {t.daysOverdue}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDateSafe(t.dueDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={TASK_PRIORITY_BADGE_CLASS[t.priority]}
                      >
                        {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/projects/${t.projectId}`}
                        className="text-primary hover:underline"
                      >
                        {t.projectName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">{t.title}</TableCell>
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
          <CardTitle className="text-right">تكاليف الفريق هذا الشهر</CardTitle>
          <CardDescription className="text-right">
            إجمالي مصروفات الرواتب المُسجّلة لكل عضو فريق في الشهر الحالي
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamCostBreakdown.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              لا توجد مصروفات رواتب مرتبطة بأعضاء الفريق هذا الشهر.
            </p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Total salary
                      <SarCurrencyIcon className="h-3 w-3 shrink-0" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamCostPagination.pageItems.map((row) => (
                  <TableRow key={row.teamMemberId}>
                    <TableCell className="text-right font-medium">
                      <SarMoney value={row.totalSalary} className="justify-end font-medium" />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.role ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.name}</TableCell>
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
          <CardTitle className="text-right">العملاء الجدد هذا العام</CardTitle>
          <CardDescription className="text-right">
            عدد العملاء المضافين في السنة الحالية
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4">
          <div className="text-right">
            <div className="text-3xl font-bold lg:text-4xl">{newClientsTotal}</div>
            <p className="text-muted-foreground text-sm">عميل جديد</p>
          </div>
          {newClientsByMonth.some((m) => m.count > 0) || newClientsByMonth.length > 0 ? (
            <div className="h-[160px] lg:h-[200px]" dir="rtl">
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
                    contentStyle={{ textAlign: "right", direction: "rtl" }}
                    formatter={(value: number) => [value, "عدد العملاء"]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="count" name="عملاء جدد" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground mb-2 text-right text-sm font-medium">
              آخر 5 عملاء مضافين
            </p>
            {recentClients.length === 0 ? (
              <p className="text-muted-foreground text-right text-sm">لا يوجد عملاء جدد هذا العام.</p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {recentClientsPagination.pageItems.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-2 text-right"
                      >
                        <Badge
                          variant="outline"
                          className={CLIENT_STATUS_BADGE_CLASS[c.status]}
                        >
                          {CLIENT_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                        <span className="text-muted-foreground shrink-0 text-xs">
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
