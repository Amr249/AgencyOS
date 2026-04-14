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
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Columns3, GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { listSavedViews, removeSavedView, upsertSavedView } from "@/lib/table-views";

const ROW_ORDER_KEY = "sortable-table-row-order";

/** Declarative per-column filters (second header row). */
export type TableColumnFilterMeta =
  | { variant: "text"; placeholder?: string }
  | {
      variant: "select";
      options: { value: string; label: string }[];
      allValue?: string;
      allLabel?: string;
    };

/** Optional layout classes merged into header/cells (e.g. `min-w-[…]`). */
export type SortableColumnLayoutMeta = {
  columnFilter?: TableColumnFilterMeta;
  headerClassName?: string;
  cellClassName?: string;
};

function TableColumnFilterCell<T>({ column }: { column: Column<T> }) {
  const meta = column.columnDef.meta as SortableColumnLayoutMeta | undefined;
  const filter = meta?.columnFilter;
  if (!filter) {
    return <div className="h-8" />;
  }
  const raw = column.getFilterValue();
  if (filter.variant === "text") {
    return (
      <Input
        className="h-8 text-sm"
        placeholder={filter.placeholder ?? "…"}
        value={(raw as string) ?? ""}
        onChange={(e) => column.setFilterValue(e.target.value.trim() ? e.target.value : undefined)}
      />
    );
  }
  const allVal = filter.allValue ?? "__all__";
  const val = raw === undefined || raw === "" ? allVal : String(raw);
  return (
    <Select
      value={val}
      onValueChange={(v) => column.setFilterValue(v === allVal ? undefined : v)}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={filter.allLabel ?? "All"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allVal}>{filter.allLabel ?? "All"}</SelectItem>
        {filter.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function reorderRowsById<T>(rows: Row<T>[], rowOrder: string[], getRowId: (row: T) => string): Row<T>[] {
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

function SortableTableRow<T>({
  row,
  getRowId,
  dragColumnId = "drag",
  uiVariant = "default",
}: {
  row: Row<T>;
  getRowId: (row: T) => string;
  dragColumnId?: string;
  uiVariant?: "default" | "clients";
}) {
  const id = getRowId(row.original);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
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
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() ? "selected" : undefined}
      className={cn(
        uiVariant === "clients" &&
          "group cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
      )}
    >
      {row.getVisibleCells().map((cell) =>
        cell.column.id === dragColumnId ? (
          <TableCell
            key={cell.id}
            className={cn(
              "w-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pr-1",
              uiVariant === "clients" ? "text-left" : "text-right"
            )}
            {...attributes}
            {...listeners}
          >
            <div className={cn("flex", uiVariant === "clients" ? "justify-start" : "justify-end")}>
              <GripVertical className="h-4 w-4" />
            </div>
          </TableCell>
        ) : (
          <TableCell
            key={cell.id}
            className={cn(
              uiVariant === "clients" ? "px-4 py-3 text-left text-sm" : "text-right",
              cell.column.id === "actions" && "w-10",
              (cell.column.columnDef.meta as SortableColumnLayoutMeta | undefined)?.cellClassName
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      )}
    </TableRow>
  );
}

export type SortableDataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  tableId: string;
  getRowId: (row: T) => string;
  onReorder?: (newOrder: T[]) => void;
  columnLabels?: Record<string, string>;
  initialState?: {
    columnFilters?: ColumnFiltersState;
    columnVisibility?: VisibilityState;
  };
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (updater: (prev: ColumnFiltersState) => ColumnFiltersState) => void;
  enablePagination?: boolean;
  enableRowOrderPersistence?: boolean;
  dragColumnId?: string;
  uiVariant?: "default" | "clients";
  enableSavedViews?: boolean;
  getViewStateSnapshot?: () => Record<string, string>;
  applyViewStateSnapshot?: (snapshot: Record<string, string>) => void;
  /** Second header row driven by `columnDef.meta.columnFilter`. */
  enableColumnFilterRow?: boolean;
  /** Columns dropdown + optional localStorage persistence (`table-columns-${tableId}`). */
  enableColumnVisibilityControl?: boolean;
  persistColumnVisibility?: boolean;
  /** When set with `enablePagination`, show page size control and persist size to localStorage. */
  pageSizeOptions?: number[];
  /** Row shown when the table has no rows (after filters). */
  emptyStateMessage?: string;
};

export function SortableDataTable<T>({
  columns,
  data,
  tableId,
  getRowId,
  onReorder,
  columnLabels = {},
  initialState = {},
  enablePagination = true,
  enableRowOrderPersistence = true,
  dragColumnId = "drag",
  uiVariant = "default",
  enableSavedViews = false,
  getViewStateSnapshot,
  applyViewStateSnapshot,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange: controlledOnColumnFiltersChange,
  enableColumnFilterRow = false,
  enableColumnVisibilityControl = false,
  persistColumnVisibility = false,
  pageSizeOptions,
  emptyStateMessage = "No data.",
}: SortableDataTableProps<T>) {
  const storageKeySort = `sort-${tableId}`;
  const storageKeyRowOrder = `${ROW_ORDER_KEY}-${tableId}`;
  const storageKeyColumns = `table-columns-${tableId}`;
  const storageKeyPageSize = `table-pageSize-${tableId}`;
  const resolvedPageSizes = pageSizeOptions?.length ? pageSizeOptions : null;
  const defaultPageSize = resolvedPageSizes?.[0] ?? 10;

  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKeySort);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [rowOrder, setRowOrder] = React.useState<string[]>(() => {
    if (typeof window === "undefined" || !enableRowOrderPersistence) return [];
    try {
      const saved = localStorage.getItem(storageKeyRowOrder);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    initialState.columnFilters ?? []
  );
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const setColumnFilters = controlledOnColumnFiltersChange ?? setInternalColumnFilters;
  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      setColumnFilters((prev) =>
        typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue
      );
    },
    [setColumnFilters]
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    if (persistColumnVisibility && typeof window !== "undefined") {
      try {
        const s = localStorage.getItem(storageKeyColumns);
        if (s) return JSON.parse(s) as VisibilityState;
      } catch {
        /* ignore */
      }
    }
    return initialState.columnVisibility ?? {};
  });

  const [pagination, setPagination] = React.useState<PaginationState>(() => {
    if (!enablePagination) return { pageIndex: 0, pageSize: defaultPageSize };
    if (typeof window === "undefined") return { pageIndex: 0, pageSize: defaultPageSize };
    if (resolvedPageSizes) {
      try {
        const raw = localStorage.getItem(storageKeyPageSize);
        const n = raw ? parseInt(raw, 10) : defaultPageSize;
        const size = resolvedPageSizes.includes(n) ? n : defaultPageSize;
        return { pageIndex: 0, pageSize: size };
      } catch {
        return { pageIndex: 0, pageSize: defaultPageSize };
      }
    }
    return { pageIndex: 0, pageSize: 10 };
  });

  const dataIdentityKey = React.useMemo(
    () => data.map((row) => getRowId(row as T)).join("\0"),
    [data, getRowId]
  );

  React.useEffect(() => {
    if (!enablePagination) return;
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [dataIdentityKey, enablePagination]);

  const [rowSelection, setRowSelection] = React.useState({});
  const [savedViews, setSavedViews] = React.useState(() => listSavedViews(tableId));
  const [selectedViewId, setSelectedViewId] = React.useState<string>("none");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKeySort, JSON.stringify(sorting));
    } catch {
      /* ignore */
    }
  }, [sorting, storageKeySort]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !enableRowOrderPersistence) return;
    try {
      localStorage.setItem(storageKeyRowOrder, JSON.stringify(rowOrder));
    } catch {
      /* ignore */
    }
  }, [rowOrder, storageKeyRowOrder, enableRowOrderPersistence]);

  React.useEffect(() => {
    if (!persistColumnVisibility || typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKeyColumns, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility, persistColumnVisibility, storageKeyColumns]);

  React.useEffect(() => {
    if (!enablePagination || !resolvedPageSizes || typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKeyPageSize, String(pagination.pageSize));
    } catch {
      /* ignore */
    }
  }, [enablePagination, pagination.pageSize, resolvedPageSizes, storageKeyPageSize]);

  const columnFiltersKey = JSON.stringify(columnFilters);
  React.useEffect(() => {
    if (!enablePagination) return;
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [columnFiltersKey, enablePagination]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(enablePagination ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    ...(enablePagination ? { onPaginationChange: setPagination } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getRowId: (row) => getRowId(row as T),
  });

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  React.useEffect(() => {
    if (!enablePagination) return;
    setPagination((p) => {
      const maxIdx = Math.max(0, Math.ceil(filteredRowCount / p.pageSize) - 1);
      if (p.pageIndex > maxIdx) return { ...p, pageIndex: maxIdx };
      return p;
    });
  }, [enablePagination, filteredRowCount, pagination.pageSize]);

  const sortedRows = table.getRowModel().rows;
  const displayRows = React.useMemo(
    () => reorderRowsById(sortedRows, rowOrder, getRowId),
    [sortedRows, rowOrder, getRowId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayRows.findIndex((r) => getRowId(r.original) === active.id);
    const newIndex = displayRows.findIndex((r) => getRowId(r.original) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(displayRows, oldIndex, newIndex);
    const newOrder = reordered.map((r) => getRowId(r.original));
    setRowOrder(newOrder);
    onReorder?.(reordered.map((r) => r.original));
  };

  const sortableIds = React.useMemo(
    () => displayRows.map((r) => getRowId(r.original)),
    [displayRows, getRowId]
  );

  const getColumnLabel = (columnId: string) =>
    columnLabels[columnId] ?? columnId;

  const applySavedView = React.useCallback(
    (viewId: string) => {
      if (viewId === "none") {
        setSelectedViewId("none");
        return;
      }
      const view = savedViews.find((v) => v.id === viewId);
      if (!view) return;
      if (view.sort) setSorting(view.sort);
      if (view.visibility) setColumnVisibility(view.visibility);
      if (view.filters && applyViewStateSnapshot) applyViewStateSnapshot(view.filters);
      setSelectedViewId(viewId);
    },
    [savedViews, applyViewStateSnapshot]
  );

  return (
    <div className="w-full space-y-2">
      {/* Notion-style sort toolbar */}
      <div className="flex flex-wrap items-center gap-3 text-sm" dir={uiVariant === "clients" ? "ltr" : "rtl"}>
        {enableSavedViews && (
          <>
            <Select value={selectedViewId} onValueChange={applySavedView}>
              <SelectTrigger className="h-8 w-[180px] text-muted-foreground">
                <SelectValue placeholder="Saved view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default view</SelectItem>
                {savedViews.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => {
                const id = crypto.randomUUID();
                const next = upsertSavedView(tableId, {
                  id,
                  name: `View ${savedViews.length + 1}`,
                  filters: getViewStateSnapshot?.() ?? {},
                  sort: sorting,
                  visibility: columnVisibility,
                  createdAt: Date.now(),
                });
                setSavedViews(next);
                setSelectedViewId(id);
              }}
            >
              Save view
            </button>
            <button
              type="button"
              disabled={selectedViewId === "none"}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              onClick={() => {
                if (selectedViewId === "none") return;
                const next = removeSavedView(tableId, selectedViewId);
                setSavedViews(next);
                setSelectedViewId("none");
              }}
            >
              Delete view
            </button>
          </>
        )}
        {enableColumnVisibilityControl && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" type="button">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="text-sm"
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {getColumnLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {sorting.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Sorted by:</span>
            <span className="font-medium text-foreground">
              {getColumnLabel(sorting[0].id)} {sorting[0].desc ? "↓" : "↑"}
            </span>
            <button
              type="button"
              onClick={() => setSorting([])}
              className="hover:text-foreground rounded p-0.5 text-lg leading-none"
              aria-label="Clear sort"
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
          <SelectTrigger
            className={cn(
              "h-8 w-[160px] text-muted-foreground",
              uiVariant === "clients" ? "text-left" : "text-right"
            )}
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No sorting</SelectItem>
            {columns
              .filter((c) => c.enableSorting !== false && (c.id ?? (c as { accessorKey?: string }).accessorKey) && c.id !== dragColumnId)
              .map((col) => {
                const id = String(col.id ?? (col as { accessorKey?: string }).accessorKey ?? "");
                if (!id) return null;
                return (
                  <React.Fragment key={id}>
                    <SelectItem value={`${id}:asc`}>{getColumnLabel(id)} ↑</SelectItem>
                    <SelectItem value={`${id}:desc`}>{getColumnLabel(id)} ↓</SelectItem>
                  </React.Fragment>
                );
              })}
          </SelectContent>
        </Select>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <div className={cn(uiVariant === "clients" && "w-full overflow-x-auto")}>
          <Table
            className={cn(
              uiVariant === "clients" ? "w-full min-w-[980px] border-collapse" : "border-t"
            )}
            dir={uiVariant === "clients" ? "ltr" : "rtl"}
            style={{ direction: uiVariant === "clients" ? "ltr" : "rtl" }}
          >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <TableRow
                  className={cn(uiVariant === "clients" && "border-b border-neutral-100 bg-neutral-50")}
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        uiVariant === "clients"
                          ? "px-4 py-2.5 text-xs font-medium text-neutral-400 text-left"
                          : "text-right",
                        header.column.id === "actions" && "w-10",
                        header.column.id === dragColumnId && "w-8 pr-1",
                        (header.column.columnDef.meta as SortableColumnLayoutMeta | undefined)
                          ?.headerClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
                {enableColumnFilterRow ? (
                  <TableRow
                    className={cn(
                      "border-b hover:bg-transparent",
                      uiVariant === "clients" ? "bg-neutral-50/80" : "bg-muted/40"
                    )}
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={`filter-${header.id}`}
                        className={cn(
                          "p-2 align-top",
                          uiVariant === "clients" ? "px-4 text-left" : "text-right",
                          header.column.id === "actions" && "w-10",
                          header.column.id === dragColumnId && "w-8 pr-1",
                          (header.column.columnDef.meta as SortableColumnLayoutMeta | undefined)
                            ?.headerClassName
                        )}
                      >
                        <TableColumnFilterCell column={header.column} />
                      </TableHead>
                    ))}
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
          </TableHeader>
          <TableBody>
            {displayRows.length ? (
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {displayRows.map((row) => (
                  <SortableTableRow
                    key={row.id}
                    row={row}
                    getRowId={getRowId}
                    dragColumnId={dragColumnId}
                    uiVariant={uiVariant}
                  />
                ))}
              </SortableContext>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className={cn(
                    "h-24 text-muted-foreground",
                    uiVariant === "clients" ? "text-left" : "text-right"
                  )}
                >
                  {emptyStateMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </DndContext>

      {enablePagination && (
        <div
          className={cn(
            "flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
            uiVariant === "clients" ? "text-left" : "text-right"
          )}
        >
          <div
            className={cn(
              "text-muted-foreground text-sm",
              uiVariant === "clients" ? "text-left" : "text-right"
            )}
          >
            {(() => {
              const filtered = table.getFilteredRowModel().rows.length;
              const { pageIndex, pageSize } = table.getState().pagination;
              const from = filtered === 0 ? 0 : pageIndex * pageSize + 1;
              const to = Math.min((pageIndex + 1) * pageSize, filtered);
              return (
                <>
                  Showing {from}
                  {from !== 0 ? `–${to}` : ""} of {filtered}
                  {table.getFilteredSelectedRowModel().rows.length > 0 ? (
                    <span className="ms-1">
                      ({table.getFilteredSelectedRowModel().rows.length} selected)
                    </span>
                  ) : null}
                </>
              );
            })()}
          </div>
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              uiVariant === "clients" ? "justify-start sm:justify-end" : "justify-end"
            )}
          >
            {resolvedPageSizes ? (
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(v) => {
                  const size = parseInt(v, 10);
                  table.setPageSize(size);
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 w-[100px]",
                    uiVariant === "clients" ? "text-left" : "text-right"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolvedPageSizes.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className={cn("flex items-center gap-2", uiVariant === "clients" ? "flex-row" : "flex-row-reverse")}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <span className="text-muted-foreground min-w-[5.5rem] text-center text-sm tabular-nums">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {Math.max(1, table.getPageCount())}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
