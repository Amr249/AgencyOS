import type { ReactNode } from "react";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";

export type EntityBulkAction<T> = {
  id: string;
  label: string;
  variant?: "default" | "destructive";
  run: (selectedRows: T[]) => Promise<void> | void;
};

export type EntityFilterControl = {
  id: string;
  label: string;
  value: string;
};

export type ModuleTableConfig<T> = {
  tableId: string;
  title: string;
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  defaultSort?: SortingState;
  defaultVisibility?: VisibilityState;
  labels?: Record<string, string>;
  filterControls?: EntityFilterControl[];
  rowActions?: (row: T) => ReactNode;
  bulkActions?: EntityBulkAction<T>[];
};
