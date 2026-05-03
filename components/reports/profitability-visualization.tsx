"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, Download, LayoutGrid, PieChart } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPie,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

import {
  getClientProfitability,
  getProjectProfitability,
  getServiceProfitability,
  type ClientProfitabilityRow,
  type ProfitabilityDateRange,
  type ProjectProfitabilityRow,
  type ServiceProfitabilityAnalyticsRow,
} from "@/actions/reports";
import { useReportsCurrency } from "@/components/reports/reports-currency-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMediaQuery } from "@/hooks/use-media-query";
import { downloadReportPdf } from "@/lib/reports-pdf-download";
import { cn } from "@/lib/utils";

const REV_GREEN = "#22c55e";
const EXP_RED = "#ef4444";

/** Max visible characters for entity names in charts (full names still in tooltips via fullName). */
const DISPLAY_NAME_MAX = 48;

/** Distinct colors for treemap cells and donut slices (avoid green-only gradients). */
const VIZ_CATEGORY_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
  "#0d9488",
  "#b45309",
  "#4f46e5",
  "#dc2626",
  "#0891b2",
  "#9333ea",
  "#0369a1",
  "#4d7c0f",
  "#be123c",
  "#475569",
] as const;

type DataKind = "projects" | "clients" | "services";
type ChartKind = "bar" | "treemap" | "donut";
type PeriodKind = "all" | "year" | "quarter" | "month" | "last_month" | "custom";

type VizRow = {
  id: string;
  name: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number | null;
};

function profitabilityRangeFromPeriod(
  period: PeriodKind,
  custom: { from?: Date; to?: Date }
): ProfitabilityDateRange | undefined {
  const now = new Date();
  if (period === "all") return undefined;
  if (period === "year") {
    return {
      dateFrom: format(startOfYear(now), "yyyy-MM-dd"),
      dateTo: format(endOfYear(now), "yyyy-MM-dd"),
    };
  }
  if (period === "quarter") {
    return {
      dateFrom: format(startOfQuarter(now), "yyyy-MM-dd"),
      dateTo: format(endOfQuarter(now), "yyyy-MM-dd"),
    };
  }
  if (period === "month") {
    return {
      dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }
  if (period === "last_month") {
    const lm = subMonths(now, 1);
    return {
      dateFrom: format(startOfMonth(lm), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(lm), "yyyy-MM-dd"),
    };
  }
  if (period === "custom" && custom.from && custom.to) {
    const a = custom.from <= custom.to ? custom.from : custom.to;
    const b = custom.from <= custom.to ? custom.to : custom.from;
    return { dateFrom: format(a, "yyyy-MM-dd"), dateTo: format(b, "yyyy-MM-dd") };
  }
  return undefined;
}

function mapProjects(rows: ProjectProfitabilityRow[]): VizRow[] {
  return rows.map((r) => ({
    id: r.projectId,
    name: r.projectName || "—",
    totalRevenue: r.totalRevenue,
    totalExpenses: r.totalExpenses,
    profit: r.profit,
    profitMargin: r.profitMargin,
  }));
}

function mapClients(rows: ClientProfitabilityRow[]): VizRow[] {
  return rows.map((r) => ({
    id: r.clientId,
    name: r.companyName ?? "—",
    totalRevenue: r.totalRevenue,
    totalExpenses: r.totalExpenses,
    profit: r.profit,
    profitMargin: r.totalRevenue > 0 ? r.profitMargin : null,
  }));
}

function mapServices(rows: ServiceProfitabilityAnalyticsRow[]): VizRow[] {
  return rows.map((r) => ({
    id: r.serviceId,
    name: r.serviceName || "—",
    totalRevenue: r.totalRevenue,
    totalExpenses: r.totalExpenses,
    profit: r.profit,
    profitMargin: r.totalRevenue > 0 ? r.profitMargin : null,
  }));
}

function truncateName(s: string, max: number = DISPLAY_NAME_MAX): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function treemapFillForCell(name: string, index?: number): string {
  if (typeof index === "number" && index >= 0 && Number.isFinite(index)) {
    return VIZ_CATEGORY_COLORS[index % VIZ_CATEGORY_COLORS.length]!;
  }
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i)! + ((h << 5) - h);
  }
  return VIZ_CATEGORY_COLORS[Math.abs(h) % VIZ_CATEGORY_COLORS.length]!;
}

type TreemapPayload = {
  name?: string;
  revenue?: number;
  expenses?: number;
  profit?: number;
  margin?: number | null;
  sharePercent?: number;
};

/** Money + currency for HTML tooltips / foreignObject (plain img for SAR inside SVG). */
function ChartMoneyInline({
  amount,
  currency,
  formatNumber,
  className,
}: {
  amount: number;
  currency: "SAR" | "USD";
  formatNumber: (n: number) => string;
  className?: string;
}) {
  if (currency === "USD") {
    return (
      <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} dir="ltr">
        {formatNumber(amount)}
        <span className="opacity-90">USD</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", className)} dir="ltr">
      {formatNumber(amount)}
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG foreignObject cannot use next/image */}
      <img
        src="/Saudi_Riyal_Symbol.png"
        alt=""
        width={12}
        height={12}
        className="inline-block h-3 w-auto object-contain"
      />
    </span>
  );
}

function createTreemapCellRenderer(
  formatNumber: (n: number) => string,
  currency: "SAR" | "USD"
) {
  return function TreemapCell(props: {
    depth?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    index?: number;
    payload?: TreemapPayload;
  }) {
    const { depth = 0, x = 0, y = 0, width = 0, height = 0, name, index, payload } = props;
    if (depth === 0) {
      return <g />;
    }
    if (width < 4 || height < 4) return <g />;
    const fill = treemapFillForCell(String(name ?? ""), index);
    const labelColor = "#ffffff";
    const share = payload?.sharePercent;
    const shareStr = share != null && Number.isFinite(share) ? ` (${share.toFixed(1)}%)` : "";
    const showLabel = width > 56 && height > 28;
    const reserveForPct = shareStr.length > 0 ? Math.min(shareStr.length + 2, 14) : 0;
    const labelMax =
      width > 180
        ? Math.max(12, DISPLAY_NAME_MAX - reserveForPct)
        : width > 120
          ? Math.max(8, 36 - reserveForPct)
          : Math.max(6, 24 - reserveForPct);
    const titleLine = `${truncateName(String(name ?? ""), labelMax)}${shareStr}`;
    const foW = Math.max(0, width - 8);
    const foH = 18;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke="hsl(var(--background))"
          strokeWidth={1}
        />
        {showLabel ? (
          <text
            x={x + 4}
            y={y + 14}
            fill={labelColor}
            stroke="rgba(15,23,42,0.35)"
            strokeWidth={0.45}
            paintOrder="stroke"
            fontSize={11}
            fontWeight={600}
          >
            {titleLine}
          </text>
        ) : null}
        {showLabel && height > 40 && payload?.profit != null ? (
          <foreignObject x={x + 4} y={y + 18} width={foW} height={foH}>
            <div
              className="flex items-center text-[10px] leading-none text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.75)]"
              dir="ltr"
              lang="en"
            >
              <ChartMoneyInline
                amount={payload.profit}
                currency={currency}
                formatNumber={formatNumber}
              />
            </div>
          </foreignObject>
        ) : null}
      </g>
    );
  };
}

export function ProfitabilityVisualization() {
  const { formatNumber, currency } = useReportsCurrency();
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("reports.profitability");
  const dateLocale = isAr ? arSA : enUS;
  const selectDir = isAr ? "rtl" : "ltr";
  const isLgChart = useMediaQuery("(min-width: 1024px)");
  const isSmChart = useMediaQuery("(min-width: 640px)");
  const barYAxisWidth = isLgChart ? 268 : isSmChart ? 168 : 96;
  const [dataType, setDataType] = useState<DataKind>("projects");
  const [chartType, setChartType] = useState<ChartKind>("bar");
  const [period, setPeriod] = useState<PeriodKind>("all");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [rows, setRows] = useState<VizRow[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => profitabilityRangeFromPeriod(period, customRange),
    [period, customRange.from, customRange.to]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (dataType === "projects") {
        const res = await getProjectProfitability(range);
        if (!res.ok) {
          setRows([]);
          toast.error(t("toastLoadProjects"));
          return;
        }
        setRows(mapProjects(res.data));
        return;
      }
      if (dataType === "clients") {
        const res = await getClientProfitability(range);
        if (!res.ok) {
          setRows([]);
          toast.error(t("toastLoadClients"));
          return;
        }
        setRows(mapClients(res.data));
        return;
      }
      const res = await getServiceProfitability(range);
      if (!res.ok) {
        setRows([]);
        toast.error(t("toastLoadServices"));
        return;
      }
      setRows(mapServices(res.data));
    } finally {
      setLoading(false);
    }
  }, [dataType, range?.dateFrom, range?.dateTo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const n = rows.length;
    let rev = 0;
    let exp = 0;
    for (const r of rows) {
      rev += r.totalRevenue;
      exp += r.totalExpenses;
    }
    const net = Math.round((rev - exp) * 100) / 100;
    return { n, rev, exp, net };
  }, [rows]);

  const barData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 10);
    return sorted.map((r) => ({
      name: truncateName(r.name),
      fullName: r.name,
      revenue: r.totalRevenue,
      expenses: r.totalExpenses,
      profit: r.profit,
      margin: r.profitMargin,
    }));
  }, [rows]);

  /** Recharts Treemap expects a flat array as `data` (not a nested root wrapper); use type="flat". */
  const treemapFlat = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 40);
    const totalSize = sorted.reduce((s, r) => s + Math.max(Math.abs(r.profit), 0.01), 0);
    return sorted.map((r) => {
      const size = Math.max(Math.abs(r.profit), 0.01);
      const sharePercent = totalSize > 0 ? (size / totalSize) * 100 : 0;
      return {
        name: r.name,
        size,
        revenue: r.totalRevenue,
        expenses: r.totalExpenses,
        profit: r.profit,
        margin: r.profitMargin,
        sharePercent,
      };
    });
  }, [rows]);

  const donutData = useMemo(() => {
    const positive = rows.filter((r) => r.profit > 0.0001);
    const sorted = [...positive].sort((a, b) => b.profit - a.profit);
    const total = sorted.reduce((s, r) => s + r.profit, 0);
    return sorted.map((r) => {
      const pct = total > 0 ? (r.profit / total) * 100 : 0;
      return {
        name: `${truncateName(r.name)} (${pct.toFixed(1)}%)`,
        fullName: r.name,
        value: r.profit,
        percent: pct,
      };
    });
  }, [rows]);

  const TreemapCell = useMemo(
    () => createTreemapCellRenderer(formatNumber, currency),
    [formatNumber, currency]
  );

  const emptyLabel =
    dataType === "projects"
      ? t("emptyProjects")
      : dataType === "clients"
        ? t("emptyClients")
        : t("emptyServices");

  const handlePdf = async () => {
    try {
      const type =
        dataType === "projects"
          ? "project-profitability"
          : dataType === "clients"
            ? "client-profitability"
            : "service-profitability";
      await downloadReportPdf({
        type,
        dateFrom: range?.dateFrom,
        dateTo: range?.dateTo,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toastPdfFailed"));
    }
  };

  const SarAmount = ({ amount, className }: { amount: number; className?: string }) => {
    if (currency === "USD") {
      return <span className={cn("tabular-nums", className)}>{formatNumber(amount)} USD</span>;
    }
    return (
      <span className={cn("inline-flex items-center gap-1 tabular-nums", className)} dir="ltr">
        {formatNumber(amount)}
        <SarCurrencyIcon className="h-4 w-4 shrink-0" />
      </span>
    );
  };

  return (
    <Card
      className="w-full border shadow-sm text-start [unicode-bidi:isolate]"
      dir={isAr ? "rtl" : "ltr"}
      lang={locale}
    >
      <CardContent
        className="space-y-4 p-4 pt-5 text-start md:p-6"
        dir={isAr ? "rtl" : "ltr"}
        lang={locale}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-start text-lg font-semibold tracking-tight">{t("title")}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 self-start lg:self-auto"
            onClick={() => void handlePdf()}
          >
            <Download className="h-4 w-4" />
            {t("downloadPdf")}
          </Button>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("sectionData")}
            </span>
            <ToggleGroup
              type="single"
              value={dataType}
              onValueChange={(v) => v && setDataType(v as DataKind)}
              variant="outline"
              size="sm"
              spacing={0}
              className="justify-start"
            >
              <ToggleGroupItem value="projects" aria-label={t("ariaProjects")}>
                {t("dataProjects")}
              </ToggleGroupItem>
              <ToggleGroupItem value="clients" aria-label={t("ariaClients")}>
                {t("dataClients")}
              </ToggleGroupItem>
              <ToggleGroupItem value="services" aria-label={t("ariaServices")}>
                {t("dataServices")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("sectionChart")}
            </span>
            <ToggleGroup
              type="single"
              value={chartType}
              onValueChange={(v) => v && setChartType(v as ChartKind)}
              variant="outline"
              size="sm"
              spacing={0}
              className="justify-start"
            >
              <ToggleGroupItem value="bar" aria-label={t("ariaBar")} className="gap-1.5 px-2.5">
                <BarChart3 className="h-4 w-4" />
                {t("chartBar")}
              </ToggleGroupItem>
              <ToggleGroupItem value="treemap" aria-label={t("ariaTreemap")} className="gap-1.5 px-2.5">
                <LayoutGrid className="h-4 w-4" />
                {t("chartTreemap")}
              </ToggleGroupItem>
              <ToggleGroupItem value="donut" aria-label={t("ariaDonut")} className="gap-1.5 px-2.5">
                <PieChart className="h-4 w-4" />
                {t("chartDonut")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[220px]">
              <span className="text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sectionPeriod")}
              </span>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKind)}>
                <SelectTrigger className="w-full min-w-0" dir={selectDir}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={selectDir} className="text-start">
                  <SelectItem value="all">{t("periodAll")}</SelectItem>
                  <SelectItem value="year">{t("periodYear")}</SelectItem>
                  <SelectItem value="quarter">{t("periodQuarter")}</SelectItem>
                  <SelectItem value="month">{t("periodMonth")}</SelectItem>
                  <SelectItem value="last_month">{t("periodLastMonth")}</SelectItem>
                  <SelectItem value="custom">{t("periodCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "custom" ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1 text-start">
                    <span className="text-xs text-muted-foreground">{t("customFrom")}</span>
                    <DatePickerAr
                      value={customRange.from}
                      onChange={(d) => setCustomRange((p) => ({ ...p, from: d }))}
                      direction={isAr ? "rtl" : "ltr"}
                      locale={dateLocale}
                      popoverAlign={isAr ? "end" : "start"}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 text-start">
                    <span className="text-xs text-muted-foreground">{t("customTo")}</span>
                    <DatePickerAr
                      value={customRange.to}
                      onChange={(d) => setCustomRange((p) => ({ ...p, to: d }))}
                      direction={isAr ? "rtl" : "ltr"}
                      locale={dateLocale}
                      popoverAlign={isAr ? "end" : "start"}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Card className="shadow-none">
            <CardContent className="p-3 text-start">
              <p className="text-xs font-medium text-muted-foreground">{t("kpiItems")}</p>
              <p className="text-xl font-bold tabular-nums">{loading ? "—" : summary.n}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-start">
              <p className="text-xs font-medium text-muted-foreground">{t("kpiRevenue")}</p>
              <p className={cn("text-xl font-bold", loading && "text-muted-foreground")}>
                {loading ? "—" : <SarAmount amount={summary.rev} />}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-start">
              <p className="text-xs font-medium text-muted-foreground">{t("kpiExpenses")}</p>
              <p className={cn("text-xl font-bold", loading && "text-muted-foreground")}>
                {loading ? "—" : <SarAmount amount={summary.exp} />}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-start">
              <p className="text-xs font-medium text-muted-foreground">{t("kpiNetProfit")}</p>
              <p
                className={cn(
                  "text-xl font-bold",
                  loading && "text-muted-foreground",
                  !loading && summary.net >= 0 && "text-green-600",
                  !loading && summary.net < 0 && "text-red-600"
                )}
              >
                {loading ? "—" : <SarAmount amount={summary.net} />}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="min-h-[320px] w-full rounded-lg border bg-muted/20 p-2 text-start md:min-h-[420px] md:p-3 lg:min-h-[450px]">
          {loading ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground md:h-[400px]">
              {t("loading")}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground flex h-[300px] items-center justify-center text-sm md:h-[400px]">{emptyLabel}</p>
          ) : chartType === "bar" ? (
            <div className="h-[300px] w-full md:h-[400px] lg:h-[420px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barData}
                  margin={{
                    top: 8,
                    right: isSmChart ? 16 : 8,
                    left: isSmChart ? 12 : 4,
                    bottom: 8,
                  }}
                  className="text-xs"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
                  <XAxis
                    type="number"
                    tick={(tickProps) => {
                      const { x, y, payload } = tickProps as {
                        x: number;
                        y: number;
                        payload: { value: number };
                      };
                      const foW = isSmChart ? 92 : 72;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <foreignObject x={-(foW - 8)} y={2} width={foW} height={22}>
                            <div
                              className="flex h-[22px] items-center justify-end gap-0.5 text-[10px] text-muted-foreground tabular-nums"
                              dir="ltr"
                              lang="en"
                            >
                              <ChartMoneyInline
                                amount={Number(payload?.value)}
                                currency={currency}
                                formatNumber={formatNumber}
                              />
                            </div>
                          </foreignObject>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={barYAxisWidth}
                    interval={0}
                    tick={{ fontSize: isSmChart ? 10 : 9 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as (typeof barData)[0];
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-start text-xs text-popover-foreground shadow-md">
                          <p className="mb-1 font-semibold">{d.fullName}</p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipRevenue")}{" "}
                            <ChartMoneyInline
                              amount={d.revenue}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipExpenses")}{" "}
                            <ChartMoneyInline
                              amount={d.expenses}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipProfit")}{" "}
                            <ChartMoneyInline
                              amount={d.profit}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p>
                            {t("tooltipMargin")}{" "}
                            {d.margin == null ? "—" : `${d.margin.toFixed(1)}%`}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t("legendRevenue")}
                    fill={REV_GREEN}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={isSmChart ? 28 : 22}
                  />
                  <Bar
                    dataKey="expenses"
                    name={t("legendExpenses")}
                    fill={EXP_RED}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={isSmChart ? 28 : 22}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : chartType === "treemap" ? (
            <div className="h-[300px] w-full md:h-[400px] lg:h-[420px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapFlat}
                  dataKey="size"
                  type="flat"
                  aspectRatio={4 / 3}
                  stroke="transparent"
                  isAnimationActive={false}
                  content={<TreemapCell />}
                >
                  <Tooltip
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as TreemapPayload | undefined;
                      if (!p?.name) return null;
                      return (
                        <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-start text-xs text-popover-foreground shadow-md">
                          <p className="mb-1 font-semibold">
                            {p.name}
                            {p.sharePercent != null && Number.isFinite(p.sharePercent)
                              ? ` (${p.sharePercent.toFixed(1)}%)`
                              : ""}
                          </p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipRevenue")}{" "}
                            <ChartMoneyInline
                              amount={p.revenue ?? 0}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipExpenses")}{" "}
                            <ChartMoneyInline
                              amount={p.expenses ?? 0}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p className="flex flex-wrap items-center gap-1">
                            {t("tooltipProfit")}{" "}
                            <ChartMoneyInline
                              amount={p.profit ?? 0}
                              currency={currency}
                              formatNumber={formatNumber}
                            />
                          </p>
                          <p>
                            {t("tooltipMargin")}{" "}
                            {p.margin == null ? "—" : `${Number(p.margin).toFixed(1)}%`}
                          </p>
                        </div>
                      );
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          ) : donutData.length === 0 ? (
            <p className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground sm:min-h-[260px]">
              {t("emptyDonut")}
            </p>
          ) : (
            <div
              className="flex w-full flex-col items-center gap-5 py-1 lg:flex-row lg:items-center lg:justify-center lg:gap-8 lg:py-2"
              dir="ltr"
            >
              <div
                className={cn(
                  "relative mx-auto w-full shrink-0",
                  "h-[min(72vw,300px)] max-h-[340px] min-h-[240px] max-w-[min(100%,340px)]",
                  "sm:h-[min(64vw,320px)] sm:max-h-[380px] sm:max-w-[380px]",
                  "md:h-[min(52vw,360px)] md:max-h-[400px] md:max-w-[420px]",
                  "lg:mx-0 lg:h-[360px] lg:w-[360px] lg:min-h-[360px] lg:max-h-[400px] lg:max-w-[400px]"
                )}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="42%"
                      outerRadius="78%"
                      paddingAngle={1}
                    >
                      {donutData.map((d, i) => (
                        <Cell
                          key={d.fullName}
                          fill={VIZ_CATEGORY_COLORS[i % VIZ_CATEGORY_COLORS.length]!}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload as {
                          fullName?: string;
                          name?: string;
                          value: number;
                          percent: number;
                        };
                        return (
                          <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-start text-xs text-popover-foreground shadow-md">
                            <p className="mb-1 font-semibold">{p.fullName ?? p.name}</p>
                            <p className="flex flex-wrap items-center gap-1">
                              <ChartMoneyInline
                                amount={p.value}
                                currency={currency}
                                formatNumber={formatNumber}
                              />
                              <span className="text-muted-foreground">
                                {t("donutPercentOfPositive", {
                                  pct: p.percent != null ? p.percent.toFixed(1) : "0.0",
                                })}
                              </span>
                            </p>
                          </div>
                        );
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center px-3"
                  aria-hidden
                >
                  <div className="max-w-42 text-center sm:max-w-48">
                    <div className="text-foreground flex flex-wrap items-center justify-center gap-1 text-sm font-semibold tabular-nums sm:text-base">
                      <ChartMoneyInline
                        amount={rows.reduce((s, r) => s + r.profit, 0)}
                        currency={currency}
                        formatNumber={formatNumber}
                      />
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">
                      {t("netProfitAll")}
                    </p>
                  </div>
                </div>
              </div>

              <ul
                className={cn(
                  "grid w-full max-w-2xl grid-cols-1 gap-x-8 gap-y-2.5 px-1 sm:grid-cols-2",
                  "lg:max-h-[400px] lg:max-w-[300px] lg:shrink-0 lg:grid-cols-1 lg:gap-y-2 lg:overflow-y-auto lg:px-0 lg:text-left"
                )}
                aria-label={t("profitSegmentsAria")}
              >
                {donutData.map((d, i) => (
                  <li
                    key={d.fullName}
                    className="flex items-start gap-2.5 text-left text-xs sm:text-sm lg:text-sm"
                  >
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: VIZ_CATEGORY_COLORS[i % VIZ_CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="min-w-0 leading-snug">
                      <span className="font-medium text-foreground">{d.fullName}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        ({d.percent.toFixed(1)}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
