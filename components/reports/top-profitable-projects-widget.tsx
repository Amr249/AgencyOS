"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsMoney } from "@/components/reports/reports-money";
import type { ProjectProfitabilityRow } from "@/actions/reports";

function topProfitableByProfit(rows: ProjectProfitabilityRow[]): ProjectProfitabilityRow[] {
  return [...rows]
    .filter((r) => r.profit > 0.005)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
}

export function TopProfitableProjectsWidget({ rows }: { rows: ProjectProfitabilityRow[] }) {
  const ranked = React.useMemo(() => topProfitableByProfit(rows), [rows]);
  const maxProfit = ranked[0]?.profit ?? 0;

  return (
    <Card dir="ltr" className="text-left">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Top Profitable Projects</CardTitle>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-muted-foreground text-sm">No profitable projects yet</p>
        ) : (
          <ul className="space-y-4">
            {ranked.map((row, index) => {
              const rank = index + 1;
              const barPct = maxProfit > 0 ? Math.max(8, (row.profit / maxProfit) * 100) : 8;
              return (
                <li key={row.projectId} className="space-y-1.5">
                  <div className="flex items-start gap-3">
                    <span
                      className="text-muted-foreground w-5 shrink-0 pt-0.5 text-xs font-medium tabular-nums"
                      aria-label={`Rank ${rank}`}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/projects/${row.projectId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.projectName}
                          </Link>
                          <p className="text-muted-foreground truncate text-xs">{row.clientName}</p>
                        </div>
                        <div className="shrink-0 text-end">
                          <div className="text-sm font-semibold tabular-nums text-green-600">
                            <ReportsMoney amount={row.profit} iconClassName="h-3.5 w-3.5" />
                          </div>
                          {row.profitMargin != null ? (
                            <p className="text-muted-foreground text-xs tabular-nums">
                              {row.profitMargin.toFixed(1)}% margin
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-green-600 transition-[width]"
                          style={{ width: `${barPct}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
