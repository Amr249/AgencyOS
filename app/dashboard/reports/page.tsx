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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RevenueChartSection } from "@/components/reports/revenue-chart-section";
import { OutstandingInvoicesTable } from "@/components/reports/outstanding-invoices-table";
import { ProductivityReportsTab } from "@/components/reports/productivity-reports-tab";
import { TopClientsPieChart } from "@/components/modules/reports/top-clients-pie-chart";
import { formatBudgetSAR } from "@/lib/utils";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { TrendingUp, TrendingDown } from "lucide-react";

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
          {/* Section 1 — KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-right">إيرادات هذا الشهر</CardTitle>
              </CardHeader>
              <CardContent className="text-right">
                <p className="text-2xl font-bold">{formatBudgetSAR(String(summary.revenueThisMonth))}</p>
                <p className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-right">إجمالي الأرباح هذه السنة</CardTitle>
              </CardHeader>
              <CardContent className="text-right">
                <p className="text-2xl font-bold">{formatBudgetSAR(String(summary.totalCollectedThisYear))}</p>
                <p className="text-muted-foreground text-xs">حسب تاريخ الاستلام (paid_at)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-right">المستحق حالياً</CardTitle>
              </CardHeader>
              <CardContent className="text-right">
                <p className="text-2xl font-bold">{formatBudgetSAR(String(summary.outstandingTotal))}</p>
                <p className="text-muted-foreground text-xs">فواتير غير مدفوعة</p>
              </CardContent>
            </Card>
          </div>

          {/* Section 2 — Revenue Chart (monthly bar or daily area) */}
          <RevenueChartSection
            monthlyRevenue={monthlyRevenue}
            totalProfitsInRange={totalProfitsInRange}
            totalExpensesInRange={totalExpensesInRange}
            netProfitInRange={netProfitInRange}
          />

          {/* Section 3 — Two columns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TopClientsPieChart data={topClientsPieData} />
            <Card>
              <CardHeader>
                <CardTitle className="text-right">آخر الفواتير</CardTitle>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">لا توجد فواتير بعد.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentInvoices.map((inv) => (
                      <li key={inv.id}>
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="flex items-center gap-2 rounded-lg p-2 text-right hover:bg-muted/50"
                        >
                          <Badge
                            variant="outline"
                            className={INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "shrink-0"}
                          >
                            {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                          </Badge>
                          <span className="shrink-0 text-sm">{formatBudgetSAR(inv.total)}</span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">{inv.clientName ?? "—"}</span>
                          <span className="font-medium text-primary shrink-0 hover:underline">{inv.invoiceNumber}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section 4 — Outstanding Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-right">الفواتير المستحقة</CardTitle>
            </CardHeader>
            <CardContent>
              <OutstandingInvoicesTable rows={outstandingRows} totalOutstanding={totalOutstanding} />
            </CardContent>
          </Card>
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
