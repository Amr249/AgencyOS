"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_BADGE_CLASS } from "@/types";
import { ClientFormSheet } from "@/components/modules/clients/client-form-sheet";
import { archiveClient, unarchiveClient, deleteClient } from "@/actions/clients";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { clients } from "@/lib/db/schema";

type ClientRow = typeof clients.$inferSelect;


type ClientsDataTableProps = {
  data: ClientRow[];
  showArchived?: boolean;
};

export default function ClientsDataTable({
  data,
  showArchived = false,
}: ClientsDataTableProps) {
  const router = useRouter();
  const [editingClient, setEditingClient] = React.useState<ClientRow | null>(null);
  const [clientToDelete, setClientToDelete] = React.useState<ClientRow | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const columns: ColumnDef<ClientRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "companyName",
        filterFn: (row, _columnId, filterValue) => {
          const s = String(filterValue ?? "").toLowerCase().trim();
          if (!s) return true;
          const name = String(row.original.companyName ?? "").toLowerCase();
          const phone = String(row.original.contactPhone ?? "").toLowerCase();
          return name.includes(s) || phone.includes(s);
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full justify-end gap-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className="text-right">الشركة</span>
          </Button>
        ),
        cell: ({ row }) => {
          const name = row.getValue("companyName") as string;
          const logoUrl = row.original.logoUrl;
          const initial = name ? name.charAt(0).toUpperCase() : "?";
          return (
            <div className="text-right">
              <Link
                href={`/dashboard/clients/${row.original.id}`}
                className="flex items-center justify-end gap-3 font-medium text-primary hover:underline"
              >
                <Avatar className="size-8 shrink-0">
                  {logoUrl ? (
                    <AvatarImage src={logoUrl} alt={name} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                {name}
              </Link>
            </div>
          );
        },
      },
      {
        accessorKey: "contactName",
        header: "جهة الاتصال",
        cell: ({ row }) => row.getValue("contactName") ?? "—",
      },
      {
        accessorKey: "contactPhone",
        header: "الهاتف",
        cell: ({ row }) => row.getValue("contactPhone") ?? "—",
      },
      {
        accessorKey: "status",
        filterFn: (row, columnId, filterValue) =>
          !filterValue ||
          filterValue === "all" ||
          row.getValue(columnId) === filterValue,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full justify-end gap-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className="text-right">الحالة</span>
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const label = CLIENT_STATUS_LABELS[status] ?? status;
          const className = CLIENT_STATUS_BADGE_CLASS[status];
          return (
            <div className="text-right">
            <Badge
              variant="outline"
              className={className ?? undefined}
            >
              {label}
            </Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/clients/${row.original.id}`}>عرض العميل</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditingClient(row.original)}>
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setClientToDelete(row.original);
                }}
              >
                <Trash2 className="me-2 h-4 w-4" />
                حذف
              </DropdownMenuItem>
              {showArchived ? (
                <DropdownMenuItem
                  className="text-green-600 focus:text-green-600"
                  onSelect={async () => {
                    const id = row.original.id;
                    setRestoringId(id);
                    const result = await unarchiveClient(id);
                    setRestoringId(null);
                    if (result.ok) {
                      toast.success("تم استعادة العميل");
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  }}
                  disabled={restoringId === row.original.id}
                >
                  <ArchiveRestore className="me-2 h-4 w-4" />
                  استعادة
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onSelect={async () => {
                    const id = row.original.id;
                    setArchivingId(id);
                    const result = await archiveClient(id);
                    setArchivingId(null);
                    if (result.ok) {
                      toast.success("تم أرشفة العميل");
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  }}
                  disabled={archivingId === row.original.id}
                >
                  <Archive className="me-2 h-4 w-4" />
                  أرشفة
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [showArchived]
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Input
            dir="rtl"
            placeholder="البحث بالاسم أو رقم الهاتف..."
            value={(table.getColumn("companyName")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("companyName")?.setFilterValue(e.target.value)}
            className="max-w-sm text-right"
          />
          <Select
            value={
              (columnFilters.find((f) => f.id === "status")?.value as string) ?? "all"
            }
            onValueChange={(value) =>
              setColumnFilters((prev) => [
                ...prev.filter((f) => f.id !== "status"),
                ...(value && value !== "all" ? [{ id: "status", value }] : []),
              ])
            }
          >
            <SelectTrigger
              className={cn(
                "w-[180px] text-right",
                columnFilters.some((f) => f.id === "status" && f.value) &&
                  "border-primary ring-2 ring-primary/20"
              )}
            >
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="lead">عميل محتمل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="on_hold">متوقف</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table className="border-t">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.id === "actions" ? "w-10" : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === "actions" ? "w-10" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {showArchived
                    ? "لا يوجد عملاء مؤرشفون."
                    : "لا يوجد عملاء بعد. أضف أول عميل للبدء."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex flex-row-reverse items-center justify-end gap-2 pt-4">
          <div className="text-muted-foreground flex-1 text-sm text-right">
            {table.getFilteredSelectedRowModel().rows.length} من{" "}
            {table.getFilteredRowModel().rows.length} صفوف محددة.
          </div>
          <div className="flex flex-row-reverse gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>
      <ClientFormSheet
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient ?? undefined}
      />
      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete
                ? `سيتم حذف العميل ${clientToDelete.companyName ?? "هذا العميل"} نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!clientToDelete) return;
                const id = clientToDelete.id;
                setClientToDelete(null);
                const res = await deleteClient(id);
                if (res.ok) {
                  toast.success("تم حذف العميل");
                  router.push("/dashboard/clients");
                } else {
                  toast.error(res.error);
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
