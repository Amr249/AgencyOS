import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getProposals,
  getProposalStats,
  getProposalStatsForCharts,
} from "@/actions/proposals";
import { getServices } from "@/actions/services";
import { FeatureUpgradeCard } from "@/components/feature-upgrade-card";
import { ProposalsListView } from "@/components/modules/proposals/proposals-list-view";
import { hasFeature } from "@/lib/features";
import { requireAgencyOrganization } from "@/lib/org-session";

export const metadata: Metadata = {
  title: "Proposals",
  description: "Mostaql and other submitted proposals",
};

type PageProps = {
  searchParams: Promise<{ status?: string; dateRange?: string; search?: string }>;
};

export default async function ProposalsPage({ searchParams }: PageProps) {
  const ctx = await requireAgencyOrganization();
  const allowed = await hasFeature(ctx.organizationId, "proposals");
  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <FeatureUpgradeCard variant="proposals" />
      </div>
    );
  }

  const { status, dateRange, search } = await searchParams;
  const [listResult, statsResult, chartsResult, servicesResult] = await Promise.all([
    getProposals({
      status: status ?? undefined,
      dateRange: dateRange ?? undefined,
      search: search ?? undefined,
    }),
    getProposalStats(),
    getProposalStatsForCharts(),
    getServices(),
  ]);

  if (!listResult.ok) {
    return (
      <div className="space-y-4" dir="ltr">
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
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
    : { byMonth: [], statusDistribution: [], serviceDistribution: [] };

  const serviceOptions =
    servicesResult.ok
      ? servicesResult.data
          .filter((s) => s.status === "active")
          .map((s) => ({ id: s.id, name: s.name }))
      : [];

  return (
    <Suspense fallback={<div className="text-muted-foreground" dir="ltr">Loading…</div>}>
      <ProposalsListView
        proposals={proposals}
        stats={stats}
        chartData={chartData}
        serviceOptions={serviceOptions}
      />
    </Suspense>
  );
}
