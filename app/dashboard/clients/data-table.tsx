"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  type Row,
} from "@tanstack/react-table";
import { GripVertical, MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
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

/** Priority for "active clients first" sort (lower = earlier in list). */
const STATUS_SORT_ORDER: Record<string, number> = {
  active: 0,
  lead: 1,
  on_hold: 2,
  completed: 3,
  closed: 4,
};

const TABLE_ID = "clients-table";
const ROW_ORDER_KEY = "sortable-table-row-order";

function reorderRowsById<T>(rows: Row<T>[], rowOrder: string[], getRowId: (original: T) => string): Row<T>[] {
  const validRows = rows.filter((r) => r.original != null);
  if (rowOrder.length === 0) return validRows;
  const orderSet = new Set(rowOrder);
  const byId = new Map(validRows.map((r) => [getRowId(r.original), r]));
  const result: Row<T>[] = [];
  for (const id of rowOrder) {
    const row = byId.get(id);
    if (row) result.push(row);
  }
  for (const row of validRows) {
    if (!orderSet.has(getRowId(row.original))) result.push(row);
  }
  return result;
}

function SortableClientRow({ row }: { row: Row<ClientRow> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.original.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--accent)" : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };
  return (
    <TableRow ref={setNodeRef} style={style} data-state={row.getIsSelected() ? "selected" : undefined}>
      {row.getVisibleCells().map((cell) =>
        cell.column.id === "drag" ? (
          <TableCell
            key={cell.id}
            className="w-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pr-1 text-right"
            {...attributes}
            {...listeners}
          >
            <div className="flex justify-end">
              <GripVertical className="h-4 w-4" />
            </div>
          </TableCell>
        ) : (
          <TableCell
            key={cell.id}
            className={cn("text-right", cell.column.id === "actions" ? "w-10" : undefined)}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      )}
    </TableRow>
  );
}

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
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (typeof window === "undefined") return [{ id: "status", desc: false }];
    try {
      const saved = localStorage.getItem(`sort-${TABLE_ID}`);
      return saved ? JSON.parse(saved) : [{ id: "status", desc: false }];
    } catch {
      return [{ id: "status", desc: false }];
    }
  });
  const [rowOrder, setRowOrder] = React.useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(`${ROW_ORDER_KEY}-${TABLE_ID}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`sort-${TABLE_ID}`, JSON.stringify(sorting));
    } catch {
      /* ignore */
    }
  }, [sorting]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`${ROW_ORDER_KEY}-${TABLE_ID}`, JSON.stringify(rowOrder));
    } catch {
      /* ignore */
    }
  }, [rowOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns: ColumnDef<ClientRow>[] = React.useMemo(
    () => [
      {
        id: "drag",
        header: () => null,
        cell: () => null,
        enableSorting: false,
        size: 32,
      },
      {
        accessorKey: "companyName",
        enableSorting: true,
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
            className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-right">
              الشركة
              {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : " ↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const name = row.getValue("companyName") as string;
          const logoUrl = row.original.logoUrl;
          const initial = name ? name.charAt(0).toUpperCase() : "?";
          return (
            <Link
              href={`/dashboard/clients/${row.original.id}`}
              className="font-medium text-primary hover:underline"
            >
              <div className="flex items-center gap-2 justify-end w-full">
                <span>{name}</span>
                <Avatar className="h-8 w-8 shrink-0">
                  {logoUrl ? (
                    <AvatarImage src={logoUrl} alt={name} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: "contactName",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-right">
              جهة الاتصال
              {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : " ↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-right block">{row.getValue("contactName") ?? "—"}</span>
        ),
      },
      {
        accessorKey: "contactPhone",
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-right">
              الهاتف
              {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : " ↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <span dir="ltr">{row.getValue("contactPhone") ?? "—"}</span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = STATUS_SORT_ORDER[rowA.original.status ?? ""] ?? 99;
          const b = STATUS_SORT_ORDER[rowB.original.status ?? ""] ?? 99;
          return a - b;
        },
        filterFn: (row, columnId, filterValue) =>
          !filterValue ||
          filterValue === "all" ||
          row.getValue(columnId) === filterValue,
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span className="text-right">
              الحالة
              {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : " ↕"}
            </span>
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const label = CLIENT_STATUS_LABELS[status] ?? status;
          const className = CLIENT_STATUS_BADGE_CLASS[status];
          return (
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <Badge variant="outline" className={className ?? undefined}>
                {label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-start">
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
          </div>
        ),
      },
    ],
    [showArchived]
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
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

  const sortedRows = table.getRowModel().rows;
  const displayRows = React.useMemo(
    () => reorderRowsById(sortedRows, rowOrder, (original) => original?.id ?? ""),
    [sortedRows, rowOrder]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayRows.findIndex((r) => r.original.id === active.id);
    const newIndex = displayRows.findIndex((r) => r.original.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(displayRows, oldIndex, newIndex);
    setRowOrder(reordered.map((r) => r.original.id));
  };

  const CLIENT_COLUMN_LABELS: Record<string, string> = {
    companyName: "الشركة",
    contactName: "جهة الاتصال",
    contactPhone: "الهاتف",
    status: "الحالة",
  };

  const filteredRows = table.getFilteredRowModel().rows;

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Input
            dir="rtl"
            placeholder="البحث بالاسم أو رقم الهاتف..."
            value={(table.getColumn("companyName")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("companyName")?.setFilterValue(e.target.value)}
            className="w-full text-right sm:max-w-sm"
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
                "w-full text-right sm:w-[180px]",
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

        {/* Notion-style sort toolbar (desktop) */}
        <div className="mb-2 hidden flex-wrap items-center gap-3 text-sm md:flex" dir="rtl">
          {sorting.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>مرتب حسب:</span>
              <span className="font-medium text-foreground">
                {CLIENT_COLUMN_LABELS[sorting[0].id] ?? sorting[0].id} {sorting[0].desc ? "↓" : "↑"}
              </span>
              <button
                type="button"
                onClick={() => setSorting([])}
                className="hover:text-foreground rounded p-0.5 text-lg leading-none"
                aria-label="إزالة الترتيب"
              >
                ×
              </button>
            </div>
          )}
          <Select
            value={sorting.length ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "none"}
            onValueChange={(value) => {
              if (value === "none") {
                setSorting([]);
                return;
              }
              const [id, dir] = value.split(":");
              setSorting([{ id, desc: dir === "desc" }]);
            }}
          >
            <SelectTrigger className="h-8 w-[160px] text-right text-muted-foreground">
              <SelectValue placeholder="فرز" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون ترتيب</SelectItem>
              <SelectItem value="companyName:asc">الشركة ↑</SelectItem>
              <SelectItem value="companyName:desc">الشركة ↓</SelectItem>
              <SelectItem value="contactName:asc">جهة الاتصال ↑</SelectItem>
              <SelectItem value="contactName:desc">جهة الاتصال ↓</SelectItem>
              <SelectItem value="contactPhone:asc">الهاتف ↑</SelectItem>
              <SelectItem value="contactPhone:desc">الهاتف ↓</SelectItem>
              <SelectItem value="status:asc">الحالة ↑</SelectItem>
              <SelectItem value="status:desc">الحالة ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile: card list */}
        <div className="space-y-2 md:hidden">
          {filteredRows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {showArchived ? "لا يوجد عملاء مؤرشفون." : "لا يوجد عملاء بعد. أضف أول عميل للبدء."}
            </p>
          ) : (
            filteredRows.map((row) => {
              const c = row.original;
              const name = c.companyName ?? "—";
              const initial = name !== "—" ? name.charAt(0).toUpperCase() : "?";
              const status = c.status;
              const label = CLIENT_STATUS_LABELS[status] ?? status;
              const statusClassName = CLIENT_STATUS_BADGE_CLASS[status];
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="size-10 shrink-0">
                      {c.logoUrl ? (
                        <AvatarImage src={c.logoUrl} alt={name} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-right">
                      <p className="font-medium">{name}</p>
                      <p className="text-muted-foreground text-sm">{c.contactPhone ?? "—"}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusClassName ?? undefined}>
                      {label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/clients/${c.id}`}>عرض العميل</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setEditingClient(c)}>
                          تعديل
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            setClientToDelete(c);
                          }}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          حذف
                        </DropdownMenuItem>
                        {showArchived ? (
                          <DropdownMenuItem
                            className="text-green-600 focus:text-green-600"
                            onSelect={async () => {
                              const id = c.id;
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
                            disabled={restoringId === c.id}
                          >
                            <ArchiveRestore className="me-2 h-4 w-4" />
                            استعادة
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-600"
                            onSelect={async () => {
                              const id = c.id;
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
                            disabled={archivingId === c.id}
                          >
                            <Archive className="me-2 h-4 w-4" />
                            أرشفة
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: table with drag-to-reorder */}
        <div className="hidden md:block" dir="rtl">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
          <Table className="border-t" style={{ direction: "rtl" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-right",
                        header.column.id === "actions" ? "w-10" : undefined,
                        header.column.id === "drag" ? "w-8 pr-1" : undefined
                      )}
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
              {displayRows.length ? (
                <SortableContext
                  items={displayRows.map((r) => r.original.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayRows.map((row) => (
                    <SortableClientRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-right">
                    {showArchived
                      ? "لا يوجد عملاء مؤرشفون."
                      : "لا يوجد عملاء بعد. أضف أول عميل للبدء."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
        <div className="flex flex-row-reverse items-center justify-end gap-2 pt-4 text-right">
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
