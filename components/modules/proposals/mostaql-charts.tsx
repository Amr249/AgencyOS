"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, PieChart as PieChartIcon, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/* -------------------------------------------------------------------------- */
/*  Types & helpers                                                           */
/* -------------------------------------------------------------------------- */

export type AnalyticsProject = {
  publishedAt: Date | string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  currency: string | null;
  subcategory: string | null;
  category: string | null;
  title: string | null;
  skillsTags: string[];
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function isoDay(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortLabel(text: string, max = 18): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const AI_RE = /ai|ml|machine learning|deep learning|nlp|llm|chatbot|ذكاء|تعلم/i;
const DEV_RE =
  /develop|programming|laravel|flutter|react|vue|angular|node|next|python|django|java|kotlin|swift|app|website|web\b|software|backend|frontend|full[- ]?stack|api|wordpress|shopify|برمج|تطوير|تطبيق|موقع|مواقع|ويب/i;

/* -------------------------------------------------------------------------- */
/*  Main analytics block                                                      */
/* -------------------------------------------------------------------------- */

export function MostaqlAnalytics({ projects }: { projects: AnalyticsProject[] }) {
  /* ---- Daily posts ------------------------------------------------------ */
  const dailyData = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      if (!p.publishedAt) continue;
      const key = isoDay(p.publishedAt);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    if (map.size === 0) return [] as { date: string; label: string; count: number }[];

    // Fill missing days for a continuous timeline
    const keys = Array.from(map.keys()).sort();
    const startMs = new Date(keys[0]).getTime();
    const endMs = new Date(keys[keys.length - 1]).getTime();
    const out: { date: string; label: string; count: number }[] = [];
    for (let t = startMs; t <= endMs; t += 86_400_000) {
      const d = new Date(t);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: iso,
        label: shortDate(iso),
        count: map.get(iso) ?? 0,
      });
    }
    return out;
  }, [projects]);

  /* ---- Budget buckets --------------------------------------------------- */
  const budgetData = React.useMemo(() => {
    const buckets: { key: string; label: string; min: number; max: number }[] = [
      { key: "u25", label: "< $25", min: 0, max: 25 },
      { key: "25_50", label: "$25 – $50", min: 25, max: 50 },
      { key: "50_100", label: "$50 – $100", min: 50, max: 100 },
      { key: "100_250", label: "$100 – $250", min: 100, max: 250 },
      { key: "250_500", label: "$250 – $500", min: 250, max: 500 },
      { key: "500_1k", label: "$500 – $1k", min: 500, max: 1000 },
      { key: "1k_2_5k", label: "$1k – $2.5k", min: 1000, max: 2500 },
      { key: "2_5k_5k", label: "$2.5k – $5k", min: 2500, max: 5000 },
      { key: "5k_10k", label: "$5k – $10k", min: 5000, max: 10000 },
      { key: "10kp", label: "$10k+", min: 10000, max: Number.POSITIVE_INFINITY },
    ];
    const counts = new Map(buckets.map((b) => [b.key, 0]));

    for (const p of projects) {
      const min = p.budgetMin ? Number(p.budgetMin) : null;
      const max = p.budgetMax ? Number(p.budgetMax) : null;
      let mid: number | null = null;
      if (min != null && max != null) mid = (min + max) / 2;
      else mid = min ?? max;
      if (mid == null || Number.isNaN(mid)) continue;

      // Roughly normalise SAR → USD so buckets are meaningful across currencies
      if (p.currency === "SAR") mid = mid / 3.75;

      const bucket = buckets.find((b) => mid! >= b.min && mid! < b.max);
      if (bucket) counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
    }

    return buckets
      .map((b, i) => ({
        bucket: b.label,
        key: b.key,
        count: counts.get(b.key) ?? 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((b) => b.count > 0);
  }, [projects]);

  /* ---- Category split (AI vs Dev vs Other) ------------------------------ */
  const categoryData = React.useMemo(() => {
    let ai = 0;
    let dev = 0;
    let other = 0;
    for (const p of projects) {
      const hay = `${p.subcategory ?? ""} ${p.category ?? ""} ${(p.skillsTags ?? []).join(" ")} ${p.title ?? ""}`;
      if (AI_RE.test(hay)) ai++;
      else if (DEV_RE.test(hay)) dev++;
      else other++;
    }
    return [
      { name: "ai", label: "AI / ML", value: ai, fill: "var(--chart-1)" },
      { name: "dev", label: "Development", value: dev, fill: "var(--chart-2)" },
      { name: "other", label: "Other", value: other, fill: "var(--chart-3)" },
    ].filter((d) => d.value > 0);
  }, [projects]);

  /* ---- Top skills (per category) --------------------------------------- */
  const skillsByGroup = React.useMemo(() => {
    const all = new Map<string, number>();
    const ai = new Map<string, number>();
    const dev = new Map<string, number>();

    for (const p of projects) {
      const hay = `${p.subcategory ?? ""} ${p.category ?? ""} ${(p.skillsTags ?? []).join(" ")} ${p.title ?? ""}`;
      const isAi = AI_RE.test(hay);
      const isDev = !isAi && DEV_RE.test(hay);

      for (const raw of p.skillsTags ?? []) {
        const s = raw.trim();
        if (!s) continue;
        all.set(s, (all.get(s) ?? 0) + 1);
        if (isAi) ai.set(s, (ai.get(s) ?? 0) + 1);
        if (isDev) dev.set(s, (dev.get(s) ?? 0) + 1);
      }
    }

    const toRows = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([skill, count]) => ({
          skill,
          label: shortLabel(skill, 18),
          count,
        }));

    return {
      all: toRows(all),
      ai: toRows(ai),
      dev: toRows(dev),
      counts: {
        all: Array.from(all.values()).reduce((s, n) => s + n, 0),
        ai: Array.from(ai.values()).reduce((s, n) => s + n, 0),
        dev: Array.from(dev.values()).reduce((s, n) => s + n, 0),
      },
    };
  }, [projects]);

  const hasAnyData =
    dailyData.length > 0 ||
    budgetData.length > 0 ||
    categoryData.length > 0 ||
    skillsByGroup.all.length > 0;

  if (!hasAnyData) return null;

  return (
    <div className="space-y-4">
      <DailyPostsChart data={dailyData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetRangeChart data={budgetData} />
        <CategorySplitChart data={categoryData} />
      </div>

      <SkillsChart series={skillsByGroup} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart 1 — Daily posts (full-width bar chart)                              */
/* -------------------------------------------------------------------------- */

function DailyPostsChart({
  data,
}: {
  data: { date: string; label: string; count: number }[];
}) {
  const config = {
    count: { label: "Projects", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const total = data.reduce((s, d) => s + d.count, 0);
  const span = data.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="text-muted-foreground h-4 w-4" />
            Projects posted per day
          </CardTitle>
          <CardDescription className="text-xs">
            {span > 0
              ? `${total} project${total === 1 ? "" : "s"} across ${span} day${span === 1 ? "" : "s"}`
              : "No data"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full" dir="ltr">
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_v, payload) => {
                      const iso = payload?.[0]?.payload?.date as string | undefined;
                      return iso
                        ? new Date(iso).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "";
                    }}
                  />
                }
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart 2 — Budget range pie                                                */
/* -------------------------------------------------------------------------- */

function BudgetRangeChart({
  data,
}: {
  data: { bucket: string; key: string; count: number; fill: string }[];
}) {
  const config = React.useMemo(() => {
    const c: ChartConfig = { count: { label: "Projects" } };
    // Key config by the bucket label so <ChartLegendContent nameKey="bucket" />
    // can find the matching entry and render the range next to each color.
    data.forEach((d, i) => {
      c[d.bucket] = {
        label: d.bucket,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return c;
  }, [data]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChartIcon className="text-muted-foreground h-4 w-4" />
          Projects by budget range
        </CardTitle>
        <CardDescription className="text-xs">
          {total > 0
            ? `${total} project${total === 1 ? "" : "s"} with budget data`
            : "No budget data"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto aspect-square h-64 w-full"
            dir="ltr"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="bucket"
                    formatter={(value, _name, item) => {
                      const v = Number(value);
                      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                      return (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-[2px]"
                              style={{ backgroundColor: item.payload.fill }}
                            />
                            <span>{item.payload.bucket}</span>
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {v} · {pct}%
                          </span>
                        </div>
                      );
                    }}
                    hideLabel
                  />
                }
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="bucket"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}

        {data.length > 0 && (
          <BudgetRangeLegend data={data} total={total} />
        )}
      </CardContent>
    </Card>
  );
}

function BudgetRangeLegend({
  data,
  total,
}: {
  data: { bucket: string; key: string; count: number; fill: string }[];
  total: number;
}) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        return (
          <li
            key={d.key}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: d.fill }}
              />
              <span className="truncate text-neutral-700" dir="ltr">
                {d.bucket}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
              {d.count}
              <span className="ml-1 opacity-70">· {pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart 3 — AI / Dev / Other pie                                            */
/* -------------------------------------------------------------------------- */

function CategorySplitChart({
  data,
}: {
  data: { name: string; label: string; value: number; fill: string }[];
}) {
  const config = React.useMemo(() => {
    const c: ChartConfig = { value: { label: "Projects" } };
    data.forEach((d) => {
      c[d.name] = { label: d.label, color: d.fill };
    });
    return c;
  }, [data]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-muted-foreground h-4 w-4" />
          AI / ML vs Development
        </CardTitle>
        <CardDescription className="text-xs">
          {total > 0
            ? `${total} project${total === 1 ? "" : "s"} classified`
            : "No data"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto aspect-square h-64 w-full"
            dir="ltr"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="label"
                    formatter={(value, _name, item) => {
                      const v = Number(value);
                      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                      return (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-[2px]"
                              style={{ backgroundColor: item.payload.fill }}
                            />
                            <span>{item.payload.label}</span>
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {v} · {pct}%
                          </span>
                        </div>
                      );
                    }}
                    hideLabel
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="82%"
                paddingAngle={2}
                label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="label" />}
                verticalAlign="bottom"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart 4 — Top skills (interactive bar chart)                              */
/* -------------------------------------------------------------------------- */

type SkillRow = { skill: string; label: string; count: number };

type SkillsSeriesKey = "all" | "ai" | "dev";

function SkillsChart({
  series,
}: {
  series: {
    all: SkillRow[];
    ai: SkillRow[];
    dev: SkillRow[];
    counts: { all: number; ai: number; dev: number };
  };
}) {
  const tabs: {
    key: SkillsSeriesKey;
    label: string;
    color: string;
    total: number;
  }[] = [
    { key: "all", label: "All Skills", color: "var(--chart-1)", total: series.counts.all },
    { key: "ai", label: "AI / ML", color: "var(--chart-2)", total: series.counts.ai },
    { key: "dev", label: "Development", color: "var(--chart-3)", total: series.counts.dev },
  ];

  // Default to the largest non-empty bucket so the chart isn't empty on load.
  const defaultTab: SkillsSeriesKey = React.useMemo(() => {
    const sorted = [...tabs].sort((a, b) => b.total - a.total);
    return (sorted.find((t) => t.total > 0)?.key ?? "all") as SkillsSeriesKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.counts.all, series.counts.ai, series.counts.dev]);

  const [active, setActive] = React.useState<SkillsSeriesKey>(defaultTab);

  // If the data refreshes and the previously-active tab is now empty, fall back.
  React.useEffect(() => {
    if (series[active].length === 0) setActive(defaultTab);
  }, [active, series, defaultTab]);

  const data = series[active];

  const config = React.useMemo(
    () =>
      ({
        all: { label: "All Skills", color: "var(--chart-1)" },
        ai: { label: "AI / ML", color: "var(--chart-2)" },
        dev: { label: "Development", color: "var(--chart-3)" },
      }) satisfies ChartConfig,
    []
  );

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="text-muted-foreground h-4 w-4" />
            Top skills in demand
          </CardTitle>
          <CardDescription className="text-xs">
            Click a tile to see the most-requested skills for that segment
          </CardDescription>
        </div>

        <div className="flex">
          {tabs.map((t) => {
            const isActive = active === t.key;
            const isDisabled = t.total === 0;
            return (
              <button
                key={t.key}
                type="button"
                data-active={isActive}
                disabled={isDisabled}
                onClick={() => setActive(t.key)}
                className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors even:border-l hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-40 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
              >
                <span className="text-muted-foreground text-xs">{t.label}</span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {t.total.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-4 pb-4 sm:px-6 sm:pt-6">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto h-72 w-full sm:h-80"
            dir="ltr"
          >
            <BarChart
              data={data}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    nameKey={active}
                    labelFormatter={(_v, payload) =>
                      (payload?.[0]?.payload?.skill as string) ?? ""
                    }
                  />
                }
              />
              <Bar
                dataKey="count"
                name={config[active].label as string}
                fill={`var(--color-${active})`}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={6}
                  className="fill-muted-foreground"
                  style={{ fontSize: 10 }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
      Not enough data to display this chart.
    </div>
  );
}
