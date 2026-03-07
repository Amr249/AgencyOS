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
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS, INVOICE_STATUS_LABELS } from "@/types";

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
    return `${formatted} ر.س`;
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardHome({ data }: { data: DashboardData }) {
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
    recentInvoices,
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

      {/* Row 2 — Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الإيرادات آخر 12 شهراً</CardTitle>
            <CardDescription>الفواتير مقابل الأرباح</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMonth.some((m) => m.invoiced > 0 || m.collected > 0) ? (
              <div className="h-48 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${v}`} />
                    <Legend />
                    <Bar dataKey="invoiced" name="الفواتير" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="الأرباح" fill="#22c55e" radius={[4, 4, 0, 0]} />
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
              <div className="h-48 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectStatusCounts}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ label, count }) => `${label}: ${count}`}
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

      {/* Row 3 — Three columns */}
      <div className="grid gap-4 md:grid-cols-3">
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
