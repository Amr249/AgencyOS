import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  getFinancialSummary,
  getMonthlyRevenue,
  getRecentInvoices,
  getProjectsSummary,
  getProjectsByStatus,
  getWeeklyTaskCompletion,
  getOverdueTasks,
  getActiveProjectsWithProgress,
  getNewClientsPerMonth,
  getMonthlyComparison,
  type DateRangeKey,
} from "@/actions/reports";
import { getTeamCostBreakdownThisMonth } from "@/actions/expenses";
import { getSarToUsdRate } from "@/lib/currency";
import { ReportsDashboardShell } from "@/app/dashboard/reports/reports-dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return {
    title: t("pageTitle"),
    description: t("metaDescription"),
  };
}

type PageProps = {
  searchParams: Promise<{ dateRange?: string }>;
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const { dateRange: dateRangeParam } = await searchParams;
  const dateRange = (dateRangeParam === "this_month" ||
    dateRangeParam === "last_month" ||
    dateRangeParam === "this_quarter" ||
    dateRangeParam === "this_year" ||
    dateRangeParam === "all"
    ? dateRangeParam
    : "this_year") as DateRangeKey;

  const currentYear = new Date().getFullYear();

  const [
    summary,
    monthlyRevenue,
    recentInvoices,
    projectsSummary,
    projectsByStatus,
    weeklyTaskCompletion,
    overdueTasks,
    activeProjectsWithProgress,
    newClientsData,
    teamCostBreakdownResult,
    rate,
    monthlyComparison,
  ] = await Promise.all([
    getFinancialSummary(),
    getMonthlyRevenue(dateRange),
    getRecentInvoices(8),
    getProjectsSummary(),
    getProjectsByStatus(),
    getWeeklyTaskCompletion(),
    getOverdueTasks(),
    getActiveProjectsWithProgress(),
    getNewClientsPerMonth(currentYear),
    getTeamCostBreakdownThisMonth(),
    getSarToUsdRate(),
    getMonthlyComparison(),
  ]);

  const teamCostBreakdown = teamCostBreakdownResult.ok ? teamCostBreakdownResult.data : [];

  const revenueDelta =
    summary.revenueLastMonth > 0
      ? ((summary.revenueThisMonth - summary.revenueLastMonth) / summary.revenueLastMonth) * 100
      : summary.revenueThisMonth > 0
        ? 100
        : 0;

  const totalProfitsInRange = monthlyRevenue.reduce((s, m) => s + m.profits, 0);
  const totalExpensesInRange = monthlyRevenue.reduce((s, m) => s + (m.expenses ?? 0), 0);
  const netProfitInRange = totalProfitsInRange - totalExpensesInRange;

  return (
    <ReportsDashboardShell
      dateRange={dateRange}
      financial={{
        rate,
        summary,
        revenueDelta,
        monthlyRevenue,
        totalProfitsInRange,
        totalExpensesInRange,
        netProfitInRange,
        recentInvoices,
        monthlyComparison,
      }}
      productivity={{
        summary: projectsSummary,
        byStatus: projectsByStatus,
        weeklyCompletion: weeklyTaskCompletion,
        overdueTasks,
        activeProjects: activeProjectsWithProgress,
        newClientsTotal: newClientsData.total,
        newClientsByMonth: newClientsData.byMonth,
        recentClients: newClientsData.recent,
        teamCostBreakdown,
      }}
    />
  );
}
