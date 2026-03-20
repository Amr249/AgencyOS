"use client";

import { Badge } from "@/components/ui/badge";
import type { ExpenseCategory } from "@/actions/expenses";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software: "Software",
  hosting: "Hosting",
  marketing: "Marketing",
  salaries: "Salaries",
  equipment: "Equipment",
  office: "Office",
  other: "Other",
};

const CATEGORY_BADGE_CLASS: Record<ExpenseCategory, string> = {
  software: "bg-blue-500/15 text-blue-700 border-blue-200",
  hosting: "bg-purple-500/15 text-purple-700 border-purple-200",
  marketing: "bg-pink-500/15 text-pink-700 border-pink-200",
  salaries: "bg-amber-500/15 text-amber-700 border-amber-200",
  equipment: "bg-orange-500/15 text-orange-700 border-orange-200",
  office: "bg-gray-500/15 text-gray-700 border-gray-200",
  other: "bg-slate-500/15 text-slate-700 border-slate-200",
};

export function ExpenseCategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <Badge variant="outline" className={CATEGORY_BADGE_CLASS[category]}>
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

export { CATEGORY_LABELS, CATEGORY_BADGE_CLASS };
