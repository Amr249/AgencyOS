"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { deleteProject, deleteProjects, updateProject } from "@/actions/projects";
import { cn, formatAmount, formatDate } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { MoreHorizontal, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

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
      const label = PROJECT_STATUS_LABELS_EN[status] ?? status;
      toast.success(`Status updated to ${label}`);
      setOpen(false);
      onSuccess();
    } else {
      toast.error("Failed to update status");
    }
  };

  const label = PROJECT_STATUS_LABELS_EN[currentStatus] ?? currentStatus;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90",
            PROJECT_STATUS_PILL_CLASS[currentStatus] ?? "bg-neutral-100 text-neutral-600"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                status === currentStatus && "bg-accent font-medium"
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COVER_COLOR[status] ?? "#94a3b8" }}
              />
              {PROJECT_STATUS_LABELS_EN[status] ?? status}
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
type ServiceOption = { id: string; name: string; status: string };

type ProjectMembersMap = Record<string, { id: string; name: string; avatarUrl: string | null }[]>;
type ProjectServicesMap = Record<string, { id: string; name: string; status: string }[]>;

type TeamMemberOption = { id: string; name: string; role: string | null };

type ProjectsListViewProps = {
  projects: ProjectRow[];
  taskCounts: Record<string, { total: number; done: number }>;
  projectMembers?: ProjectMembersMap;
  projectServices?: ProjectServicesMap;
  clients: ClientOption[];
  serviceOptions?: ServiceOption[];
  teamMembers?: TeamMemberOption[];
  defaultCurrency: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COVER_COLOR: Record<string, string> = {
  lead: "#3b82f6",
  active: "#22c55e",
  on_hold: "#f59e0b",
  review: "#a855f7",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  lead: "bg-blue-500",
  active: "bg-blue-500",
  on_hold: "bg-amber-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
};

const PROJECT_STATUS_PILL_CLASS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  lead: "bg-blue-50 text-blue-700",
  on_hold: "bg-amber-50 text-amber-700",
  review: "bg-purple-50 text-purple-700",
  cancelled: "bg-red-50 text-red-700",
};

const PROJECT_STATUS_LABELS_EN: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  on_hold: "On Hold",
  review: "Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ProjectsListView({
  projects,
  taskCounts,
  projectMembers = {},
  projectServices = {},
  clients,
  serviceOptions = [],
  teamMembers = [],
  defaultCurrency,
}: ProjectsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingProject, setEditingProject] = React.useState<ProjectRow | null>(null);
  const [projectToDelete, setProjectToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const statusParam = searchParams.get("status") ?? "all";
  const clientIdParam = searchParams.get("clientId") ?? "all";

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const id = projectToDelete.id;
    setProjectToDelete(null);
    const result = await deleteProject(id);
    if (result.ok) {
      toast.success("Project deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const visibleProjectIdsKey = projects.map((p) => p.id).join("\0");
  React.useEffect(() => {
    const visibleSet = new Set(projects.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleSet.has(id)));
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [visibleProjectIdsKey, projects]);

  const selectedInView = projects.filter((p) => selectedIds.has(p.id)).length;
  const allVisibleSelected = projects.length > 0 && selectedInView === projects.length;

  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedInView > 0 && !allVisibleSelected;
  }, [selectedInView, allVisibleSelected, projects.length]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) projects.forEach((p) => next.delete(p.id));
      else projects.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const projectTableColumns = React.useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-neutral-900"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-neutral-900"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleRow(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={row.original.name}
          />
        ),
      },
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "clientName",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Client {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.original.clientLogoUrl ?? undefined} />
              <AvatarFallback className="text-xs">{(row.original.clientName ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-neutral-900">{row.original.clientName ?? "—"}</span>
          </div>
        ),
      },
      {
        accessorKey: "name",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Project Name {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.original.coverImageUrl ?? undefined} />
              <AvatarFallback className="text-xs">
                {(row.original.name ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <Link href={`/dashboard/projects/${row.original.id}`} className="block truncate text-left font-medium text-primary hover:underline">
                {row.original.name}
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "services",
        enableSorting: false,
        header: () => <span className="text-left">Services</span>,
        cell: ({ row }) => {
          const services = projectServices[row.original.id] ?? [];
          if (services.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {services.slice(0, 2).map((s) => (
                <Badge key={s.id} variant="secondary" className="text-xs">
                  {s.name}
                </Badge>
              ))}
              {services.length > 2 ? (
                <Badge variant="outline" className="text-xs">+{services.length - 2}</Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Status {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
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
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Deadline {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.endDate),
      },
      {
        accessorKey: "budget",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start items-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-left">Budget {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {formatAmount(row.original.budget)}
            <SarCurrencyIcon className="text-neutral-500" />
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setEditingProject(p)}>
                    <Pencil className="me-2 h-4 w-4" />Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProjectToDelete({ id: p.id, name: p.name });
                    }}
                  >
                    <Trash2 className="me-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      allVisibleSelected,
      selectedIds,
      projectServices,
      router,
      setEditingProject,
      setProjectToDelete,
      toggleSelectAll,
    ]
  );

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const reviewProjects = projects.filter((p) => p.status === "review").length;

  return (
    <div className="space-y-5" dir="ltr">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-neutral-900">Projects</h1>
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          + New Project
        </button>
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          clients={clients}
          services={serviceOptions}
          teamMembers={teamMembers}
          defaultCurrency={defaultCurrency}
          onSuccess={() => router.refresh()}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-100 bg-white p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">Total Projects</p>
          <p className="text-2xl font-bold text-black">{totalProjects}</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-white p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">Active Projects</p>
          <p className="text-2xl font-bold text-black">{activeProjects}</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-white p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">Completed Projects</p>
          <p className="text-2xl font-bold text-black">{completedProjects}</p>
        </div>
        <div className="rounded-xl border border-neutral-100 bg-white p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">In Review</p>
          <p className="text-2xl font-bold text-black">{reviewProjects}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2" dir="ltr">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit}>
            <div className="flex w-56 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-400">
              <Input
                placeholder="Search by project or client..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-auto w-full border-0 bg-transparent p-0 text-sm text-neutral-700 shadow-none outline-none placeholder:text-neutral-400 focus-visible:ring-0"
              />
            </div>
          </form>
          <Select dir="ltr" value={statusParam} onValueChange={(v) => updateParams({ status: v })}>
            <SelectTrigger className="h-8 w-auto min-w-40 gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-normal text-neutral-700 shadow-none hover:bg-neutral-50 focus-visible:border-neutral-300 focus-visible:ring-[3px] focus-visible:ring-neutral-400/25">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="inline-flex items-center gap-2">
                    {o.value !== "all" ? (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          STATUS_DOT_CLASS[o.value] ?? "bg-neutral-400"
                        )}
                        aria-hidden
                      />
                    ) : null}
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select dir="ltr" value={clientIdParam} onValueChange={(v) => updateParams({ clientId: v })}>
            <SelectTrigger className="h-8 w-auto min-w-40 gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-normal text-neutral-700 shadow-none hover:bg-neutral-50 focus-visible:border-neutral-300 focus-visible:ring-[3px] focus-visible:ring-neutral-400/25">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={projects.find((p) => p.clientId === c.id)?.clientLogoUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(c.companyName ?? "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{c.companyName || c.id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-800">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No projects match the current filters.</p>
            <NewProjectDialog
              trigger={<Button variant="link" className="mt-2">Create your first project</Button>}
              clients={clients}
              services={serviceOptions}
              teamMembers={teamMembers}
              defaultCurrency={defaultCurrency}
              onSuccess={() => router.refresh()}
            />
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Mobile: project cards */}
        <div className="space-y-2 md:hidden">
          {projects.map((p) => {
            return (
              <div key={p.id} className="flex items-center justify-between rounded-xl border p-4">
                <Link href={`/dashboard/projects/${p.id}`} className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={p.clientLogoUrl ?? undefined} />
                    <AvatarFallback className="text-sm">{(p.clientName ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-muted-foreground text-sm">{p.clientName ?? "—"}</p>
                    {(projectServices[p.id]?.length ?? 0) > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(projectServices[p.id] ?? []).slice(0, 2).map((s) => (
                          <Badge key={s.id} variant="secondary" className="text-[10px]">
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    )}
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
                      <DropdownMenuItem asChild><Link href={`/dashboard/projects/${p.id}`}>View</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingProject(p)}><Pencil className="me-2 h-4 w-4" />Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.preventDefault(); setProjectToDelete({ id: p.id, name: p.name }); }}><Trash2 className="me-2 h-4 w-4" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-neutral-100 bg-white md:block">
          <CardContent className="pt-4">
            <SortableDataTable<ProjectRow>
              columns={projectTableColumns}
              data={projects}
              tableId="projects-table"
              getRowId={(p) => p.id}
              uiVariant="clients"
              columnLabels={{
                clientName: "Client",
                name: "Project Name",
                services: "Services",
                status: "Status",
                endDate: "Deadline",
                budget: "Budget",
              }}
              enablePagination={false}
              enableSavedViews
              getViewStateSnapshot={() => ({
                search: searchInput,
                status: statusParam,
                clientId: clientIdParam,
              })}
              applyViewStateSnapshot={(snapshot) => {
                updateParams({
                  search: snapshot.search,
                  status: snapshot.status,
                  clientId: snapshot.clientId,
                });
              }}
            />
          </CardContent>
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
            <span className="text-xs text-neutral-400">Showing {projects.length} of {projects.length}</span>
            <div className="flex gap-1">
              <button type="button" className="rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50">Previous</button>
              <button type="button" className="rounded-md border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-800">1</button>
              <button type="button" className="rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50">Next</button>
            </div>
          </div>
        </div>
        </>
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
          serviceOptions={serviceOptions}
          initialServiceIds={(projectServices[editingProject.id] ?? []).map((s) => s.id)}
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectToDelete
                ? `Project ${projectToDelete.name} will be deleted permanently with all its tasks. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await handleConfirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected projects?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently delete ${selectedIds.size} projects and their related tasks. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const ids = [...selectedIds];
                if (ids.length === 0) {
                  setBulkDeleteOpen(false);
                  return;
                }
                const result = await deleteProjects(ids);
                if (result.ok) {
                  toast.success("Projects deleted");
                  setSelectedIds(new Set());
                  setBulkDeleteOpen(false);
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="md:hidden fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
        aria-label="New project"
        onClick={() => setNewProjectOpen(true)}
      >
        +
      </button>
    </div>
  );
}
