"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WinLossStats } from "@/lib/win-loss-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { stats: WinLossStats };

export function WinLossReport({ stats }: Props) {
  const wonReasonData = stats.topWonReasons.map((r) => ({
    name: r.reason.length > 24 ? `${r.reason.slice(0, 24)}…` : r.reason,
    full: r.reason,
    count: r.count,
  }));
  const lostReasonData = stats.topLostReasons.map((r) => ({
    name: r.reason.length > 24 ? `${r.reason.slice(0, 24)}…` : r.reason,
    full: r.reason,
    count: r.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{stats.wonCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{stats.lostCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{stats.winRate}%</p>
            <p className="text-muted-foreground mt-1 text-xs">Among completed + closed clients</p>
          </CardContent>
        </Card>
      </div>

      {stats.monthlyTrend.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Won vs lost by month</CardTitle>
            <p className="text-muted-foreground text-sm">Based on recorded outcome date</p>
          </CardHeader>
          <CardContent className="h-[320px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="won" name="Won" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill="hsl(346, 77%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top win reasons</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {wonReasonData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reasons recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wonReasonData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number, _n, p) => [value, (p?.payload as { full?: string })?.full ?? ""]} />
                  <Bar dataKey="count" name="Count" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top loss reasons</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {lostReasonData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reasons recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lostReasonData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number, _n, p) => [value, (p?.payload as { full?: string })?.full ?? ""]} />
                  <Bar dataKey="count" name="Count" fill="hsl(346, 77%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
