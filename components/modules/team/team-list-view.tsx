"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { EntityTableShell } from "@/components/ui/entity-table-shell";
import { NewMemberModal } from "@/components/modules/team/new-member-modal";
import { assignMemberToProject, deleteTeamMember, type TeamMemberWithProjectCount } from "@/actions/team";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

type TeamListViewProps = {
  members: TeamMemberWithProjectCount[];
  projects: { id: string; name: string }[];
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamListView({ members, projects }: TeamListViewProps) {
  const t = useTranslations("team");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";
  const router = useRouter();
  const [editingMember, setEditingMember] = React.useState<TeamMemberWithProjectCount | null>(null);
  const [memberToDelete, setMemberToDelete] = React.useState<TeamMemberWithProjectCount | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [assignProjectId, setAssignProjectId] = React.useState("");
  const [roleOnProject, setRoleOnProject] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    const result = await deleteTeamMember(memberToDelete.id);
    setDeleting(false);
    setMemberToDelete(null);
    if (result.ok) {
      toast.success(t("toastMemberDeleted"));
      router.refresh();
    } else {
      toast.error(result.error ?? t("toastDeleteFailed"));
    }
  };

  const refresh = () => router.refresh();
  const visibleMemberIdsKey = members.map((m) => m.id).join("\0");

  React.useEffect(() => {
    const visibleSet = new Set(members.map((m) => m.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleSet.has(id)));
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [visibleMemberIdsKey, members]);

  const selectedInView = members.filter((m) => selectedIds.has(m.id)).length;
  const allVisibleSelected = members.length > 0 && selectedInView === members.length;

  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedInView > 0 && !allVisibleSelected;
  }, [selectedInView, allVisibleSelected, members.length]);

  const toggleSelectAll = React.useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) members.forEach((m) => next.delete(m.id));
      else members.forEach((m) => next.add(m.id));
      return next;
    });
  }, [allVisibleSelected, members]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const teamTableColumns = React.useMemo<ColumnDef<TeamMemberWithProjectCount>[]>(
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
            aria-label={t("selectAllRows")}
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
        accessorKey: "name",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-start">{t("name")} {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/dashboard/team/${row.original.id}`} className="flex items-center gap-3 no-underline min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={row.original.avatarUrl ?? undefined} alt={row.original.name} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">{getInitials(row.original.name)}</AvatarFallback>
            </Avatar>
            <span className="font-bold truncate">{row.original.name}</span>
          </Link>
        ),
      },
      {
        accessorKey: "role",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-start">{t("role")} {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.role ?? "—"}</span>,
      },
      {
        accessorKey: "phone",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-start">{t("phone")} {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span dir="ltr">{row.original.phone ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-start">{t("status")} {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "default" : "secondary"}
            className={row.original.status === "active" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {row.original.status === "active" ? t("active") : t("inactive")}
          </Badge>
        ),
      },
      {
        accessorKey: "projectCount",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-start gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-start">{t("projects")} {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {t("projectsCount", { count: row.original.projectCount })}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const member = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedIds(new Set([member.id]));
                    setAssignDialogOpen(true);
                  }}
                  disabled={projects.length === 0}
                >
                  {t("assignToProject")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingMember(member)}>
                  <IconPencil className="me-2 h-4 w-4" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setMemberToDelete(member)}>
                  <IconTrash className="me-2 h-4 w-4" />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [allVisibleSelected, selectedIds, toggleSelectAll, projects.length, t]
  );

  return (
    <div dir={pageDir}>
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-800">
            {t("selectedCount", { count: selectedIds.size })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("clearSelection")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setAssignDialogOpen(true)}
              disabled={projects.length === 0}
            >
              {t("assignToProject")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <IconTrash className="h-4 w-4" />
              {t("delete")}
            </button>
          </div>
        </div>
      )}

      <EntityTableShell
      title={t("title")}
      dir={pageDir}
      topRight={
        <NewMemberModal
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              + {t("addMember")}
            </button>
          }
          asChild
          onSuccess={refresh}
        />
      }
      isEmpty={members.length === 0}
      emptyState={
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground mb-4">{t("emptyState")}</p>
          <NewMemberModal
            trigger={<Button>+ {t("addMember")}</Button>}
            asChild
            onSuccess={refresh}
          />
        </div>
      }
      mobileContent={
        <div className="space-y-2 md:hidden">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-xl border p-4">
              <Link href={`/dashboard/team/${member.id}`} className="flex min-w-0 items-center gap-3 no-underline">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{member.name}</p>
                  <p className="text-muted-foreground text-sm truncate">{member.role ?? "—"}</p>
                  <p className="text-muted-foreground text-sm" dir="ltr">{member.phone ?? "—"}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={member.status === "active" ? "default" : "secondary"}
                  className={member.status === "active" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {member.status === "active" ? t("active") : t("inactive")}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9">
                      <IconDotsVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedIds(new Set([member.id]));
                        setAssignDialogOpen(true);
                      }}
                      disabled={projects.length === 0}
                    >
                      {t("assignToProject")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingMember(member)}>
                      <IconPencil className="me-2 h-4 w-4" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setMemberToDelete(member)}>
                      <IconTrash className="me-2 h-4 w-4" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      }
      tableContent={
        <div className="hidden md:block p-4">
          <SortableDataTable<TeamMemberWithProjectCount>
            columns={teamTableColumns}
            data={members}
            tableId="team-table"
            getRowId={(m) => m.id}
            columnLabels={{
              name: t("name"),
              role: t("role"),
              phone: t("phone"),
              status: t("status"),
              projectCount: t("projects"),
            }}
            enablePagination={false}
            uiVariant="clients"
            enableSavedViews
          />
        </div>
      }
    >
      <NewMemberModal
        trigger={<span className="sr-only" />}
        member={editingMember ?? undefined}
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        onSuccess={() => {
          setEditingMember(null);
          refresh();
        }}
      />
      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent dir={pageDir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteMemberTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete ? t("deleteMemberDescription", { name: memberToDelete.name }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir={pageDir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bulkDeleteDescription", { count: selectedIds.size })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const ids = [...selectedIds];
                if (ids.length === 0) {
                  setBulkDeleteOpen(false);
                  return;
                }
                setDeleting(true);
                const results = await Promise.all(ids.map((id) => deleteTeamMember(id)));
                setDeleting(false);
                const failed = results.find((r) => !r.ok);
                if (failed && !failed.ok) {
                  toast.error(failed.error ?? t("toastBulkDeleteFailed"));
                  return;
                }
                toast.success(t("toastMembersDeleted"));
                setSelectedIds(new Set());
                setBulkDeleteOpen(false);
                router.refresh();
              }}
              disabled={deleting}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={pageDir}>
          <DialogHeader>
            <DialogTitle>{t("assignDialogTitle")}</DialogTitle>
            <DialogDescription>{t("assignDialogDescription", { count: selectedIds.size })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium">{t("project")}</label>
              <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">{t("roleOnProject")}</label>
              <Input
                placeholder={t("roleOnProjectPlaceholder")}
                value={roleOnProject}
                onChange={(e) => setRoleOnProject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={async () => {
                const ids = [...selectedIds];
                if (!assignProjectId || ids.length === 0) return;
                setAssigning(true);
                const results = await Promise.all(
                  ids.map((id) => assignMemberToProject(assignProjectId, id, roleOnProject.trim() || null))
                );
                setAssigning(false);
                const failed = results.filter((r) => !r.ok);
                if (failed.length === 0) {
                  toast.success(t("toastMembersAssigned"));
                  setAssignDialogOpen(false);
                  setAssignProjectId("");
                  setRoleOnProject("");
                  setSelectedIds(new Set());
                  router.refresh();
                  return;
                }
                if (failed.length === ids.length) {
                  toast.error(t("toastAssignFailed"));
                  return;
                }
                toast.error(t("toastAssignPartial", { ok: ids.length - failed.length, failed: failed.length }));
                setAssignDialogOpen(false);
                setAssignProjectId("");
                setRoleOnProject("");
                setSelectedIds(new Set());
                router.refresh();
              }}
              disabled={assigning || !assignProjectId || selectedIds.size === 0}
            >
              {assigning ? t("assigning") : t("assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityTableShell>
    </div>
  );
}
