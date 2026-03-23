# Living changelog

Short-form release notes. For the detailed append-only history through 2026-03-08, see [CHANGELOG-archive.md](./CHANGELOG-archive.md).

## [Unreleased]

- **Workspace module:** added `/dashboard/workspace` with My Tasks, Board, Timeline, and Workload pages; introduced `actions/workspace.ts` for grouped task queries, Kanban sort persistence, assignee updates, time logging, and task comments. Extended schema with `workspace_view`, `tasks.sort_order`, `tasks.assignee_id`, `tasks.actual_hours`, plus new `time_logs` and `task_comments` tables.
- **Invoices list (`InvoicesListView`):** **Outstanding** summary card uses light gray background (`#ededed`) with **black** title, amount, and SAR icon (replacing former black card / white text). **Total invoiced** card retains lime accent background.
- **Expenses (`/dashboard/expenses`):** English copy + **LTR** layout (`dir="ltr"` on page and table wrapper). Summary cards and **Amount** column use **`formatAmount`** + **`SarCurrencyIcon`** (`/Saudi_Riyal_Symbol.png`) instead of text “SAR”/ر.س. Table uses **`SortableDataTable`** with **`uiVariant="clients"`** (aligned with Projects table styling). **Row selection** + **bulk delete** (`deleteExpenses(ids)` in `actions/expenses.ts`) with confirmation dialog. **Category badges** use English labels. **`DatePickerAr`** supports optional `direction`, `locale`, and `popoverAlign` for LTR/English date filters and modal. **`NewExpenseDialog`** is English + LTR. Page metadata title/description: “Expenses”.
- Initial living documentation set: `project-overview.md`, `architecture.md`, `database-schema.md`, `server-actions.md`, `ui-components.md`, `rtl-conventions.md`, `error-handling.md`, this file, and refreshed [README.md](./README.md) index.

## [Recent]

- RTL avatar/element ordering fixed via explicit JSX ordering (e.g. stacked avatars with `dir="rtl"` and overlap margins).
- Global search bar redesigned to minimal style with ⌘/Ctrl+K affordance (`components/layout/search.tsx`, `components/global-search.tsx` for API-backed search).
- Sidebar restored to original black/dark design (`app/globals.css` sidebar CSS variables).
- Graceful Neon DB timeout error handling added (`lib/db-errors.ts`).
- Arabic error messages for DB keys via `messages/ar.json` → `errors.*` and `useTranslateActionError`; server actions return `getDbErrorKey()` where integrated.
