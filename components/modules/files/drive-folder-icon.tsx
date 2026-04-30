"use client";

import { FileText, Folder, LayoutGrid, UserCircle, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Preview tile background for grid/list — pairs with `DriveFolderIcon` colors (system + subtree). */
export function driveFolderPreviewSurfaceClass(systemType: string | null | undefined): string {
  const st = systemType ?? "";
  if (st === "root_clients" || st === "client" || st.startsWith("client_")) {
    return "bg-sky-100/80 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100";
  }
  if (st === "root_projects" || st === "project" || st.startsWith("project_")) {
    return "bg-violet-100/80 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100";
  }
  if (st === "root_invoices" || st === "invoice_client") {
    return "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  if (st === "root_expenses" || st.startsWith("expense_")) {
    return "bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  }
  if (st === "root_team" || st === "team_member") {
    return "bg-rose-100/80 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100";
  }
  if (st === "root_general") {
    return "bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  }
  return "bg-amber-100/80 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
}

/**
 * Lucide icon + colors for Drive folders — same rules as the sidebar folder tree
 * (root system folders and auto-generated subtrees).
 */
export function DriveFolderIcon({
  systemType,
  className,
}: {
  systemType?: string | null;
  className?: string;
}) {
  const st = systemType ?? "";
  const base = cn("shrink-0", className);
  if (st === "root_clients" || st === "client" || st.startsWith("client_")) {
    return <Users className={cn("text-sky-600 dark:text-sky-400", base)} />;
  }
  if (st === "root_projects" || st === "project" || st.startsWith("project_")) {
    return <LayoutGrid className={cn("text-violet-600 dark:text-violet-400", base)} />;
  }
  if (st === "root_invoices" || st === "invoice_client") {
    return <FileText className={cn("text-emerald-600 dark:text-emerald-400", base)} />;
  }
  if (st === "root_expenses" || st.startsWith("expense_")) {
    return <Wallet className={cn("text-amber-600 dark:text-amber-400", base)} />;
  }
  if (st === "root_team" || st === "team_member") {
    return <UserCircle className={cn("text-rose-600 dark:text-rose-400", base)} />;
  }
  if (st === "root_general") {
    return <Folder className={cn("text-amber-600 dark:text-amber-400", base)} />;
  }
  return <Folder className={cn("text-amber-600 dark:text-amber-400", base)} />;
}
