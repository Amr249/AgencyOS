import type { Metadata } from "next";
import Link from "next/link";
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
import { getSarToEgpRate } from "@/lib/currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductivityReportsTab } from "@/components/reports/productivity-reports-tab";
import { ReportsFinancialTab } from "@/app/dashboard/reports/reports-financial-tab";

export const metadata: Metadata = {
  title: "Reports",
  description: "Financial and project reports",
};

const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
];

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
    getSarToEgpRate(),
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
    <div className="space-y-6 text-left" dir="ltr">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="flex w-full overflow-x-auto p-1 gap-1 flex-nowrap whitespace-nowrap max-w-full md:grid md:max-w-md md:grid-cols-2" dir="ltr">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="projects">Projects &amp; productivity</TabsTrigger>
        </TabsList>

        {/* Date range filter — below tabs, only for Financial */}
        <div className="mt-4 flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`/dashboard/reports?dateRange=${opt.value}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                dateRange === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 hover:bg-muted border-transparent"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <ReportsFinancialTab
            rate={rate}
            summary={summary}
            revenueDelta={revenueDelta}
            monthlyRevenue={monthlyRevenue}
            totalProfitsInRange={totalProfitsInRange}
            totalExpensesInRange={totalExpensesInRange}
            netProfitInRange={netProfitInRange}
            recentInvoices={recentInvoices}
            monthlyComparison={monthlyComparison}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <ProductivityReportsTab
            summary={projectsSummary}
            byStatus={projectsByStatus}
            weeklyCompletion={weeklyTaskCompletion}
            overdueTasks={overdueTasks}
            activeProjects={activeProjectsWithProgress}
            newClientsTotal={newClientsData.total}
            newClientsByMonth={newClientsData.byMonth}
            recentClients={newClientsData.recent}
            teamCostBreakdown={teamCostBreakdown}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
