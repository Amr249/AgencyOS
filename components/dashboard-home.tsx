"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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
import { TrendingUp, TrendingDown, PlusCircle } from "lucide-react";
import type { DashboardData } from "@/actions/dashboard";
import { UpcomingMilestonesCard } from "@/components/dashboard/upcoming-milestones-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_BADGE_CLASS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_LABELS_AR,
} from "@/types";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { cn } from "@/lib/utils";

type DashboardKpiVariant = "lime" | "dark" | "outline";

function DashboardKpiCard({
  variant,
  title,
  subtitle,
  children,
  valueClassName,
}: {
  variant: DashboardKpiVariant;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  valueClassName?: string;
}) {
  const shell = cn(
    "flex min-h-[148px] flex-col justify-between gap-3 rounded-3xl border p-5 text-start",
    variant === "lime" &&
      "border-transparent bg-[#c8f542] shadow-none [&_.kpi-foot]:text-black/70",
    variant === "dark" &&
      "border-transparent bg-neutral-950 text-white shadow-none dark:bg-black [&_.kpi-foot]:text-white/70",
    variant === "outline" && "border-border bg-card shadow-sm [&_.kpi-foot]:text-muted-foreground"
  );
  const titleCls = cn(
    "text-sm font-medium leading-snug",
    variant === "lime" && "text-black/80",
    variant === "dark" && "text-white/75",
    variant === "outline" && "text-muted-foreground"
  );
  const valueCls = cn(
    "text-3xl font-bold tracking-tight tabular-nums leading-none",
    variant === "lime" && "text-black",
    variant === "dark" && "text-white",
    variant === "outline" && "text-foreground",
    valueClassName
  );

  return (
    <div className={shell}>
      <div className="space-y-2">
        <p className={titleCls}>{title}</p>
        <div className={valueCls}>{children}</div>
      </div>
      {subtitle != null ? <div className="kpi-foot text-xs leading-snug">{subtitle}</div> : null}
    </div>
  );
}

const DONUT_COLORS: Record<string, string> = {
  active: "#22c55e",
  on_hold: "#f59e0b",
  completed: "#6b7280",
  cancelled: "#ef4444",
  lead: "#3b82f6",
  review: "#a855f7",
};

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

/** Plain string for translated sentences (e.g. budget lines). */
function formatMoneyPlain(amount: number, currency: string, locale: string) {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const numLocale = locale === "ar" ? "ar-SA" : "en-US";
  if (currency === "SAR" || currency === "ر.س") {
    return `${rounded.toLocaleString(numLocale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ر.س`;
  }
  try {
    return new Intl.NumberFormat(numLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return String(rounded);
  }
}

function signedNumberClass(n: number): string {
  if (n > 0.005) return "text-green-600";
  if (n < -0.005) return "text-red-600";
  return "text-muted-foreground";
}

export function DashboardHome({ data }: { data: DashboardData }) {
  const chartMd = useMediaQuery("(min-width: 640px)");
  const t = useTranslations("dashboardHome");
  const locale = useLocale();
  const isAr = locale === "ar";
  const projectStatusMap = isAr ? PROJECT_STATUS_LABELS : PROJECT_STATUS_LABELS_EN;
  const invoiceStatusMap = isAr ? INVOICE_STATUS_LABELS_AR : INVOICE_STATUS_LABELS;

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

  const chartProjectCounts = useMemo(
    () =>
      projectStatusCounts.map((e) => ({
        ...e,
        label: projectStatusMap[e.status] ?? e.label,
      })),
    [projectStatusCounts, projectStatusMap]
  );

  const revenueDelta =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : revenueThisMonth > 0
        ? 100
        : 0;

  const profitMarginValueCls =
    profitMargin === null ? "text-white/55" : signedNumberClass(profitMargin);

  return (
    <div className="space-y-8">
      {/* 8 KPI tiles: 4 × 2 — lime / outline / dark / outline pattern (matches hero dashboard cards) */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        dir={isAr ? "rtl" : "ltr"}
      >
        <DashboardKpiCard
          variant="lime"
          title={t("revenueThisMonth")}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1 text-black/75">
              {t("vsLastMonth")}
              {revenueDelta >= 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0 text-emerald-900" />
              ) : (
                <TrendingDown className="h-3 w-3 shrink-0 text-red-900" />
              )}
              <span className={revenueDelta >= 0 ? "font-medium text-emerald-900" : "font-medium text-red-900"}>
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(0)}%
              </span>
            </span>
          }
        >
          {formatCurrency(revenueThisMonth, currency)}
        </DashboardKpiCard>

        <DashboardKpiCard variant="outline" title={t("outstanding")} subtitle={t("unpaidInvoices", { count: outstandingCount })}>
          {formatCurrency(outstandingTotal, currency)}
        </DashboardKpiCard>

        <DashboardKpiCard
          variant="dark"
          title={t("activeProjects")}
          subtitle={
            <Link href="/dashboard/projects?status=active" className="text-white/85 underline-offset-2 hover:underline">
              {t("viewActiveProjects")}
            </Link>
          }
        >
          {activeProjectsCount}
        </DashboardKpiCard>

        <DashboardKpiCard variant="outline" title={t("overdueTasks")} subtitle={t("pastDueHint")} valueClassName="text-red-600">
          {overdueTasksCount}
        </DashboardKpiCard>

        <DashboardKpiCard variant="outline" title={t("netProfitYtd")} subtitle={t("netProfitYtdDesc")} valueClassName={signedNumberClass(totalProfit)}>
          {formatCurrency(totalProfit, currency)}
        </DashboardKpiCard>

        <DashboardKpiCard variant="dark" title={t("profitMargin")} subtitle={t("profitMarginDesc")} valueClassName={profitMarginValueCls}>
          {profitMargin === null ? t("profitMarginEmpty") : `${profitMargin.toFixed(1)}%`}
        </DashboardKpiCard>

        <DashboardKpiCard
          variant="outline"
          title={t("mostProfitableProject")}
          subtitle={
            topProfitableProject ? (
              <Link
                href={`/dashboard/projects/${topProfitableProject.id}`}
                className="truncate font-medium text-primary hover:underline"
              >
                {topProfitableProject.name}
              </Link>
            ) : (
              t("noProjectData")
            )
          }
          valueClassName={topProfitableProject ? signedNumberClass(topProfitableProject.profit) : "text-muted-foreground"}
        >
          {topProfitableProject ? formatCurrency(topProfitableProject.profit, currency) : "—"}
        </DashboardKpiCard>

        <DashboardKpiCard
          variant="lime"
          title={t("mostProfitableClient")}
          subtitle={
            topProfitableClient ? (
              <Link
                href={`/dashboard/clients/${topProfitableClient.id}`}
                className="truncate font-medium text-black/80 underline-offset-2 hover:underline"
              >
                {topProfitableClient.name}
              </Link>
            ) : (
              <span className="text-black/70">{t("noClientData")}</span>
            )
          }
          valueClassName={
            topProfitableClient
              ? cn("text-black", signedNumberClass(topProfitableClient.profit))
              : "text-black/55"
          }
        >
          {topProfitableClient ? formatCurrency(topProfitableClient.profit, currency) : "—"}
        </DashboardKpiCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("revenue12moTitle")}</CardTitle>
            <CardDescription>{t("revenue12moDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMonth.some((m) => m.invoiced > 0 || m.collected > 0) ? (
              <div className="h-52 min-h-48 w-full min-w-0 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueByMonth}
                    margin={{ top: 8, right: 8, left: chartMd ? 0 : -8, bottom: chartMd ? 8 : 4 }}
                  >
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
                    <Bar
                      dataKey="invoiced"
                      name={t("legendInvoiced")}
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={chartMd ? 48 : 32}
                    />
                    <Bar
                      dataKey="collected"
                      name={t("legendCollected")}
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={chartMd ? 48 : 32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-48 items-center justify-center text-sm md:h-[300px]">
                {t("noRevenueYet")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("projectStatusTitle")}</CardTitle>
            <CardDescription>{t("projectStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {chartProjectCounts.length > 0 ? (
              <div className="h-52 min-h-48 w-full min-w-0 md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartProjectCounts}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="38%"
                      outerRadius="72%"
                      paddingAngle={2}
                      label={
                        chartMd ? ({ label, count }: { label: string; count: number }) => `${label}: ${count}` : false
                      }
                    >
                      {chartProjectCounts.map((entry) => (
                        <Cell key={entry.status} fill={DONUT_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-48 items-center justify-center text-sm md:h-[300px]">
                {t("noProjectsYet")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {budgetWarnings.length > 0 ? (
          <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("budgetWarningsTitle")}</CardTitle>
              <CardDescription className="text-xs">{t("budgetWarningsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {budgetWarnings.map((p) => {
                  const amtOver = formatMoneyPlain(Math.abs(p.remaining), currency, locale);
                  const amtLeft = formatMoneyPlain(p.remaining, currency, locale);
                  const budgetLine =
                    p.remaining < 0
                      ? t("budgetUsedOver", {
                          pct: p.percentUsed,
                          amount: amtOver,
                        })
                      : t("budgetUsedLeft", {
                          pct: p.percentUsed,
                          amount: amtLeft,
                        });
                  return (
                    <li key={p.id} className="flex flex-col gap-0.5 text-sm">
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="truncate font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {p.clientName ?? "—"} ·{" "}
                        <span
                          className={
                            p.level === "danger"
                              ? "font-medium text-red-600"
                              : "text-amber-700 dark:text-amber-400"
                          }
                        >
                          {budgetLine}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{t("overdueTasksListTitle")}</CardTitle>
            <CardDescription>{t("overdueTasksListDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length > 0 ? (
              <ul className="space-y-2">
                {overdueTasks.map((task) => (
                  <li key={task.id} className="flex flex-col gap-0.5 text-sm">
                    <Link
                      href={`/dashboard/projects/${task.projectId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {task.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {task.projectName} · <span className="text-red-600">{t("daysOverdue", { days: task.daysOverdue })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noOverdueTasks")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("upcomingDeadlinesTitle")}</CardTitle>
            <CardDescription>{t("withinDays", { days: 14 })}</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingProjects.length > 0 ? (
              <ul className="space-y-2">
                {upcomingProjects.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 text-sm">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {t("dueDateLine", { client: p.clientName ?? "—", date: p.endDate })}
                    </span>
                    <Badge variant="outline" className={PROJECT_STATUS_BADGE_CLASS[p.status] ?? undefined}>
                      {projectStatusMap[p.status] ?? p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noUpcomingDeadlines")}</p>
            )}
          </CardContent>
        </Card>
        <UpcomingMilestonesCard items={upcomingMilestones} />
        <Card>
          <CardHeader>
            <CardTitle>{t("recentInvoicesTitle")}</CardTitle>
            <CardDescription>{t("lastN", { n: 5 })}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length > 0 ? (
              <ul className="space-y-2">
                {recentInvoices.map((i) => (
                  <li key={i.id} className="flex flex-col gap-0.5 text-sm">
                    <Link href="/dashboard/invoices" className="font-medium text-primary hover:underline">
                      {i.invoiceNumber}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {i.clientName ?? "—"} · {formatCurrency(Number(i.total), currency)}
                    </span>
                    <Badge variant="outline">{invoiceStatusMap[i.status] ?? i.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noInvoicesYet")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivity items={recentActivity} />

      <Card>
        <CardHeader>
          <CardTitle>{t("quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild>
              <Link href="/dashboard/projects">
                <PlusCircle className="me-2 h-4 w-4" />
                {t("newProject")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/clients">
                <PlusCircle className="me-2 h-4 w-4" />
                {t("newClient")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/invoices">
                <PlusCircle className="me-2 h-4 w-4" />
                {t("newInvoice")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/workspace">
                <PlusCircle className="me-2 h-4 w-4" />
                {t("newTask")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
