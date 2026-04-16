"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { MemberProjectRow } from "@/actions/member-dashboard";
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

type Props = {
  projects: MemberProjectRow[];
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "كل الحالات" },
  { value: "lead", label: "محتمل" },
  { value: "active", label: "نشط" },
  { value: "on_hold", label: "معلّق" },
  { value: "review", label: "قيد المراجعة" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
];

export function MemberProjectsPageContent({ projects }: Props) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const review = projects.filter((p) => p.status === "review").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.clientName ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="space-y-8" dir="rtl" lang="ar">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">مشاريعي</h1>
        <p className="text-muted-foreground text-sm">
          المشاريع التي أُسندت إليك كعضو أو متعاون.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#c8f542] p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-800">إجمالي المشاريع</p>
          <p className="text-4xl font-bold text-black">{total}</p>
          <p className="mt-1 text-xs text-neutral-600">كل المشاريع المسندة إليك</p>
        </div>
        <div className="rounded-2xl border border-neutral-900 bg-white p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">المشاريع النشطة</p>
          <p className="text-4xl font-bold text-black">{active}</p>
          <p className="mt-1 text-xs text-neutral-400">مشاريع قيد التنفيذ</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-300">قيد المراجعة</p>
          <p className="text-4xl font-bold text-white">{review}</p>
          <p className="mt-1 text-xs text-neutral-400">بانتظار المراجعة</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5 text-start">
          <p className="mb-1 text-xs font-medium text-neutral-400">المشاريع المكتملة</p>
          <p className="text-4xl font-bold text-black">{completed}</p>
          <p className="mt-1 text-xs text-neutral-400">المشاريع المنتهية</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المشاريع</CardTitle>
          <CardDescription>ابحث وفلتر حسب الحالة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="ابحث باسم المشروع أو العميل…"
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
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {projects.length === 0
                ? "لا توجد مشاريع مسندة بعد."
                : "لا توجد نتائج مطابقة."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المشروع</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الأعضاء</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                            <AvatarImage src={p.coverImageUrl ?? p.clientLogoUrl ?? undefined} />
                            <AvatarFallback className="rounded-lg text-xs">
                              {(p.name ?? "?").slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={p.clientLogoUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(p.clientName ?? "?").slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{p.clientName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.members.length > 0 ? (
                          <div className="flex -space-x-2 space-x-reverse">
                            {p.members.slice(0, 4).map((m) => (
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
                            {p.members.length > 4 && (
                              <div
                                className="bg-muted border-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs"
                                title={`+${p.members.length - 4}`}
                              >
                                +{p.members.length - 4}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
