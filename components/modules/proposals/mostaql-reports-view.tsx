"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  Trash2,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Tag,
  Wallet,
  Users,
  Clock,
  User,
  Calendar,
  Copy,
  Check,
  Sparkles,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SarMoney } from "@/components/ui/sar-money";
import { formatCalendarDate, parseCalendarDate } from "@/lib/calendar-date";
import { formatDate } from "@/lib/utils";
import {
  runMostaqlScrape,
  deleteMostaqlScrapeRun,
} from "@/actions/mostaql-reports";
import { MostaqlAnalytics } from "./mostaql-charts";

type MostaqlProjectRow = {
  id: string;
  runId: string;
  mostaqlId: string | null;
  url: string;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  currency: string | null;
  description: string | null;
  skillsTags: string[];
  clientName: string | null;
  clientUrl: string | null;
  offersCount: number | null;
  projectStatus: string | null;
  publishedAt: Date | string | null;
  durationDays: number | null;
  scrapedAt: Date | string;
};

type MostaqlScrapeRunRow = {
  id: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  status: string;
  pagesRequested: number;
  pagesFetched: number;
  projectsFound: number;
  projectsSaved: number;
  categoriesJson: string[];
  errorMessage: string | null;
};

type Props = {
  runs: MostaqlScrapeRunRow[];
  projects: MostaqlProjectRow[];
  activeRunId: string | null;
  /** ISO date string (YYYY-MM-DD) currently selected as the start of the publishedAt range, or null. */
  startDate: string | null;
  /** ISO date string (YYYY-MM-DD) currently selected as the end of the publishedAt range, or null. */
  endDate: string | null;
  error: string | null;
};

const ALL_RUNS_VALUE = "__all__";

const PAGE_OPTIONS = [
  { value: "1", label: "1 page (~25 projects)" },
  { value: "3", label: "3 pages (~75 projects)" },
  { value: "5", label: "5 pages (~125 projects)" },
  { value: "all", label: "All pages (slow, may rate-limit)" },
] as const;

type PagesOption = (typeof PAGE_OPTIONS)[number]["value"];

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    open: "bg-emerald-100 text-emerald-700 border-emerald-200",
    closed: "bg-neutral-200 text-neutral-700 border-neutral-300",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200",
    running: "bg-amber-100 text-amber-700 border-amber-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-700 border-red-200",
  };
  const cls = map[status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function BudgetCell({
  min,
  max,
  currency,
}: {
  min: string | null;
  max: string | null;
  currency: string | null;
}) {
  const c = currency === "USD" ? "USD" : "SAR";
  if (min && max) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <SarMoney value={min} iconClassName="h-3 w-3" currency={c} />
        <span>–</span>
        <SarMoney value={max} iconClassName="h-3 w-3" currency={c} />
      </span>
    );
  }
  if (min) return <SarMoney value={min} iconClassName="h-3 w-3" currency={c} />;
  if (max) return <SarMoney value={max} iconClassName="h-3 w-3" currency={c} />;
  return <span className="text-muted-foreground">—</span>;
}

function formatRunLabel(run: MostaqlScrapeRunRow): string {
  const d = new Date(run.startedAt);
  const stamp = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  return `${stamp} · ${run.status} · ${run.projectsSaved} projects`;
}

function avgNumber(values: (number | null)[]): number {
  const filtered = values.filter((v): v is number => v != null);
  if (filtered.length === 0) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

/** Compact USD formatter (e.g. $12,450 / $1.2k / $3.4M). */
function formatUsdShort(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  if (amount >= 10_000) {
    return `$${Math.round(amount / 1000).toLocaleString()}k`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function exportFilenameSuffix(
  startDate: string | null,
  endDate: string | null,
  activeRunId: string | null
): string {
  const parts: string[] = [todayStamp()];
  if (startDate) parts.push(`from-${startDate}`);
  if (endDate) parts.push(`to-${endDate}`);
  if (activeRunId) parts.push(`run-${activeRunId.slice(0, 8)}`);
  return parts.join("_");
}

function projectToExportRow(p: MostaqlProjectRow, index: number) {
  const posted = p.publishedAt
    ? typeof p.publishedAt === "string"
      ? p.publishedAt.slice(0, 10)
      : p.publishedAt.toISOString().slice(0, 10)
    : "";
  return {
    "#": index + 1,
    Title: p.title ?? "",
    URL: p.url,
    Category: p.category ?? "",
    Subcategory: p.subcategory ?? "",
    "Budget min": p.budgetMin ? Number(p.budgetMin) : "",
    "Budget max": p.budgetMax ? Number(p.budgetMax) : "",
    Currency: p.currency ?? "",
    Offers: p.offersCount ?? "",
    Status: p.projectStatus ?? "",
    Posted: posted,
    "Duration (days)": p.durationDays ?? "",
    Skills: (p.skillsTags ?? []).join(" · "),
    "Client name": p.clientName ?? "",
    "Client URL": p.clientUrl ?? "",
    Description: p.description ?? "",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPdfPrintHtml(
  rows: MostaqlProjectRow[],
  meta: { startDate: string | null; endDate: string | null; runLabel: string | null }
): string {
  const titleParts: string[] = ["Mostaql market reports"];
  if (meta.runLabel) titleParts.push(meta.runLabel);
  const filterBits: string[] = [];
  if (meta.startDate) filterBits.push(`from ${meta.startDate}`);
  if (meta.endDate) filterBits.push(`to ${meta.endDate}`);
  const filterLine = filterBits.length ? `Posted ${filterBits.join(" ")}` : "All dates";

  const tableRows = rows
    .map((p, i) => {
      const posted = p.publishedAt
        ? typeof p.publishedAt === "string"
          ? p.publishedAt.slice(0, 10)
          : p.publishedAt.toISOString().slice(0, 10)
        : "—";
      const budget =
        p.budgetMin && p.budgetMax
          ? `${Number(p.budgetMin)} – ${Number(p.budgetMax)} ${p.currency ?? ""}`
          : p.budgetMin
            ? `${Number(p.budgetMin)} ${p.currency ?? ""}`
            : p.budgetMax
              ? `${Number(p.budgetMax)} ${p.currency ?? ""}`
              : "—";
      return `<tr>
        <td class="num">${i + 1}</td>
        <td><div class="title">${escapeHtml(p.title ?? "—")}</div><div class="url">${escapeHtml(p.url)}</div></td>
        <td>${escapeHtml(p.subcategory ?? p.category ?? "—")}</td>
        <td>${escapeHtml(budget.trim())}</td>
        <td class="num">${p.offersCount ?? "—"}</td>
        <td>${escapeHtml(p.projectStatus ?? "—")}</td>
        <td>${escapeHtml(posted)}</td>
        <td>${escapeHtml(p.clientName ?? "—")}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titleParts.join(" — "))}</title>
<style>
  @page { size: A4 landscape; margin: 16mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Cairo", "Tajawal", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color: #111;
    margin: 0;
    padding: 0;
  }
  header { margin-bottom: 12px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #d4d4d4; padding: 4px 6px; vertical-align: top; text-align: left; }
  th { background: #f4f4f5; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .title { font-weight: 600; }
  .url { font-size: 7.5px; color: #666; word-break: break-all; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(titleParts.join(" — "))}</h1>
  <div class="meta">${escapeHtml(filterLine)} · ${rows.length} project${rows.length === 1 ? "" : "s"} · Generated ${escapeHtml(new Date().toLocaleString())}</div>
</header>
<table>
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th>Title</th>
      <th>Category</th>
      <th>Budget</th>
      <th style="width:48px">Offers</th>
      <th style="width:60px">Status</th>
      <th style="width:80px">Posted</th>
      <th>Client</th>
    </tr>
  </thead>
  <tbody>${tableRows || `<tr><td colspan="8" style="text-align:center;color:#666">No data</td></tr>`}</tbody>
</table>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 50); });</script>
</body>
</html>`;
}

export function MostaqlReportsView({
  runs,
  projects,
  activeRunId,
  startDate,
  endDate,
  error,
}: Props) {
  const router = useRouter();
  const [pages, setPages] = React.useState<PagesOption>("1");
  const [isScraping, setIsScraping] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [activeProject, setActiveProject] =
    React.useState<MostaqlProjectRow | null>(null);
  const [startPicked, setStartPicked] = React.useState<Date | undefined>(() =>
    startDate ? parseCalendarDate(startDate) : undefined
  );
  const [endPicked, setEndPicked] = React.useState<Date | undefined>(() =>
    endDate ? parseCalendarDate(endDate) : undefined
  );

  React.useEffect(() => {
    setStartPicked(startDate ? parseCalendarDate(startDate) : undefined);
  }, [startDate]);
  React.useEffect(() => {
    setEndPicked(endDate ? parseCalendarDate(endDate) : undefined);
  }, [endDate]);

  const buildHref = React.useCallback(
    (overrides: { run?: string | null; start?: string | null; end?: string | null }) => {
      const params = new URLSearchParams();
      const nextRun = overrides.run !== undefined ? overrides.run : activeRunId;
      const nextStart = overrides.start !== undefined ? overrides.start : startDate;
      const nextEnd = overrides.end !== undefined ? overrides.end : endDate;
      if (nextRun) params.set("run", nextRun);
      if (nextStart) params.set("start", nextStart);
      if (nextEnd) params.set("end", nextEnd);
      const qs = params.toString();
      return `/dashboard/proposals/mostaql-reports${qs ? `?${qs}` : ""}`;
    },
    [activeRunId, startDate, endDate]
  );

  const activeRun = React.useMemo(
    () => runs.find((r) => r.id === activeRunId) ?? null,
    [runs, activeRunId]
  );

  const hasFilters = !!(activeRunId || startDate || endDate);

  const stats = React.useMemo(() => {
    const total = projects.length;
    const open = projects.filter((p) => p.projectStatus === "open").length;
    const closed = projects.filter((p) => p.projectStatus === "closed").length;
    const avgOffers = avgNumber(projects.map((p) => p.offersCount));

    // Normalise SAR → USD so totals are comparable across currencies.
    const toUsd = (raw: string | null, currency: string | null): number => {
      if (!raw) return 0;
      const n = Number(raw);
      if (Number.isNaN(n)) return 0;
      return currency === "SAR" ? n / 3.75 : n;
    };

    let totalMin = 0;
    let totalMax = 0;
    for (const p of projects) {
      totalMin += toUsd(p.budgetMin, p.currency);
      totalMax += toUsd(p.budgetMax, p.currency);
    }

    return {
      total,
      open,
      closed,
      avgOffers: Math.round(avgOffers * 10) / 10,
      totalMin: Math.round(totalMin),
      totalMax: Math.round(totalMax),
    };
  }, [projects]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const visibleProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => (p.title ?? "").toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const handleScrape = async () => {
    if (isScraping) return;
    setIsScraping(true);
    const promise = runMostaqlScrape({ pages });
    toast.promise(promise, {
      loading:
        pages === "all"
          ? "Scraping all Mostaql pages — this may take several minutes…"
          : `Scraping ${pages} page(s) from Mostaql…`,
      success: (res) => {
        if (!res.ok) return res.error ?? "Scrape failed";
        const d = res.data!;
        const skipped = d.projectsSkippedDuplicate ?? 0;
        const failed = d.projectsFailedDetail ?? 0;
        const parts = [
          `Saved ${d.projectsSaved} new project${d.projectsSaved === 1 ? "" : "s"}`,
          `skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}`,
        ];
        if (failed > 0) parts.push(`${failed} rate-limited (will retry next run)`);
        if (d.abortedByRateLimit) parts.push("crawl stopped early (rate-limit)");
        return parts.join(" · ");
      },
      error: "Scrape failed",
    });
    try {
      const res = await promise;
      if (res.ok) {
        router.replace(buildHref({ run: null }));
        router.refresh();
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (!confirm("Delete this scrape run and all its scraped projects?")) return;
    const res = await deleteMostaqlScrapeRun(id);
    if (!res.ok) {
      toast.error(res.error ?? "Failed to delete");
      return;
    }
    toast.success("Run deleted");
    router.replace(buildHref({ run: null }));
    router.refresh();
  };

  const onRunSelect = (id: string) => {
    const next = id === ALL_RUNS_VALUE ? null : id;
    router.replace(buildHref({ run: next }));
    router.refresh();
  };

  const applyDateFilter = () => {
    const start = startPicked ? formatCalendarDate(startPicked) : null;
    const end = endPicked ? formatCalendarDate(endPicked) : null;
    router.replace(buildHref({ start, end }));
    router.refresh();
  };

  const clearDateFilter = () => {
    setStartPicked(undefined);
    setEndPicked(undefined);
    router.replace(buildHref({ start: null, end: null }));
    router.refresh();
  };

  const clearAllFilters = () => {
    setStartPicked(undefined);
    setEndPicked(undefined);
    router.replace("/dashboard/proposals/mostaql-reports");
    router.refresh();
  };

  const handleExportExcel = async () => {
    if (projects.length === 0) {
      toast.info("No projects to export.");
      return;
    }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = projects.map((p, i) => projectToExportRow(p, i));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const widths: { wch: number }[] = [
        { wch: 4 },
        { wch: 50 },
        { wch: 40 },
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 40 },
        { wch: 24 },
        { wch: 30 },
        { wch: 80 },
      ];
      ws["!cols"] = widths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mostaql projects");
      const suffix = exportFilenameSuffix(startDate, endDate, activeRunId);
      XLSX.writeFile(wb, `mostaql-${suffix}.xlsx`);
      toast.success("Excel file downloaded");
    } catch (e) {
      console.error("export excel", e);
      toast.error("Excel export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    if (projects.length === 0) {
      toast.info("No projects to export.");
      return;
    }
    setIsExporting(true);
    try {
      const runLabel = activeRun ? formatRunLabel(activeRun) : null;
      const html = buildPdfPrintHtml(projects, { startDate, endDate, runLabel });
      const w = window.open("", "_blank", "width=1100,height=800");
      if (!w) {
        toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      toast.success("Use the print dialog to save as PDF");
    } catch (e) {
      console.error("export pdf", e);
      toast.error("PDF export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const appliedStartStr = startPicked ? formatCalendarDate(startPicked) : null;
  const appliedEndStr = endPicked ? formatCalendarDate(endPicked) : null;
  const datesMatchUrl =
    appliedStartStr === (startDate ?? null) && appliedEndStr === (endDate ?? null);

  const columns = React.useMemo<ColumnDef<MostaqlProjectRow>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        id: "rowNumber",
        enableSorting: false,
        header: () => <span className="text-muted-foreground text-left">#</span>,
        cell: ({ row, table }) => {
          const sorted = table.getSortedRowModel().rows;
          const i = sorted.findIndex((r) => r.id === row.id);
          return (
            <span className="text-muted-foreground tabular-nums">
              {i >= 0 ? i + 1 : row.index + 1}
            </span>
          );
        },
        size: 48,
      },
      {
        accessorKey: "title",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title{" "}
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </Button>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => setActiveProject(row.original)}
            dir="auto"
          >
            {row.original.title ?? "—"}
          </button>
        ),
      },
      {
        accessorKey: "category",
        enableSorting: true,
        header: () => <span className="text-left">Category</span>,
        cell: ({ row }) => {
          const sub = row.original.subcategory;
          const cat = row.original.category;
          if (!cat && !sub) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs" dir="auto">
              {sub ?? cat}
            </span>
          );
        },
      },
      {
        id: "budget",
        enableSorting: false,
        meta: { headerClassName: "min-w-[180px]", cellClassName: "min-w-[180px]" },
        header: () => <span className="text-left">Budget</span>,
        cell: ({ row }) => (
          <BudgetCell
            min={row.original.budgetMin}
            max={row.original.budgetMax}
            currency={row.original.currency}
          />
        ),
      },
      {
        accessorKey: "offersCount",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Offers{" "}
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </Button>
        ),
        cell: ({ row }) =>
          row.original.offersCount == null ? "—" : row.original.offersCount,
      },
      {
        accessorKey: "projectStatus",
        enableSorting: true,
        header: () => <span className="text-left">Status</span>,
        cell: ({ row }) => <StatusPill status={row.original.projectStatus} />,
      },
      {
        accessorKey: "publishedAt",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full items-center justify-start gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Posted{" "}
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </Button>
        ),
        cell: ({ row }) =>
          row.original.publishedAt
            ? formatDate(
                typeof row.original.publishedAt === "string"
                  ? row.original.publishedAt
                  : row.original.publishedAt.toISOString()
              )
            : "—",
      },
      {
        id: "skills",
        enableSorting: false,
        header: () => <span className="text-left">Skills</span>,
        cell: ({ row }) => {
          const skills = row.original.skillsTags ?? [];
          if (skills.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex flex-wrap gap-1">
              {skills.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full border bg-muted px-2 py-0.5 text-xs" dir="auto">
                  {s}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="text-muted-foreground text-xs">+{skills.length - 3}</span>
              )}
            </span>
          );
        },
      },
      {
        id: "client",
        enableSorting: false,
        header: () => <span className="text-left">Client</span>,
        cell: ({ row }) => {
          const name = row.original.clientName;
          const url = row.original.clientUrl;
          if (!name) return <span className="text-muted-foreground">—</span>;
          if (url) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                dir="auto"
              >
                {name}
              </a>
            );
          }
          return <span dir="auto">{name}</span>;
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center"
            title="Open on Mostaql"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/proposals"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to proposals
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-medium text-neutral-900">Mostaql market reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={pages} onValueChange={(v) => setPages(v as PagesOption)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isExporting || projects.length === 0}
                title={
                  projects.length === 0
                    ? "Nothing to export"
                    : "Export the currently filtered projects"
                }
              >
                {isExporting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="me-2 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void handleExportExcel();
                }}
              >
                <FileSpreadsheet className="me-2 h-4 w-4" />
                Export to Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleExportPdf();
                }}
              >
                <FileText className="me-2 h-4 w-4" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleScrape} disabled={isScraping}>
            {isScraping ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="me-2 h-4 w-4" />
            )}
            {isScraping ? "Scraping…" : "Scrape now"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-neutral-100 bg-[rgba(164,254,25,1)] p-4">
          <p className="mb-1 text-xs font-semibold text-black">Total projects</p>
          <p className="text-2xl font-bold text-black">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4">
          <p className="mb-1 text-xs text-neutral-400">Open</p>
          <p className="text-2xl font-bold text-black">{stats.open}</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4">
          <p className="mb-1 text-xs text-neutral-400">Closed</p>
          <p className="text-2xl font-bold text-black">{stats.closed}</p>
        </div>
        <div className="rounded-xl border border-black bg-black p-4">
          <p className="mb-1 text-xs font-semibold text-white">
            Total spending (min)
          </p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {formatUsdShort(stats.totalMin)}
          </p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4">
          <p className="mb-1 text-xs text-neutral-400">Avg offers / project</p>
          <p className="text-2xl font-bold text-black">{stats.avgOffers}</p>
        </div>
        <div className="rounded-xl border border-black bg-black p-4">
          <p className="mb-1 text-xs font-semibold text-white">
            Total spending (max)
          </p>
          <p className="text-2xl font-semibold text-white tabular-nums">
            {formatUsdShort(stats.totalMax)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Filter by run</span>
          <Select
            value={activeRunId ?? ALL_RUNS_VALUE}
            onValueChange={onRunSelect}
          >
            <SelectTrigger className="w-md max-w-full">
              <SelectValue
                placeholder={runs.length === 0 ? "No runs yet" : "All runs"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RUNS_VALUE}>All runs</SelectItem>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {formatRunLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Posted from</span>
          <DatePickerAr
            direction="ltr"
            popoverAlign="start"
            className="w-44"
            value={startPicked}
            onChange={setStartPicked}
            calendarDisabled={endPicked ? { after: endPicked } : undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Posted to</span>
          <DatePickerAr
            direction="ltr"
            popoverAlign="start"
            className="w-44"
            value={endPicked}
            onChange={setEndPicked}
            calendarDisabled={startPicked ? { before: startPicked } : undefined}
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={applyDateFilter}
          disabled={datesMatchUrl}
        >
          Apply dates
        </Button>
        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={clearDateFilter}>
            <X className="me-1 h-4 w-4" />
            Clear dates
          </Button>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={clearAllFilters}
          >
            Reset all
          </Button>
        )}
      </div>

      {activeRun && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusPill status={activeRun.status} />
          <span className="text-muted-foreground">
            Pages fetched: {activeRun.pagesFetched} · Saved {activeRun.projectsSaved} /{" "}
            {activeRun.projectsFound}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDeleteRun(activeRun.id)}
          >
            <Trash2 className="me-1 h-4 w-4" />
            Delete run
          </Button>
        </div>
      )}

      {activeRun?.errorMessage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Last run reported: {activeRun.errorMessage}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {projects.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              No projects scraped yet. Click <strong>Scrape now</strong> above to fetch
              the latest from Mostaql.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title…"
                    className="h-9 ps-8"
                    dir="auto"
                  />
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {searchQuery
                    ? `${visibleProjects.length} of ${projects.length} match${
                        visibleProjects.length === 1 ? "" : "es"
                      }`
                    : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {visibleProjects.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No projects match <strong>&ldquo;{searchQuery}&rdquo;</strong>.
                </div>
              ) : (
                <SortableDataTable<MostaqlProjectRow>
                  columns={columns}
                  data={visibleProjects}
                  tableId="mostaql-projects-table"
                  getRowId={(p) => p.id}
                  uiVariant="clients"
                  columnLabels={{
                    rowNumber: "#",
                    title: "Title",
                    category: "Category",
                    budget: "Budget",
                    offersCount: "Offers",
                    projectStatus: "Status",
                    publishedAt: "Posted",
                    skills: "Skills",
                    client: "Client",
                  }}
                  enablePagination
                  pageSizeOptions={[10, 25, 50, 100]}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {projects.length > 0 && <MostaqlAnalytics projects={projects} />}

      <ProjectDetailSheet
        project={activeProject}
        onClose={() => setActiveProject(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Project detail sheet                                                      */
/* -------------------------------------------------------------------------- */

function ProjectDetailSheet({
  project,
  onClose,
}: {
  project: MostaqlProjectRow | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopyUrl = async () => {
    if (!project) return;
    try {
      await navigator.clipboard.writeText(project.url);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Sheet open={!!project} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {project && (
          <>
            {/* Header ------------------------------------------------------ */}
            <SheetHeader className="border-b bg-linear-to-b from-neutral-50 to-white px-6 pt-6 pb-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(project.subcategory || project.category) && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-700"
                    dir="auto"
                  >
                    <Tag className="h-3 w-3 text-neutral-400" />
                    {project.subcategory ?? project.category}
                  </span>
                )}
                <StatusPill status={project.projectStatus} />
                {project.publishedAt && (
                  <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                    <Calendar className="h-3 w-3" />
                    {formatDate(
                      typeof project.publishedAt === "string"
                        ? project.publishedAt
                        : project.publishedAt.toISOString()
                    )}
                  </span>
                )}
              </div>

              <SheetTitle
                dir="auto"
                className="pe-10 text-xl leading-snug font-semibold tracking-tight text-neutral-900"
              >
                {project.title ?? "Untitled project"}
              </SheetTitle>

              <SheetDescription className="sr-only">
                Mostaql project details
              </SheetDescription>

              {/* Action bar */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="h-8">
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="me-1.5 h-3.5 w-3.5" />
                    Open on Mostaql
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <Check className="me-1.5 h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="me-1.5 h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
            </SheetHeader>

            {/* Scrollable body -------------------------------------------- */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile
                  icon={<Wallet className="h-4 w-4" />}
                  label="Budget"
                  value={
                    <BudgetCell
                      min={project.budgetMin}
                      max={project.budgetMax}
                      currency={project.currency}
                    />
                  }
                  emphasized
                />
                <StatTile
                  icon={<Users className="h-4 w-4" />}
                  label="Offers"
                  value={
                    project.offersCount == null ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <span className="tabular-nums">{project.offersCount}</span>
                    )
                  }
                />
                <StatTile
                  icon={<Clock className="h-4 w-4" />}
                  label="Duration"
                  value={
                    project.durationDays ? (
                      <span className="tabular-nums">
                        {project.durationDays} day
                        {project.durationDays === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )
                  }
                />
                <StatTile
                  icon={<User className="h-4 w-4" />}
                  label="Client"
                  value={
                    project.clientUrl ? (
                      <a
                        href={project.clientUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-neutral-900 hover:underline"
                        dir="auto"
                      >
                        {project.clientName ?? "View"}
                      </a>
                    ) : project.clientName ? (
                      <span className="font-medium text-neutral-900" dir="auto">
                        {project.clientName}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )
                  }
                />
              </div>

              {/* Skills */}
              {project.skillsTags && project.skillsTags.length > 0 && (
                <section className="mt-6">
                  <SectionHeader
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Skills"
                    count={project.skillsTags.length}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {project.skillsTags.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                        dir="auto"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Description */}
              {project.description && (
                <section className="mt-6">
                  <SectionHeader
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Description"
                  />
                  <div
                    className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4"
                    dir="auto"
                  >
                    <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-neutral-800">
                      {project.description}
                    </p>
                  </div>
                </section>
              )}

              {/* Spacer so footer doesn't crowd content */}
              <div className="h-2" />
            </div>

            {/* Sticky footer ---------------------------------------------- */}
            <div className="border-t bg-white px-6 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-neutral-500">
                  Scraped{" "}
                  {formatDate(
                    typeof project.scrapedAt === "string"
                      ? project.scrapedAt
                      : project.scrapedAt.toISOString()
                  )}
                </span>
                <Button asChild size="sm" variant="default" className="h-8">
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View full project
                    <ExternalLink className="ms-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatTile({
  icon,
  label,
  value,
  emphasized = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`group rounded-xl border p-3 transition-colors ${
        emphasized
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div
        className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${
          emphasized ? "text-neutral-400" : "text-neutral-500"
        }`}
      >
        <span
          className={
            emphasized ? "text-neutral-300" : "text-neutral-400"
          }
        >
          {icon}
        </span>
        {label}
      </div>
      <div
        className={`text-base font-semibold ${
          emphasized ? "text-white" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <span className="text-neutral-400">{icon}</span>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </h3>
      {count != null && (
        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}
