"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const REPORT_PAGE_SIZES = [5, 10, 20, 50, 100] as const;

export const DEFAULT_REPORT_PAGE_SIZE = 10;

type UseReportPaginationOptions = {
  /** When set, page size is fixed (no selector in UI). */
  fixedPageSize?: number;
  /** One page containing all rows (e.g. full-width report tables). */
  all?: boolean;
};

export function useReportPagination<T>(
  items: readonly T[],
  options?: UseReportPaginationOptions
) {
  const all = options?.all === true;
  const fixed = options?.fixedPageSize;

  const [page, setPage] = React.useState(1);
  const [pageSizeState, setPageSizeState] = React.useState(DEFAULT_REPORT_PAGE_SIZE);

  const total = items.length;
  const pageSize = all
    ? Math.max(1, total)
    : fixed != null && fixed > 0
      ? fixed
      : pageSizeState;
  const pageCount =
    all || total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    if (all) return;
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount, all]);

  const setPageSizeAndReset = React.useCallback(
    (n: number) => {
      if (all || (fixed != null && fixed > 0)) return;
      setPageSizeState(n);
      setPage(1);
    },
    [fixed, all]
  );

  if (all) {
    return {
      page: 1,
      pageSize: Math.max(1, total),
      pageCount: 1,
      total,
      pageItems: [...items],
      setPage: () => {},
      setPageSize: () => {},
      isPageSizeFixed: true,
    };
  }

  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    page: safePage,
    pageSize,
    pageCount,
    total,
    pageItems,
    setPage,
    setPageSize: setPageSizeAndReset,
    isPageSizeFixed: fixed != null && fixed > 0,
  };
}

type ReportTablePaginationBarProps = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Hide the rows-per-page select (e.g. fixed page size). */
  hidePageSizeSelect?: boolean;
  className?: string;
};

export function ReportTablePaginationBar({
  page,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
  hidePageSizeSelect = false,
  className,
}: ReportTablePaginationBarProps) {
  if (total === 0 || pageCount <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      dir="ltr"
    >
      {!hidePageSizeSelect ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs tabular-nums sm:text-sm">
          {pageSize} per page
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-muted-foreground min-w-[7rem] text-center text-xs tabular-nums sm:text-sm">
          Page {page} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
