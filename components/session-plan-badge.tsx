"use client";

import { cn } from "@/lib/utils";
import type { OrgPlan } from "@/types/next-auth";

const planClass: Record<OrgPlan, string> = {
  starter:
    "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30",
  pro: "bg-purple-500/15 text-purple-900 ring-1 ring-purple-600/25 dark:bg-purple-500/20 dark:text-purple-100 dark:ring-purple-400/35",
  enterprise:
    "bg-amber-400/25 text-amber-950 ring-1 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-400/35",
  internal:
    "bg-[#E86A5B]/20 text-[#8f2e22] ring-1 ring-[#E86A5B]/45 dark:bg-[#E86A5B]/25 dark:text-[#ffe8e4] dark:ring-[#ff9a8c]/40",
};

export function SessionPlanBadge({
  plan,
  label,
  className,
}: {
  plan: OrgPlan | string;
  label: string;
  className?: string;
}) {
  const p = (plan === "starter" || plan === "pro" || plan === "enterprise" || plan === "internal"
    ? plan
    : "starter") as OrgPlan;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        planClass[p],
        className
      )}
    >
      {label}
    </span>
  );
}
