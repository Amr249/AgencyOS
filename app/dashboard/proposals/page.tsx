import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getProposals,
  getProposalStats,
  getProposalStatsForCharts,
} from "@/actions/proposals";
import { ProposalsListView } from "@/components/modules/proposals/proposals-list-view";

export const metadata: Metadata = {
  title: "العروض",
  description: "عروض مستقل والمشاريع المقدمة",
};

type PageProps = {
  searchParams: Promise<{ status?: string; dateRange?: string; search?: string }>;
};

export default async function ProposalsPage({ searchParams }: PageProps) {
  const { status, dateRange, search } = await searchParams;
  const [listResult, statsResult, chartsResult] = await Promise.all([
    getProposals({
      status: status ?? undefined,
      dateRange: dateRange ?? undefined,
      search: search ?? undefined,
    }),
    getProposalStats(),
    getProposalStatsForCharts(),
  ]);

  if (!listResult.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">العروض المقدمة</h1>
        <p className="text-destructive">{listResult.error}</p>
      </div>
    );
  }

  const proposals = listResult.data;
  const stats = statsResult.ok
    ? statsResult.data
    : {
        total: 0,
        won: 0,
        wonPercent: 0,
        pending: 0,
        totalWonValue: 0,
      };
  const chartData = chartsResult.ok
    ? chartsResult.data
    : { byMonth: [], statusDistribution: [] };

  return (
    <Suspense fallback={<div className="text-muted-foreground">جاري التحميل…</div>}>
      <ProposalsListView
        proposals={proposals}
        stats={stats}
        chartData={chartData}
      />
    </Suspense>
  );
}
