import type { AddressJson } from "@/lib/db/schema";

export type { AddressJson };

// Client status for display (Arabic)
export const CLIENT_STATUS_LABELS: Record<string, string> = {
  lead: "عميل محتمل",
  active: "نشط",
  on_hold: "متوقف",
  completed: "مكتمل",
  closed: "مغلق",
} as const;

// Tailwind classes for colored status badges (Lead=blue, Active=green, On Hold=amber, Completed=gray, Closed=red)
export const CLIENT_STATUS_BADGE_CLASS: Record<string, string> = {
  lead: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  active:
    "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  on_hold:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  completed:
    "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  closed:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

// Project status for display (Arabic)
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  lead: "عميل محتمل",
  active: "نشط",
  on_hold: "متوقف",
  review: "مراجعة",
  completed: "مكتمل",
  cancelled: "ملغي",
};

// Project status badge colors: Lead=blue, Active=green, On Hold=amber, Review=purple, Completed=gray, Cancelled=red
export const PROJECT_STATUS_BADGE_CLASS: Record<string, string> = {
  lead: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  active:
    "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  on_hold:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  review:
    "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  completed:
    "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  cancelled:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

// Task priority for display (Arabic)
export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالي",
  urgent: "عاجل",
};

export const TASK_PRIORITY_BADGE_CLASS: Record<string, string> = {
  low: "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  medium:
    "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  high:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  urgent:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

// Task status for Kanban columns (Arabic)
export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "موقوف",
};

// Kanban column header background (blue, amber, purple, green, red)
export const TASK_STATUS_HEADER_CLASS: Record<string, string> = {
  todo: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
  in_progress: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
  in_review: "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800",
  done: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
  blocked: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
};

// Invoice status (Arabic) — pending | paid only
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار الدفع",
  paid: "تم الدفع",
};

export const INVOICE_STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
};

// Proposal status (Arabic) — applied | viewed | shortlisted | won | lost | cancelled
export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  applied: "مُقدَّم",
  viewed: "تمت المشاهدة",
  shortlisted: "في القائمة المختصرة",
  won: "تم الفوز",
  lost: "لم يُكسب",
  cancelled: "ملغي",
};

export const PROPOSAL_STATUS_BADGE_CLASS: Record<string, string> = {
  applied: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  viewed: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  shortlisted:
    "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  won: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  lost: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  cancelled:
    "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};
