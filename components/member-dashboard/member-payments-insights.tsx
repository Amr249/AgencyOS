"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { MemberSalaryExpenseRow } from "@/actions/member-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { formatAmount } from "@/lib/currency";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const AR = {
  title: "تحليلات المدفوعات",
  subtitle: "تعرّف على الخدمات والمشاريع التي تحقق لك أعلى دخل.",
  primarySection: "عرض الأداء",
  timelineSection: "الدخل الزمني",
  view: "نوع البيانات",
  view1: "الخدمات",
  view2: "المشاريع",
  chartType: "نوع الرسم",
  donut: "Donut",
  columns: "Columns",
  serviceChart: "توزيع الدخل حسب الخدمة",
  projectChart: "الدخل حسب المشروع",
  timelineChart: "المدفوعات خلال أشهر السنة",
  empty: "لا توجد بيانات كافية لعرض الرسم البياني.",
  amount: "المبلغ",
};

type Props = {
  data: MemberSalaryExpenseRow[];
};

type ChartPoint = {
  key: string;
  label: string;
  amount: number;
  fill: string;
};

type TimelinePoint = {
  monthKey: string;
  label: string;
  amount: number;
};

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MemberPaymentsInsights({ data }: Props) {
  const [view, setView] = React.useState<"service" | "project">("service");
  const [chartType, setChartType] = React.useState<"donut" | "columns">("donut");

  const serviceChartData = React.useMemo<ChartPoint[]>(() => {
    const totals = new Map<string, number>();
    for (const row of data) {
      const amount = parseAmount(row.amount);
      const names = (row.serviceNames ?? []).filter(Boolean);
      if (names.length === 0) continue;
      const share = amount / names.length;
      for (const s of names) {
        totals.set(s, (totals.get(s) ?? 0) + share);
      }
    }
    return [...totals.entries()]
      .map(([label, amount], i) => ({
        key: label,
        label,
        amount,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const projectChartData = React.useMemo<ChartPoint[]>(() => {
    const totals = new Map<string, number>();
    for (const row of data) {
      const amount = parseAmount(row.amount);
      const project = row.projectName?.trim() || "بدون مشروع";
      totals.set(project, (totals.get(project) ?? 0) + amount);
    }
    return [...totals.entries()]
      .map(([label, amount], i) => ({
        key: label,
        label,
        amount,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data]);

  const servicesConfig = React.useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const row of serviceChartData) {
      cfg[row.key] = { label: row.label, color: row.fill };
    }
    return cfg;
  }, [serviceChartData]);

  const projectsConfig = React.useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const row of projectChartData) {
      cfg[row.key] = { label: row.label, color: row.fill };
    }
    return cfg;
  }, [projectChartData]);

  const timelineData = React.useMemo<TimelinePoint[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const byMonth = new Array<number>(12).fill(0);
    for (const row of data) {
      const base = row.date.slice(0, 10);
      const d = new Date(`${base}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year) continue;
      byMonth[d.getMonth()] += parseAmount(row.amount);
    }
    return byMonth.map((amount, monthIndex) => ({
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        label: MONTHS_AR[monthIndex],
        amount,
      }));
  }, [data]);

  const timelineConfig = React.useMemo<ChartConfig>(() => ({
    amount: { label: AR.amount, color: "var(--chart-1)" },
  }), []);

  const activeChartData = view === "service" ? serviceChartData : projectChartData;
  const activeChartConfig = view === "service" ? servicesConfig : projectsConfig;
  const activeChartTitle = view === "service" ? AR.serviceChart : AR.projectChart;

  return (
    <div className="space-y-4" dir="rtl" lang="ar">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{AR.title}</CardTitle>
          <p className="text-muted-foreground text-sm">{AR.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{AR.view}</p>
              <Select value={view} onValueChange={(v) => setView(v as "service" | "project")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">{AR.view1}</SelectItem>
                  <SelectItem value="project">{AR.view2}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{AR.chartType}</p>
              <Select value={chartType} onValueChange={(v) => setChartType(v as "donut" | "columns")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="donut">{AR.donut}</SelectItem>
                  <SelectItem value="columns">{AR.columns}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{AR.primarySection}</CardTitle>
              </CardHeader>
              <CardContent>
                {activeChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">{AR.empty}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">{activeChartTitle}</p>
                    {chartType === "donut" ? (
                      <ChartContainer config={activeChartConfig} className="mx-auto h-64 w-full" dir="ltr">
                        <PieChart>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => [
                                  <span key="value" className="inline-flex items-center gap-1">
                                    <SarCurrencyIcon className="h-3.5 w-3.5" />
                                    {formatAmount(String(value))}
                                  </span>,
                                  String(name),
                                ]}
                              />
                            }
                          />
                          <Pie data={activeChartData} dataKey="amount" nameKey="label" innerRadius={54} outerRadius={92} paddingAngle={2}>
                            {activeChartData.map((entry) => (
                              <Cell key={entry.key} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <ChartContainer config={activeChartConfig} className="h-64 w-full" dir="ltr">
                        <BarChart data={activeChartData} margin={{ top: 10, right: 8, left: 8, bottom: 14 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={52} tick={{ fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(String(v)).replace(" SAR", "")} width={48} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => [
                                  <span key="value" className="inline-flex items-center gap-1">
                                    <SarCurrencyIcon className="h-3.5 w-3.5" />
                                    {formatAmount(String(value))}
                                  </span>,
                                  AR.amount,
                                ]}
                              />
                            }
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {activeChartData.map((entry) => (
                              <Cell key={entry.key} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{AR.timelineSection}</CardTitle>
              </CardHeader>
              <CardContent>
                {timelineData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">{AR.empty}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">{AR.timelineChart}</p>
                    <ChartContainer config={timelineConfig} className="h-64 w-full" dir="ltr">
                      <BarChart data={timelineData} margin={{ top: 10, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(String(v)).replace(" SAR", "")} width={48} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => [
                                <span key="value" className="inline-flex items-center gap-1">
                                  <SarCurrencyIcon className="h-3.5 w-3.5" />
                                  {formatAmount(String(value))}
                                </span>,
                                AR.amount,
                              ]}
                            />
                          }
                        />
                        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
