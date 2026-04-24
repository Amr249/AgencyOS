"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_PILL_CLASS } from "@/types";
import { cn } from "@/lib/utils";

export type PortalProjectMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type PortalProjectListRow = {
  id: string;
  name: string;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  coverImageUrl: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  taskTotal: number;
  taskDone: number;
  taskPercent: number;
};

type Props = {
  projects: PortalProjectListRow[];
  projectMembersByProject: Record<string, PortalProjectMember[]>;
};

export function PortalProjectsListView({ projects, projectMembersByProject }: Props) {
  const t = useTranslations("clientPortal");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const review = projects.filter((p) => p.status === "review").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  const statusFilterOptions = React.useMemo(
    () =>
      [
        { value: "all", label: t("projectsStatusAll") },
        { value: "lead", label: t("projectsStatusLead") },
        { value: "active", label: t("projectsStatusActive") },
        { value: "on_hold", label: t("projectsStatusOnHold") },
        { value: "review", label: t("projectsStatusReview") },
        { value: "completed", label: t("projectsStatusCompleted") },
        { value: "cancelled", label: t("projectsStatusCancelled") },
      ] as const,
    [t]
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.clientName ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("projectsTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("projectsSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#c8f542] p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-800">{t("kpiTotalTitle")}</p>
          <p className="text-4xl font-bold text-black">{total}</p>
          <p className="mt-1 text-xs text-neutral-600">{t("kpiTotalHint")}</p>
        </div>
        <div className="rounded-2xl border border-neutral-900 bg-white p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("kpiActiveTitle")}</p>
          <p className="text-4xl font-bold text-black">{active}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiActiveHint")}</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-300">{t("kpiReviewTitle")}</p>
          <p className="text-4xl font-bold text-white">{review}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiReviewHint")}</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t("kpiCompletedTitle")}</p>
          <p className="text-4xl font-bold text-black">{completed}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("kpiCompletedHint")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("projectsListTitle")}</CardTitle>
          <CardDescription>{t("projectsListDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("projectsSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {projects.length === 0 ? t("projectsEmpty") : t("projectsNoResults")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colProject")}</TableHead>
                    <TableHead>{t("projectsColClient")}</TableHead>
                    <TableHead>{t("projectsColMembers")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const members = projectMembersByProject[p.id] ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/portal/projects/${p.id}`}
                            className="flex items-center gap-2 text-neutral-900 hover:text-neutral-700 hover:underline"
                          >
                            <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                              <AvatarImage src={p.coverImageUrl ?? p.clientLogoUrl ?? undefined} />
                              <AvatarFallback className="rounded-lg text-xs">
                                {(p.name ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{p.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={p.clientLogoUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {(p.clientName ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{p.clientName ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {members.length > 0 ? (
                            <div className="flex -space-x-2 space-x-reverse">
                              {members.slice(0, 4).map((m) => (
                                <Avatar
                                  key={m.id}
                                  className="border-background h-6 w-6 shrink-0 border-2"
                                  title={m.name}
                                >
                                  <AvatarImage src={m.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {(m.name ?? "?").slice(0, 1)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {members.length > 4 && (
                                <div
                                  className="bg-muted border-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs"
                                  title={`+${members.length - 4}`}
                                >
                                  +{members.length - 4}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              PROJECT_STATUS_PILL_CLASS[p.status] ?? "bg-gray-50 text-gray-700"
                            )}
                          >
                            {PROJECT_STATUS_LABELS[p.status] ?? p.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
