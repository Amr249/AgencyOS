# TypeScript display maps

Canonical source code: [`types/index.ts`](../../types/index.ts) (re-exported types such as **`AddressJson`** come from [`lib/db/schema.ts`](../../lib/db/schema.ts)).

These objects are **UI labels and Tailwind badge classes**, not database enums. Keys align with Drizzle/pg enum string values or status strings returned from the API.

## Projects & tasks (English LTR)

| Export | Keys / usage |
|--------|----------------|
| **`PROJECT_STATUS_LABELS_EN`** | Project pipeline: Lead, Active, On Hold, Review, Completed, Cancelled |
| **`PROJECT_STATUS_PILL_CLASS`** | Tailwind pill classes aligned with the Projects list status popover |
| **`TASK_STATUS_LABELS_EN`** | Kanban: To Do, In Progress, In Review, Done, Blocked |
| **`TASK_PRIORITY_LABELS_EN`** | Low, Medium, High, Urgent |

Arabic counterparts remain: **`PROJECT_STATUS_LABELS`**, **`TASK_STATUS_LABELS`**, **`TASK_PRIORITY_LABELS`** (CRM / RTL surfaces).

## Finance-related

| Export | Keys / usage |
|--------|----------------|
| **`INVOICE_STATUS_LABELS`** | `pending` → Pending, `partial` → Partially Paid, `paid` → Paid |
| **`INVOICE_STATUS_BADGE_CLASS`** | Tailwind classes for invoice status badges (English invoice UI) |
| **`PAYMENT_METHOD_LABELS`** | `bank_transfer`, `cash`, `credit_card`, `cheque`, `other` → English labels |
| **`RECURRENCE_FREQUENCY_LABELS`** | `weekly`, `monthly`, `quarterly`, `yearly` → Weekly, Monthly, Quarterly, Yearly (recurring expenses UI) |

## Other modules (Arabic-first CRM)

| Export | Purpose |
|--------|---------|
| **`CLIENT_STATUS_LABELS`** / **`CLIENT_STATUS_BADGE_CLASS`** | Client pipeline |
| **`PROJECT_STATUS_LABELS`** / **`PROJECT_STATUS_BADGE_CLASS`** | Project lifecycle |
| **`TASK_*`** maps | Kanban, priority, workspace columns |
| **`PROPOSAL_STATUS_*`** | Proposals module |

`PAYMENT_METHOD_LABELS_EN` is a deprecated alias of **`PAYMENT_METHOD_LABELS`**.
