"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutstandingInvoicesTable } from "@/components/reports/outstanding-invoices-table";
import { ClientProfitabilitySection } from "@/components/reports/client-profitability-section";
import { ProjectProfitabilitySection } from "@/components/reports/project-profitability-section";
import { TopProfitableProjectsWidget } from "@/components/reports/top-profitable-projects-widget";
import { TopClientsPieChart } from "@/components/modules/reports/top-clients-pie-chart";
import { ReportsMoney } from "@/components/reports/reports-money";
import {
  ReportTablePaginationBar,
  useReportPagination,
} from "@/components/reports/report-table-pagination";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import type {
  ClientProfitabilityRow,
  ClientProfitabilitySummary,
  OutstandingInvoiceRow,
  ProjectProfitabilityRow,
  RecentInvoiceRow,
} from "@/actions/reports";

const profitabilityTabsListClass =
  "flex h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-lg p-1 sm:w-fit";

const detailsTabsListClass =
  "flex h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-lg p-1 lg:inline-flex lg:w-fit";

type ProfitabilitySubtabsProps = {
  projectProfitabilityRows: ProjectProfitabilityRow[];
  clientProfitability: { rows: ClientProfitabilityRow[]; summary: ClientProfitabilitySummary };
};

export function ReportsProfitabilitySubtabs({
  projectProfitabilityRows,
  clientProfitability,
}: ProfitabilitySubtabsProps) {
  return (
    <section className="space-y-3" aria-labelledby="reports-profitability-heading">
      <h2 id="reports-profitability-heading" className="text-lg font-semibold text-left">
        Profitability
      </h2>
      <Tabs defaultValue="project" className="w-full" dir="ltr">
        <TabsList className={profitabilityTabsListClass}>
          <TabsTrigger value="project" className="flex-none px-3">
            Project profitability
          </TabsTrigger>
          <TabsTrigger value="client" className="flex-none px-3">
            Client profitability
          </TabsTrigger>
        </TabsList>
        <TabsContent value="project" className="mt-4 space-y-4 outline-none">
          <TopProfitableProjectsWidget rows={projectProfitabilityRows} />
          <ProjectProfitabilitySection rows={projectProfitabilityRows} tablePageSize={8} />
        </TabsContent>
        <TabsContent value="client" className="mt-4 outline-none">
          <ClientProfitabilitySection
            rows={clientProfitability.rows}
            summary={clientProfitability.summary}
            tablePageSize={8}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

type FinancialDetailsSubtabsProps = {
  topClientsPieData: { clientName: string; total: number; invoiceCount: number }[];
  recentInvoices: RecentInvoiceRow[];
  outstandingRows: OutstandingInvoiceRow[];
  totalOutstanding: number;
};

function RecentInvoicesPaginatedList({ invoices }: { invoices: RecentInvoiceRow[] }) {
  const pagination = useReportPagination(invoices);
  if (invoices.length === 0) {
    return <p className="text-muted-foreground text-center text-sm">No invoices yet.</p>;
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {pagination.pageItems.map((inv) => (
          <li key={inv.id}>
            <Link
              href={`/dashboard/invoices/${inv.id}`}
              className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-muted/50"
            >
              <Badge
                variant="outline"
                className={INVOICE_STATUS_BADGE_CLASS[inv.status] ?? "shrink-0"}
              >
                {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
              </Badge>
              <span className="shrink-0 text-sm">
                <ReportsMoney amount={Number(inv.total)} iconClassName="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                {inv.clientName ?? "—"}
              </span>
              <span className="shrink-0 font-medium text-primary hover:underline">
                {inv.invoiceNumber}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ReportTablePaginationBar
        page={pagination.page}
        pageSize={pagination.pageSize}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        className="border-t-0 pt-1"
      />
    </div>
  );
}

export function ReportsFinancialDetailsSubtabs({
  topClientsPieData,
  recentInvoices,
  outstandingRows,
  totalOutstanding,
}: FinancialDetailsSubtabsProps) {
  return (
    <section className="space-y-3" aria-labelledby="reports-financial-details-heading">
      <h2 id="reports-financial-details-heading" className="text-lg font-semibold text-left">
        Invoices & clients
      </h2>
      <Tabs defaultValue="outstanding" className="w-full" dir="ltr">
        <TabsList className={detailsTabsListClass}>
          <TabsTrigger value="outstanding" className="flex-none px-3">
            Outstanding invoices
          </TabsTrigger>
          <TabsTrigger value="top-clients" className="flex-none px-3">
            Top clients
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex-none px-3">
            Recent invoices
          </TabsTrigger>
        </TabsList>
        <TabsContent value="outstanding" className="mt-4 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-left">Outstanding invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <OutstandingInvoicesTable rows={outstandingRows} totalOutstanding={totalOutstanding} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="top-clients" className="mt-4 outline-none">
          <TopClientsPieChart data={topClientsPieData} />
        </TabsContent>
        <TabsContent value="recent" className="mt-4 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-left">Recent invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentInvoicesPaginatedList invoices={recentInvoices} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
