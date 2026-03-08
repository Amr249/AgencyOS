"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { NewProjectDialog } from "./new-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { deleteProject, updateProject } from "@/actions/projects";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { cn, formatBudgetSAR, formatDate } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Table as TableIcon, LayoutGrid, Columns, MoreHorizontal, Pencil, Trash2, ChevronDown } from "lucide-react";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

const STATUS_LIST = ["lead", "active", "on_hold", "review", "completed", "cancelled"] as const;

function StatusBadgePopover({
  projectId,
  currentStatus,
  onSuccess,
}: {
  projectId: string;
  currentStatus: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);

  const handleSelect = async (status: string) => {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    const result = await updateProject({ id: projectId, status: status as (typeof STATUS_LIST)[number] });
    setUpdating(false);
    if (result.ok) {
      const label = PROJECT_STATUS_LABELS[status] ?? status;
      toast.success(`تم تحديث الحالة إلى ${label}`);
      setOpen(false);
      onSuccess();
    } else {
      toast.error("فشل تحديث الحالة");
    }
  };

  const label = PROJECT_STATUS_LABELS[currentStatus] ?? currentStatus;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-90",
            PROJECT_STATUS_BADGE_CLASS[currentStatus] ?? "bg-muted"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {STATUS_LIST.map((status) => (
            <button
              key={status}
              type="button"
              disabled={updating}
              onClick={() => handleSelect(status)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-right text-sm hover:bg-accent",
                status === currentStatus && "bg-accent font-medium"
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COVER_COLOR[status] ?? "#94a3b8" }}
              />
              {PROJECT_STATUS_LABELS[status] ?? status}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ProjectRow = {
  id: string;
  name: string;
  clientId: string;
  status: string;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  description: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
};

type ClientOption = { id: string; companyName: string | null };

type ProjectMembersMap = Record<string, { id: string; name: string; avatarUrl: string | null }[]>;

type TeamMemberOption = { id: string; name: string; role: string | null };

type ProjectsListViewProps = {
  projects: ProjectRow[];
  taskCounts: Record<string, { total: number; done: number }>;
  projectMembers?: ProjectMembersMap;
  clients: ClientOption[];
  teamMembers?: TeamMemberOption[];
  defaultCurrency: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "lead", label: "عميل محتمل" },
  { value: "active", label: "نشط" },
  { value: "on_hold", label: "متوقف" },
  { value: "review", label: "مراجعة" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
];

const BOARD_COLUMNS = ["lead", "active", "on_hold", "review", "completed", "cancelled"] as const;

const STATUS_COVER_COLOR: Record<string, string> = {
  lead: "#3b82f6",
  active: "#22c55e",
  on_hold: "#f59e0b",
  review: "#a855f7",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

export function ProjectsListView({
  projects,
  taskCounts,
  projectMembers = {},
  clients,
  teamMembers = [],
  defaultCurrency,
}: ProjectsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = React.useState<"table" | "gallery" | "board">("gallery");
  const [editingProject, setEditingProject] = React.useState<ProjectRow | null>(null);
  const [projectToDelete, setProjectToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const statusParam = searchParams.get("status") ?? "all";
  const clientIdParam = searchParams.get("clientId") ?? "all";

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const id = projectToDelete.id;
    setProjectToDelete(null);
    const result = await deleteProject(id);
    if (result.ok) {
      toast.success("تم حذف المشروع");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const updateParams = React.useCallback(
    (updates: { search?: string; status?: string; clientId?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.search !== undefined) (updates.search ? next.set("search", updates.search) : next.delete("search"));
      if (updates.status !== undefined) (updates.status && updates.status !== "all" ? next.set("status", updates.status) : next.delete("status"));
      if (updates.clientId !== undefined) (updates.clientId && updates.clientId !== "all" ? next.set("clientId", updates.clientId) : next.delete("clientId"));
      router.push(`/dashboard/projects?${next.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchInput.trim() || undefined });
  };

  const progress = (id: string) => {
    const t = taskCounts[id];
    if (!t || t.total === 0) return { pct: 0, label: "0 / 0" };
    const pct = Math.round((t.done / t.total) * 100);
    return { pct, label: `${t.done} / ${t.total}` };
  };

  const projectTableColumns = React.useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "clientName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الشركة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 justify-end w-full">
            <span>{row.original.clientName ?? "—"}</span>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.original.clientLogoUrl ?? undefined} />
              <AvatarFallback className="text-xs">{(row.original.clientName ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        ),
      },
      {
        accessorKey: "name",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">اسم المشروع {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right w-full">
            <Link href={`/dashboard/projects/${row.original.id}`} className="font-medium text-primary hover:underline block text-right">
              {row.original.name}
            </Link>
            {(projectMembers[row.original.id]?.length ?? 0) > 0 && (
              <AvatarStack members={projectMembers[row.original.id] ?? []} className="justify-end" />
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الحالة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end w-full">
            <StatusBadgePopover projectId={row.original.id} currentStatus={row.original.status} onSuccess={() => router.refresh()} />
          </div>
        ),
      },
      {
        accessorKey: "endDate",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الموعد النهائي {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.endDate),
      },
      {
        accessorKey: "budget",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الميزانية {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatBudgetSAR(row.original.budget),
      },
      {
        id: "taskProgress",
        enableSorting: false,
        header: () => <span className="text-right">تقدم المهام</span>,
        cell: ({ row }) => progress(row.original.id).label,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex justify-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setEditingProject(p)}>
                    <Pencil className="me-2 h-4 w-4" />تعديل
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProjectToDelete({ id: p.id, name: p.name });
                    }}
                  >
                    <Trash2 className="me-2 h-4 w-4" />حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [taskCounts, projectMembers, router, setEditingProject, setProjectToDelete]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">المشاريع</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:border-l rtl:[&>button:first-child]:rounded-l-none rtl:[&>button:first-child]:rounded-r-md rtl:[&>button:last-child]:rounded-r-none rtl:[&>button:last-child]:rounded-l-md rtl:[&>button:not(:first-child)]:border-l-0 rtl:[&>button:not(:first-child)]:border-r">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("table")}
              aria-label="عرض الجدول"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "gallery" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("gallery")}
              aria-label="عرض المعرض"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setView("board")}
              aria-label="عرض اللوحة"
            >
              <Columns className="h-4 w-4" />
            </Button>
          </div>
          <NewProjectDialog
            open={newProjectOpen}
            onOpenChange={setNewProjectOpen}
            trigger={
              <Button variant="secondary" className="hidden sm:inline-flex">
                <PlusCircledIcon className="me-2 h-4 w-4" />
                مشروع جديد
              </Button>
            }
            clients={clients}
            teamMembers={teamMembers}
            defaultCurrency={defaultCurrency}
            asChild
            onSuccess={() => router.refresh()}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full flex-1 sm:max-w-sm">
          <Input
            placeholder="البحث باسم المشروع أو العميل..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full"
          />
        </form>
        <Select
          value={statusParam}
          onValueChange={(v) => updateParams({ status: v })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={clientIdParam}
          onValueChange={(v) => updateParams({ clientId: v })}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="العميل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العملاء</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.companyName || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">لا توجد مشاريع تطابق التصفية.</p>
            <NewProjectDialog
              trigger={<Button variant="link" className="mt-2">إنشاء أول مشروع</Button>}
              clients={clients}
              teamMembers={teamMembers}
              defaultCurrency={defaultCurrency}
              onSuccess={() => router.refresh()}
            />
          </CardContent>
        </Card>
      ) : view === "table" ? (
        <>
        {/* Mobile: project cards (table view) */}
        <div className="space-y-2 md:hidden">
          {projects.map((p) => {
            const { label } = progress(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between rounded-xl border p-4">
                <Link href={`/dashboard/projects/${p.id}`} className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={p.clientLogoUrl ?? undefined} />
                    <AvatarFallback className="text-sm">{(p.clientName ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-right min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-muted-foreground text-sm">{p.clientName ?? "—"}</p>
                    {(projectMembers[p.id]?.length ?? 0) > 0 && (
                      <AvatarStack members={projectMembers[p.id] ?? []} className="mt-1 justify-end" />
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadgePopover projectId={p.id} currentStatus={p.status} onSuccess={() => router.refresh()} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem asChild><Link href={`/dashboard/projects/${p.id}`}>عرض</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingProject(p)}><Pencil className="me-2 h-4 w-4" />تعديل</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.preventDefault(); setProjectToDelete({ id: p.id, name: p.name }); }}><Trash2 className="me-2 h-4 w-4" />حذف</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
        <Card className="hidden md:block">
          <CardContent className="pt-4">
            <SortableDataTable<ProjectRow>
              columns={projectTableColumns}
              data={projects}
              tableId="projects-table"
              getRowId={(p) => p.id}
              columnLabels={{
                clientName: "الشركة",
                name: "اسم المشروع",
                status: "الحالة",
                endDate: "الموعد النهائي",
                budget: "الميزانية",
              }}
              enablePagination={false}
            />
          </CardContent>
        </Card>
        </>
      ) : view === "gallery" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {projects.map((p) => {
            const { pct, label } = progress(p.id);
            const coverColor = STATUS_COVER_COLOR[p.status] ?? "#94a3b8";
            const initial = (p.name ?? "?").slice(0, 1).toUpperCase();
            const coverImage = p.coverImageUrl ?? p.clientLogoUrl;
            return (
              <Card key={p.id} className="group relative h-full overflow-hidden transition-colors hover:bg-muted/50">
                <Link href={`/dashboard/projects/${p.id}`} className="block h-full">
                  <div
                    className="h-24 w-full shrink-0 bg-cover bg-center object-cover"
                    style={
                      coverImage
                        ? { backgroundImage: `url(${coverImage})` }
                        : { backgroundColor: coverColor }
                    }
                  >
                    {!coverImage && (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                        {initial}
                      </span>
                    )}
                  </div>
                  <CardContent className="pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <StatusBadgePopover
                          projectId={p.id}
                          currentStatus={p.status}
                          onSuccess={() => router.refresh()}
                        />
                      </span>
                    </div>
                    {(projectMembers[p.id]?.length ?? 0) > 0 && (
                      <div className="mt-2 flex justify-end">
                        <AvatarStack members={projectMembers[p.id] ?? []} />
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={p.clientLogoUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(p.clientName ?? "?").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground text-sm">{p.clientName ?? "—"}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
<span className="text-muted-foreground">الموعد النهائي</span>
                                      <span>{formatDate(p.endDate)}</span>
                                    </div>
                                    <div className="mt-2">
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>المهام {label}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="mt-1 h-1.5" />
                    </div>
                    <div className="mt-3 text-sm">
                      <span className="text-muted-foreground">الميزانية </span>
                      <span>{formatBudgetSAR(p.budget)}</span>
                    </div>
                  </CardContent>
                </Link>
                <div className="absolute top-2 inset-s-2 opacity-0 transition-opacity group-hover:opacity-100 w-fit">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 shadow-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/projects/${p.id}`}>عرض</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingProject(p)}>
                        <Pencil className="me-2 h-4 w-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProjectToDelete({ id: p.id, name: p.name });
                        }}
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 min-w-0">
          {BOARD_COLUMNS.map((statusKey) => {
            const columnProjects = projects.filter((p) => p.status === statusKey);
            const label = PROJECT_STATUS_LABELS[statusKey] ?? statusKey;
            const dotColor = STATUS_COVER_COLOR[statusKey] ?? "#94a3b8";
            return (
              <div
                key={statusKey}
                className="flex min-w-[280px] w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground text-sm">({columnProjects.length})</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2 max-h-[calc(100vh-16rem)]">
                  {columnProjects.map((p) => {
                    const { label: progressLabel } = progress(p.id);
                    return (
                      <div key={p.id} className="relative">
                        <Link href={`/dashboard/projects/${p.id}`} className="block">
                          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium leading-tight">{p.name}</p>
                                <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                                  <StatusBadgePopover
                                    projectId={p.id}
                                    currentStatus={p.status}
                                    onSuccess={() => router.refresh()}
                                  />
                                </span>
                              </div>
                              {(projectMembers[p.id]?.length ?? 0) > 0 && (
                                <div className="mt-2 flex justify-end">
                                  <AvatarStack members={projectMembers[p.id] ?? []} />
                                </div>
                              )}
                              <div className="mt-2 flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={p.clientLogoUrl ?? undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {(p.clientName ?? "?").slice(0, 1).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-muted-foreground text-xs">{p.clientName ?? "—"}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                استحقاق {formatDate(p.endDate)} · {formatBudgetSAR(p.budget)}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">المهام {progressLabel}</p>
                            </CardContent>
                          </Card>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingProject && (
        <EditProjectDialog
          project={{
            id: editingProject.id,
            name: editingProject.name,
            clientId: editingProject.clientId,
            status: editingProject.status,
            coverImageUrl: editingProject.coverImageUrl,
            startDate: editingProject.startDate,
            endDate: editingProject.endDate,
            budget: editingProject.budget,
            description: editingProject.description,
          }}
          clients={clients}
          defaultCurrency={defaultCurrency}
          open={!!editingProject}
          onOpenChange={(open) => !open && setEditingProject(null)}
          onSuccess={() => {
            setEditingProject(null);
            router.refresh();
          }}
        />
      )}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {projectToDelete
                ? `سيتم حذف المشروع ${projectToDelete.name} نهائياً بما يشمل جميع مهامه. لا يمكن التراجع عن هذا الإجراء.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleConfirmDelete();
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="md:hidden fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
        aria-label="مشروع جديد"
        onClick={() => setNewProjectOpen(true)}
      >
        +
      </button>
    </div>
  );
}
