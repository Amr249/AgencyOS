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

/** English project status labels (Projects list & detail LTR surfaces). */
export const PROJECT_STATUS_LABELS_EN: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  on_hold: "On Hold",
  review: "Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Soft pill styling aligned with `projects-list-view` status popover. */
export const PROJECT_STATUS_PILL_CLASS: Record<string, string> = {
  active: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  lead: "bg-blue-50 text-blue-700",
  on_hold: "bg-amber-50 text-amber-700",
  review: "bg-purple-50 text-purple-700",
  cancelled: "bg-red-50 text-red-700",
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

/** English task priority (LTR task surfaces, e.g. project detail Kanban). */
export const TASK_PRIORITY_LABELS_EN: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
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

/** English task / Kanban column titles (project detail, etc.). */
export const TASK_STATUS_LABELS_EN: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
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

export const WORKSPACE_COLUMN_LABELS = {
  todo: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "موقوف",
} as const;

export const WORKSPACE_COLUMN_COLORS = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
} as const;

export const TASK_PRIORITY_BORDER = {
  low: "border-l-gray-300",
  medium: "border-l-blue-400",
  high: "border-l-amber-400",
  urgent: "border-l-red-500",
} as const;

// Invoice status — pending | partial | paid
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partially Paid",
  paid: "Paid",
};

export const INVOICE_STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  partial: "bg-blue-100 text-blue-800 border-blue-200",
  paid: "bg-green-100 text-green-800 border-green-200",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  credit_card: "Credit Card",
  cheque: "Cheque",
  other: "Other",
};

/** English UI labels for `recurrence_frequency` enum (`weekly` … `yearly`). See `docs/types/index.md`. */
export const RECURRENCE_FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

/** @deprecated Use PAYMENT_METHOD_LABELS (same values). */
export const PAYMENT_METHOD_LABELS_EN = PAYMENT_METHOD_LABELS;

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
