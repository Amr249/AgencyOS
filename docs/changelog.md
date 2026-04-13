# Living changelog

Short-form release notes. For the detailed append-only history through 2026-03-08, see [CHANGELOG-archive.md](./CHANGELOG-archive.md).

## [Unreleased]

### Reports — Financial analytics (Phase 3)

- **Profitability actions:** `getProjectProfitability`, `getClientProfitability`, `getServiceProfitability` (expense-aware allocation); legacy `getServicesProfitability` (revenue-only) retained.
- **P&L:** `getProfitLossStatement(period)` with comparison windows; PDF via **`/api/reports/pdf?type=profit-loss`** (`ProfitLossSection` component).
- **Cash flow:** `getCashFlowForecast()` — current net, 3-month outlook (AR + recurring + historical spend); UI `cash-flow-forecast-section.tsx`.
- **AR aging:** `getAgingReport()` — buckets and invoice detail with **amount due** after payments; UI `aging-report-section.tsx`.
- **Reports page (Financial tab):** English + LTR; **SAR / EGP** toggle; KPI row; **`RevenueChartSection`**, **`MonthlyComparisonChart`**, recent invoices; **`ProfitabilityVisualization`** (bar / pie / treemap, PDF per mode).
- **Composable sections:** `project-profitability-section`, `client-profitability-section`, `top-profitable-projects-widget`, `reports-financial-subtabs` (profitability + financial details), `outstanding-invoices-table`.
- **Dashboard:** `getDashboardData` extended with **YTD profit**, **profit margin**, **top profitable project/client** (uses profitability actions).
- **Exports:** Report **PDFs** (`lib/reports-pdf-download.ts`, `components/reports/reports-pdf-document.tsx`); invoice list **CSV/XLSX**; expenses list **CSV/XLSX**.

### Expenses — Cost tracking (Phase 2)

- **Schema:** `expenses.project_id`, `expenses.client_id`, `expenses.is_billable`; new **`recurring_expenses`** + **`recurrence_frequency`** enum; **`files.expense_id`** for attachments.
- **Actions:** filters on `getExpenses`; `getExpensesByProjectId`, `getExpensesByClientId`, `getProjectCostSummary`, `getClientCostSummary`, `getExpenseById`, `getExpensesExportData`; **`actions/recurring-expenses.ts`** (full CRUD + `processRecurringExpenses`, `getDueRecurringExpenses`, toggle active).
- **UI:** English LTR list with project/client filters and **billable** filter; **bulk delete**; **CSV/XLSX**; **`/dashboard/expenses/[id]`** detail with **`ExpenseAttachments`**; **`/dashboard/expenses/recurring`**; **`ProjectExpensesTab`** / **`ClientExpensesTab`** on detail pages.
- **Labels:** `RECURRENCE_FREQUENCY_LABELS` in `types/index.ts` (Weekly, Monthly, Quarterly, Yearly).

### Invoices — Partial payments system (Phase 1 complete)

- **Payments table:** New `payments` rows track individual payments per invoice (`amount`, `payment_date`, `payment_method`, `reference`, `notes`). Mutations recalculate parent invoice **`status`** (`pending` → **`partial`** → **`paid`**).
- **Invoice status:** Enum extended with **`partial`** for partially paid invoices.
- **Payment history:** Invoice detail shows a **progress bar**, list of payments, **Record payment**, and delete payment (with confirmation where applicable).
- **Add payment modal:** Record payments with amount, date, method, reference, and notes (`add-payment-modal.tsx`).
- **Invoice attachments:** Upload, list, download, and delete files on invoice detail (`invoice-attachments.tsx`, `files.invoice_id`, ImageKit folder `agencyos/invoices/{invoiceId}/`).
- **AR aging report:** Financial reports include **`aging-report-section.tsx`** (overdue buckets: current, 1–30, 31–60, 61–90, 90+ days).
- **Invoice numbers:** Sequential **`INV-001`**-style numbers from settings (`invoice_prefix`, `invoice_next_number`), not UUID-based labels.
- **Multi-project invoices:** Junction **`invoice_projects`**; new/edit invoice UI uses checkboxes for one or many projects.
- **SAR currency icon:** **`SarCurrencyIcon`** / **`AmountWithSarIcon`** replace plain “ر.س” / “SAR” text across invoice UI (and elsewhere).
- **English UI:** Invoice list, detail, edit, and **PDF** output use English labels.
- **Stats fix:** **`getInvoiceStatsWithPayments`** — **collected** includes both the **`payments`** aggregate and **legacy** invoices marked **`paid`** with no payment rows.

- <!-- ADDED 2026-03-23 -->
- **Workspace UX overhaul:** My Tasks redesigned to a Notion-style database table layout (custom div table, grouped sections, fixed columns, property row, row hover interactions, `dir="auto"` task title rendering for mixed-language content).
- **Workspace localization/direction update:** Workspace routes and module components now explicitly render English + LTR UI chrome.
- **Workspace Calendar:** Added `/dashboard/workspace/calendar` route and `WorkspaceCalendarView`; added `getWorkspaceCalendar(month)` action.
- **Tasks schema/actions:** Added support for task `startDate`; task creation now supports `assigneeId`; New Task modal now includes Start/End dates and assignee picker.
- **Date picker behavior:** `DatePickerAr` now auto-detects locale/direction using `next-intl` locale by default.
- **Workspace task deletion UX:** Added delete-task action path in workspace Task Detail Panel (soft-delete via `actions/tasks.ts::deleteTask`).
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
