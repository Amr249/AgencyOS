import type { Metadata } from "next";
import Link from "next/link";
import {
  getFinancialSummary,
  getMonthlyRevenue,
  getTopClientsByRevenue,
  getRecentInvoices,
  getOutstandingInvoices,
  getProjectsSummary,
  getProjectsByStatus,
  getWeeklyTaskCompletion,
  getOverdueTasks,
  getActiveProjectsWithProgress,
  getNewClientsPerMonth,
  type DateRangeKey,
} from "@/actions/reports";
import { getSarToEgpRate } from "@/lib/currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductivityReportsTab } from "@/components/reports/productivity-reports-tab";
import { ReportsFinancialTab } from "@/app/dashboard/reports/reports-financial-tab";

export const metadata: Metadata = {
  title: "التقارير",
  description: "التقارير المالية وتقارير المشاريع",
};

const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "this_month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "this_quarter", label: "هذا الربع" },
  { value: "this_year", label: "هذه السنة" },
  { value: "all", label: "كل الوقت" },
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
    topClients,
    recentInvoices,
    outstandingRows,
    projectsSummary,
    projectsByStatus,
    weeklyTaskCompletion,
    overdueTasks,
    activeProjectsWithProgress,
    newClientsData,
    rate,
  ] = await Promise.all([
    getFinancialSummary(),
    getMonthlyRevenue(dateRange),
    getTopClientsByRevenue(5),
    getRecentInvoices(8),
    getOutstandingInvoices(),
    getProjectsSummary(),
    getProjectsByStatus(),
    getWeeklyTaskCompletion(),
    getOverdueTasks(),
    getActiveProjectsWithProgress(),
    getNewClientsPerMonth(currentYear),
    getSarToEgpRate(),
  ]);

  const revenueDelta =
    summary.revenueLastMonth > 0
      ? ((summary.revenueThisMonth - summary.revenueLastMonth) / summary.revenueLastMonth) * 100
      : summary.revenueThisMonth > 0
        ? 100
        : 0;

  const totalProfitsInRange = monthlyRevenue.reduce((s, m) => s + m.profits, 0);
  const totalExpensesInRange = monthlyRevenue.reduce((s, m) => s + (m.expenses ?? 0), 0);
  const netProfitInRange = totalProfitsInRange - totalExpensesInRange;
  const totalOutstanding = outstandingRows.reduce((s, r) => s + Number(r.total), 0);

  const topClientsPieData = topClients.map((c) => ({
    clientName: c.clientName ?? "—",
    total: c.totalPaid,
    invoiceCount: c.invoiceCount,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold tracking-tight">التقارير</h1>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2" dir="rtl">
          <TabsTrigger value="financial">التقارير المالية</TabsTrigger>
          <TabsTrigger value="projects">تقارير المشاريع والإنتاجية</TabsTrigger>
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

        <TabsContent value="financial" className="mt-6 space-y-8">
          <ReportsFinancialTab
            rate={rate}
            summary={summary}
            revenueDelta={revenueDelta}
            monthlyRevenue={monthlyRevenue}
            totalProfitsInRange={totalProfitsInRange}
            totalExpensesInRange={totalExpensesInRange}
            netProfitInRange={netProfitInRange}
            topClientsPieData={topClientsPieData}
            recentInvoices={recentInvoices}
            outstandingRows={outstandingRows}
            totalOutstanding={totalOutstanding}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <ProductivityReportsTab
            summary={projectsSummary}
            byStatus={projectsByStatus}
            weeklyCompletion={weeklyTaskCompletion}
            overdueTasks={overdueTasks}
            activeProjects={activeProjectsWithProgress}
            newClientsTotal={newClientsData.total}
            newClientsByMonth={newClientsData.byMonth}
            recentClients={newClientsData.recent}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
