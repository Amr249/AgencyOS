"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";

type TaskStatusCount = {
  status: string;
  label: string;
  count: number;
  fill: string;
};

type WeeklyCompletion = {
  week: string;
  count: number;
};

type MonthlyEarning = {
  month: string;
  amount: number;
};

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#f59e0b",
  in_review: "#a855f7",
  done: "#22c55e",
  blocked: "#ef4444",
};

const STATUS_AR: Record<string, string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "موقوف",
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export type TaskChartInput = {
  status: string;
  dueDate: string | null;
  updatedAt?: string | null;
};

export type ExpenseChartInput = {
  amount: string;
  date: string;
};

export function MemberTaskCharts({ tasks }: { tasks: TaskChartInput[] }) {
  const weeklyData = React.useMemo<WeeklyCompletion[]>(() => {
    const now = new Date();
    const weeks: WeeklyCompletion[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 7);
      const count = tasks.filter((t) => {
        if (t.status !== "done") return false;
        const d = t.dueDate ? new Date(t.dueDate + "T12:00:00") : null;
        if (!d) return false;
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({ week: `الأسبوع ${8 - i}`, count });
    }
    return weeks;
  }, [tasks]);

  const statusData = React.useMemo<TaskStatusCount[]>(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([status, count]) => ({
      status,
      label: STATUS_AR[status] ?? status,
      count,
      fill: STATUS_COLORS[status] ?? "#6b7280",
    }));
  }, [tasks]);

  const totalTasks = tasks.length;

  const weeklyConfig: ChartConfig = {
    count: { label: "المهام المكتملة", color: "#6366f1" },
  };

  const statusConfig = React.useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const s of statusData) {
      cfg[s.status] = { label: s.label, color: s.fill };
    }
    return cfg;
  }, [statusData]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">إنجاز المهام (آخر 8 أسابيع)</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyData.every((w) => w.count === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد مهام مكتملة حتى الآن.</p>
          ) : (
            <ChartContainer config={weeklyConfig} className="h-[200px] w-full" dir="ltr">
              <BarChart data={weeklyData} margin={{ top: 10, right: 8, left: 8, bottom: 14 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={44} />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">توزيع المهام حسب الحالة</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد مهام.</p>
          ) : (
            <ChartContainer config={statusConfig} className="mx-auto h-[200px] w-full" dir="ltr">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={false}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">
                  {totalTasks}
                </text>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MemberEarningsChart({ expenses }: { expenses: ExpenseChartInput[] }) {
  const monthlyData = React.useMemo<MonthlyEarning[]>(() => {
    const year = new Date().getFullYear();
    const byMonth = new Array<number>(12).fill(0);
    for (const row of expenses) {
      const base = row.date.slice(0, 10);
      const d = new Date(`${base}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year) continue;
      const n = Number(row.amount);
      if (Number.isFinite(n)) byMonth[d.getMonth()] += n;
    }
    return byMonth.map((amount, i) => ({ month: MONTHS_AR[i], amount }));
  }, [expenses]);

  const config: ChartConfig = {
    amount: { label: "المبلغ", color: "#84cc16" },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">تعويضاتي شهرياً ({new Date().getFullYear()})</CardTitle>
      </CardHeader>
      <CardContent>
        {monthlyData.every((m) => m.amount === 0) ? (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد مدفوعات هذا العام.</p>
        ) : (
          <ChartContainer config={config} className="h-[200px] w-full" dir="ltr">
            <BarChart data={monthlyData} margin={{ top: 10, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(String(v))} width={48} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [
                      <span key="v" className="inline-flex items-center gap-1">
                        <SarCurrencyIcon className="h-3.5 w-3.5" />
                        {formatAmount(String(value))}
                      </span>,
                      "المبلغ",
                    ]}
                  />
                }
              />
              <Bar dataKey="amount" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
