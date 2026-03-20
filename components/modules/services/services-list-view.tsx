"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { EntityTableShell } from "@/components/ui/entity-table-shell";
import { deleteService, type ServiceRow } from "@/actions/services";
import { NewServiceModal } from "@/components/modules/services/new-service-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function ServicesListView({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = React.useState<ServiceRow | null>(null);

  const columns = React.useMemo<ColumnDef<ServiceRow>[]>(() => [
    { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
    { accessorKey: "name", header: "Service", cell: ({ row }) => <span className="font-medium">{row.original.name}</span>, enableSorting: true },
    { accessorKey: "description", header: "Description", cell: ({ row }) => row.original.description ?? "—", enableSorting: true },
    { accessorKey: "status", header: "Status", enableSorting: true, cell: ({ row }) => <Badge variant={row.original.status === "active" ? "default" : "secondary"}>{row.original.status === "active" ? "Active" : "Inactive"}</Badge> },
    { accessorKey: "projectCount", header: "Projects", enableSorting: true, cell: ({ row }) => `${row.original.projectCount}` },
    {
      id: "actions",
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><IconDotsVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setEditing(row.original)}><IconPencil className="me-2 h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(row.original)}><IconTrash className="me-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);

  return (
    <EntityTableShell
      title="Services"
      dir="ltr"
      topRight={<NewServiceModal trigger={<button type="button" className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800">+ New Service</button>} asChild onSuccess={() => router.refresh()} />}
      isEmpty={services.length === 0}
      emptyState={<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"><p className="text-muted-foreground mb-4">No services yet.</p><NewServiceModal trigger={<Button>+ New Service</Button>} asChild onSuccess={() => router.refresh()} /></div>}
      mobileContent={null}
      tableContent={<div className="hidden md:block p-4"><SortableDataTable<ServiceRow> columns={columns} data={services} tableId="services-table" getRowId={(s) => s.id} enablePagination={false} uiVariant="clients" enableSavedViews /></div>}
    >
      <NewServiceModal trigger={<span className="sr-only" />} service={editing ?? undefined} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} onSuccess={() => { setEditing(null); router.refresh(); }} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete service</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {deleting?.name}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { if (!deleting) return; const res = await deleteService(deleting.id); if (res.ok) { toast.success("Service deleted"); setDeleting(null); router.refresh(); } else toast.error(res.error); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityTableShell>
  );
}
