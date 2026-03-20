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
  type ColumnDef,
  type ColumnFiltersState,
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
import { GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listSavedViews, removeSavedView, upsertSavedView } from "@/lib/table-views";

const ROW_ORDER_KEY = "sortable-table-row-order";

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
            <div className="flex justify-end">
              <GripVertical className="h-4 w-4" />
            </div>
          </TableCell>
        ) : (
          <TableCell
            key={cell.id}
            className={cn(
              uiVariant === "clients" ? "px-4 py-3 text-left text-sm" : "text-right",
              cell.column.id === "actions" && "w-10"
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
}: SortableDataTableProps<T>) {
  const storageKeySort = `sort-${tableId}`;
  const storageKeyRowOrder = `${ROW_ORDER_KEY}-${tableId}`;

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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState.columnVisibility ?? {}
  );
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

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getRowId: (row) => getRowId(row as T),
  });

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
              <TableRow
                key={headerGroup.id}
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
                      header.column.id === dragColumnId && "w-8 pr-1"
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
                  No data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </DndContext>

      {enablePagination && table.getPageCount() > 1 && (
        <div
          className={cn(
            "flex items-center gap-2 pt-4",
            uiVariant === "clients" ? "flex-row justify-between text-left" : "flex-row-reverse justify-end text-right"
          )}
        >
          <div
            className={cn(
              "text-muted-foreground flex-1 text-sm",
              uiVariant === "clients" ? "text-left" : "text-right"
            )}
          >
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} selected rows.
          </div>
          <div className={cn("flex gap-2", uiVariant === "clients" ? "flex-row" : "flex-row-reverse")}
          >
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
