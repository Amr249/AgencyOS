"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type EntityTableShellProps = {
  title: string;
  topRight?: React.ReactNode;
  metrics?: React.ReactNode;
  toolbar?: React.ReactNode;
  selectionBar?: React.ReactNode;
  mobileContent?: React.ReactNode;
  tableContent: React.ReactNode;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
  dir?: "rtl" | "ltr";
  children?: React.ReactNode;
};

export function EntityTableShell({
  title,
  topRight,
  metrics,
  toolbar,
  selectionBar,
  mobileContent,
  tableContent,
  footer,
  emptyState,
  isEmpty = false,
  dir,
  children,
}: EntityTableShellProps) {
  return (
    <div className="space-y-5" dir={dir}>
      {title ? (
        <div className="mb-7 flex items-center justify-between">
          <h1 className="text-2xl font-medium text-neutral-900">{title}</h1>
          {topRight}
        </div>
      ) : topRight ? (
        <div className="mb-7 flex items-center justify-end">{topRight}</div>
      ) : null}

      {metrics}
      {toolbar}
      {selectionBar}

      {isEmpty && emptyState ? (
        emptyState
      ) : (
        <>
          {mobileContent}
          <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
            {tableContent}
            {footer ? <div className={cn("border-t border-neutral-100 px-4 py-3")}>{footer}</div> : null}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
