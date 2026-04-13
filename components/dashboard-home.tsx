"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import {
  DollarSign,
  FileText,
  FolderOpen,
  ListTodo,
  TrendingUp,
  TrendingDown,
  PlusCircle,
} from "lucide-react";
import type { DashboardData } from "@/actions/dashboard";
import { UpcomingMilestonesCard } from "@/components/dashboard/upcoming-milestones-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS, INVOICE_STATUS_LABELS } from "@/types";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

const DONUT_COLORS: Record<string, string> = {
  active: "#22c55e",
  on_hold: "#f59e0b",
  completed: "#6b7280",
  cancelled: "#ef4444",
  lead: "#3b82f6",
  review: "#a855f7",
};

// Use fixed locale so server and client render the same (avoids hydration mismatch).
const CURRENCY_LOCALE = "en-US";

function formatCurrency(amount: number, currency: string) {
  if (currency === "SAR" || currency === "ر.س") {
    const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (
      <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
        {formatted}
        <SarCurrencyIcon className="h-4 w-4 shrink-0" />
      </span>
    );
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function signedNumberClass(n: number): string {
  if (n > 0.005) return "text-green-600";
  if (n < -0.005) return "text-red-600";
  return "text-muted-foreground";
}

export function DashboardHome({ data }: { data: DashboardData }) {
  const chartMd = useMediaQuery("(min-width: 640px)");
  const {
    currency,
    revenueThisMonth,
    revenueLastMonth,
    outstandingTotal,
    outstandingCount,
    activeProjectsCount,
    overdueTasksCount,
    revenueByMonth,
    projectStatusCounts,
    overdueTasks,
    upcomingProjects,
    upcomingMilestones,
    recentActivity,
    recentInvoices,
    totalProfit,
    profitMargin,
    topProfitableProject,
    topProfitableClient,
    budgetWarnings,
  } = data;

  const revenueDelta =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : (revenueThisMonth > 0 ? 100 : 0);

  return (
    <div className="space-y-8">
      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إيرادات هذا الشهر</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueThisMonth, currency)}
            </div>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              مقارنة بالشهر الماضي
              {revenueDelta >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={revenueDelta >= 0 ? "text-green-600" : "text-red-600"}>
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(0)}%
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستحق</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(outstandingTotal, currency)}
            </div>
            <p className="text-muted-foreground text-xs">
              {outstandingCount} فاتورة غير مدفوعة
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المشاريع النشطة</CardTitle>
            <FolderOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjectsCount}</div>
            <Link
              href="/dashboard/projects?status=active"
              className="text-primary text-xs hover:underline"
            >
              عرض المشاريع النشطة ←
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المهام المتأخرة</CardTitle>
            <ListTodo className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueTasksCount}</div>
            <p className="text-muted-foreground text-xs">تجاوز تاريخ الاستحقاق</p>
          </CardContent>
        </Card>
      </div>

      {/* Profitability KPIs (YTD) — English labels, no decorative icons */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit (YTD)</CardTitle>
            <CardDescription className="text-xs">Collected revenue minus expenses, this year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${signedNumberClass(totalProfit)}`}>
              {formatCurrency(totalProfit, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <CardDescription className="text-xs">Net profit ÷ YTD collected</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${
                profitMargin === null
                  ? "text-muted-foreground"
                  : signedNumberClass(profitMargin)
              }`}
            >
              {profitMargin === null ? "—" : `${profitMargin.toFixed(1)}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Profitable Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProfitableProject ? (
              <>
                <Link
                  href={`/dashboard/projects/${topProfitableProject.id}`}
                  className="font-medium text-primary hover:underline block truncate"
                >
                  {topProfitableProject.name}
                </Link>
                <div className={`text-lg font-semibold tabular-nums ${signedNumberClass(topProfitableProject.profit)}`}>
                  {formatCurrency(topProfitableProject.profit, currency)}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No project data</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Profitable Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProfitableClient ? (
              <>
                <Link
                  href={`/dashboard/clients/${topProfitableClient.id}`}
                  className="font-medium text-primary hover:underline block truncate"
                >
                  {topProfitableClient.name}
                </Link>
                <div className={`text-lg font-semibold tabular-nums ${signedNumberClass(topProfitableClient.profit)}`}>
                  {formatCurrency(topProfitableClient.profit, currency)}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No client data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الإيرادات آخر 12 شهراً</CardTitle>
            <CardDescription>الفواتير مقابل الأرباح</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMonth.some((m) => m.invoiced > 0 || m.collected > 0) ? (
              <div className="h-52 min-h-48 w-full min-w-0 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth} margin={{ top: 8, right: 8, left: chartMd ? 0 : -8, bottom: chartMd ? 8 : 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      fontSize={chartMd ? 12 : 10}
                      interval={0}
                      angle={chartMd ? 0 : -32}
                      textAnchor={chartMd ? "middle" : "end"}
                      height={chartMd ? 28 : 56}
                    />
                    <YAxis fontSize={chartMd ? 12 : 10} width={chartMd ? 44 : 32} tickFormatter={(v) => `${v}`} />
                    <Legend wrapperStyle={{ fontSize: chartMd ? 12 : 11 }} />
                    <Bar dataKey="invoiced" name="الفواتير" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={chartMd ? 48 : 32} />
                    <Bar dataKey="collected" name="الأرباح" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={chartMd ? 48 : 32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-48 md:h-[300px] items-center justify-center text-sm">
                لا توجد بيانات إيرادات بعد.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>حالة المشاريع</CardTitle>
            <CardDescription>توزيع حسب الحالة</CardDescription>
          </CardHeader>
          <CardContent>
            {projectStatusCounts.length > 0 ? (
              <div className="h-52 min-h-48 w-full min-w-0 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectStatusCounts}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="38%"
                      outerRadius="72%"
                      paddingAngle={2}
                      label={
                        chartMd
                          ? ({ label, count }) => `${label}: ${count}`
                          : false
                      }
                    >
                      {projectStatusCounts.map((entry, index) => (
                        <Cell
                          key={entry.status}
                          fill={DONUT_COLORS[entry.status] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-48 md:h-[300px] items-center justify-center text-sm">
                لا توجد مشاريع بعد.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Lists (overdue tasks, deadlines, milestones, invoices) */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {budgetWarnings.length > 0 ? (
          <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget warnings</CardTitle>
              <CardDescription className="text-xs">
                Spend (expenses + billable time) vs. project budget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {budgetWarnings.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 text-sm">
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="font-medium text-primary hover:underline truncate"
                    >
                      {p.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {p.clientName ?? "—"} ·{" "}
                      <span
                        className={
                          p.level === "danger" ? "text-red-600 font-medium" : "text-amber-700 dark:text-amber-400"
                        }
                      >
                        {p.percentUsed}% used
                        {p.remaining < 0
                          ? ` · ${formatCurrency(Math.abs(p.remaining), currency)} over`
                          : ` · ${formatCurrency(p.remaining, currency)} left`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>المهام المتأخرة</CardTitle>
            <CardDescription>تجاوز تاريخ الاستحقاق</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length > 0 ? (
              <ul className="space-y-2">
                {overdueTasks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 text-sm">
                    <Link
                      href={`/dashboard/projects/${t.projectId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {t.projectName} ·{" "}
                      <span className="text-red-600">
                        متأخر {t.daysOverdue} يوم
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد مهام متأخرة.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>المواعيد القادمة</CardTitle>
            <CardDescription>خلال 14 يوماً</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingProjects.length > 0 ? (
              <ul className="space-y-2">
                {upcomingProjects.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 text-sm">
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {p.clientName ?? "—"} · استحقاق {p.endDate}
                    </span>
                    <Badge
                      variant="outline"
                      className={PROJECT_STATUS_BADGE_CLASS[p.status] ?? undefined}
                    >
                      {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد مواعيد قادمة.</p>
            )}
          </CardContent>
        </Card>
        <UpcomingMilestonesCard items={upcomingMilestones} />
        <Card>
          <CardHeader>
            <CardTitle>أحدث الفواتير</CardTitle>
            <CardDescription>آخر 5</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length > 0 ? (
              <ul className="space-y-2">
                {recentInvoices.map((i) => (
                  <li key={i.id} className="flex flex-col gap-0.5 text-sm">
                    <Link
                      href="/dashboard/invoices"
                      className="font-medium text-primary hover:underline"
                    >
                      {i.invoiceNumber}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {i.clientName ?? "—"} · {formatCurrency(Number(i.total), currency)}
                    </span>
                    <Badge variant="outline">{INVOICE_STATUS_LABELS[i.status] ?? i.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد فواتير بعد.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivity items={recentActivity} />

      {/* Row 4 — Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild>
              <Link href="/dashboard/projects">
                <PlusCircle className="me-2 h-4 w-4" />
                مشروع جديد
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/clients">
                <PlusCircle className="me-2 h-4 w-4" />
                عميل جديد
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/invoices">
                <PlusCircle className="me-2 h-4 w-4" />
                فاتورة جديدة
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/tasks">
                <PlusCircle className="me-2 h-4 w-4" />
                مهمة جديدة
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
