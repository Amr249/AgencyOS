"use client";

import type { PointerEvent } from "react";
import type { ProjectHealth } from "@/actions/project-health";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PILL_CLASS: Record<ProjectHealth["status"], string> = {
  on_track:
    "border-emerald-600/25 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100",
  at_risk:
    "border-amber-600/25 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
  over_budget:
    "border-red-600/25 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100",
};

export function ProjectHealthBadge({
  health,
  className,
  stopClickPropagation,
}: {
  health: ProjectHealth;
  className?: string;
  /** Use in table rows / links so the badge does not toggle row selection. */
  stopClickPropagation?: boolean;
}) {
  const onPointerDown = stopClickPropagation
    ? (e: PointerEvent) => e.stopPropagation()
    : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex max-w-full", className)}
          onPointerDown={onPointerDown}
          onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
        >
          <Badge
            variant="outline"
            className={cn("cursor-help text-xs font-medium tabular-nums", PILL_CLASS[health.status])}
          >
            {health.label}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p className="mb-1 font-semibold">{health.label}</p>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
          {health.explanation.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
