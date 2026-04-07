"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Updater,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 10;
/** Stable default reference for `pageSizeOptions` when prop is omitted. */
const DEFAULT_PAGE_SIZE_OPTIONS: number[] = [5, 10, 20, 50, 100];

function pageSizeStorageKey(tableId: string) {
  return `paginated-table:pageSize:${tableId}`;
}

export interface PaginatedTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  tableId?: string;
  /** Stable row id for keys; defaults to index within the full dataset for the current page. */
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function PaginatedTable<T>({
  data,
  columns,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  tableId,
  getRowId: getRowIdProp,
  emptyMessage = "No data.",
  className,
}: PaginatedTableProps<T>) {
  const safeDefaultSize = pageSizeOptions.includes(defaultPageSize)
    ? defaultPageSize
    : pageSizeOptions[0] ?? DEFAULT_PAGE_SIZE;

  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: safeDefaultSize,
  });

  React.useEffect(() => {
    if (!tableId || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(pageSizeStorageKey(tableId));
      if (!raw) return;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && pageSizeOptions.includes(n)) {
        setPagination((p) => ({ ...p, pageSize: n, pageIndex: 0 }));
      }
    } catch {
      /* ignore */
    }
  }, [tableId, pageSizeOptions]);

  const onPaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      setPagination((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (tableId && typeof window !== "undefined" && next.pageSize !== prev.pageSize) {
          try {
            localStorage.setItem(pageSizeStorageKey(tableId), String(next.pageSize));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [tableId]
  );

  const total = data.length;
  const pageCount = total === 0 ? 0 : Math.ceil(total / pagination.pageSize);
  const safePageIndex =
    pageCount === 0 ? 0 : Math.min(pagination.pageIndex, pageCount - 1);

  React.useEffect(() => {
    if (pagination.pageIndex !== safePageIndex) {
      setPagination((p) => ({ ...p, pageIndex: safePageIndex }));
    }
  }, [pagination.pageIndex, safePageIndex]);

  const pagedData = React.useMemo(() => {
    const start = safePageIndex * pagination.pageSize;
    return data.slice(start, start + pagination.pageSize);
  }, [data, safePageIndex, pagination.pageSize]);

  const getRowId = React.useCallback(
    (row: T, index: number) => {
      if (getRowIdProp) return getRowIdProp(row);
      return String(safePageIndex * pagination.pageSize + index);
    },
    [getRowIdProp, safePageIndex, pagination.pageSize]
  );

  const table = useReactTable({
    data: pagedData,
    columns,
    pageCount,
    state: {
      pagination: { ...pagination, pageIndex: safePageIndex },
    },
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId,
  });

  const from = total === 0 ? 0 : safePageIndex * pagination.pageSize + 1;
  const to = Math.min((safePageIndex + 1) * pagination.pageSize, total);
  const currentPage = safePageIndex + 1;
  const totalPages = pageCount;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {total === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, columns.length)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm tabular-nums">
            Showing {from}–{to} of {total}
            {totalPages > 1 ? (
              <span className="ms-1">
                (page {currentPage} of {totalPages})
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm whitespace-nowrap">Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => {
                  const nextSize = Number.parseInt(v, 10);
                  onPaginationChange({ pageIndex: 0, pageSize: nextSize });
                }}
              >
                <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
