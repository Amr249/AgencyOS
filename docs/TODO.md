# TODO

What is built, in progress, and not started, by module. **Update at the start and end of every session.**

---

## Clients

- [x] Drizzle schema (clients table, contact_name/contact_email/contact_phone, address, notes, soft delete)
- [x] Server Actions: createClient, updateClient, archiveClient, getClientsList, getClientById (Zod validated)
- [x] List page with DataTable (search, sort, pagination, row actions)
- [x] Detail page with tabs (Overview, Projects, Invoices, Files, Notes)
- [x] ClientFormSheet (create/edit) with address fields
- [x] ClientOverview, EditClientButton
- [x] Archive action in row dropdown
- [ ] Total billed / active projects count on list (optional)
- [x] Logo upload (ImageKit) on client — POST /api/upload, optional logo in form

---

## Proposals (العروض)

- [x] Drizzle schema (proposals table, proposal_status enum, FK to clients/projects)
- [x] drizzle-kit push
- [x] Server Actions: getProposals(filters), createProposal, updateProposal, updateProposalStatus, deleteProposal, convertToClient, getProposalStats, getProposalStatsForCharts (Zod)
- [x] GET /api/scrape-mostaql for Mostaql URL auto-fill
- [x] Page app/dashboard/proposals: KPI cards, filters (search, status, date range), table, New/Edit dialog, status popover, تحويل لعميل dialog, analytics (win rate bar, status donut)
- [x] Sidebar and mobile nav: العروض between العملاء and المشاريع

---

## Projects

- [x] Drizzle schema (projects, phases)
- [x] Placeholder list page
- [x] Full CRUD Server Actions (create, update, delete, getProjects, getProjectById, getProjectTaskCounts, updatePhaseStatus, updateProjectNotes)
- [x] List page (card + list view, search, status + client filters, New Project Dialog)
- [x] Detail page with tabs (Overview, Tasks, Invoices, Files, Notes)
- [x] Phases UI (horizontal stepper, mark active/completed)

---

## Tasks

- [x] Drizzle schema (tasks, subtasks via parent_task_id)
- [x] Placeholder page
- [x] Server Actions: getTasksByProjectId, createTask, updateTask (project-scoped Kanban)
- [x] Kanban view (project detail Tasks tab)
- [x] List view (global tasks page)
- [x] Global “All tasks” with filters

---

## Workspace

- [x] Schema extensions: `workspace_view`, `tasks.sort_order`, `tasks.assignee_id`, `tasks.actual_hours`
- [x] New tables: `time_logs`, `task_comments`
- [x] Server Actions: `actions/workspace.ts` (board, timeline, my-tasks, workload, sort, logs, comments, assign)
- [x] Routes: `/dashboard/workspace`, `/board`, `/timeline`, `/workload`
- [x] Components: nav, my-tasks view, board view, timeline view, workload view, task detail panel
- [x] Sidebar + mobile nav entry for Workspace (`الفضاء`)

---

## Invoices

- [x] Drizzle schema: `invoices`, `invoice_items`, `payments`, `invoice_projects`, `invoice_status` (`pending` \| `partial` \| `paid`)
- [x] Server Actions: `getInvoices`, `getInvoicesWithPayments`, **`getInvoiceStatsWithPayments`**, `getInvoiceById` (with **`linkedProjectIds`**), **`getInvoiceWithPayments`**, `getOverdueInvoices`, `createInvoice` / `updateInvoice` (incl. **`projectIds`**), `markAsPaid` (creates **`payments`** row for balance), **`actions/payments.ts`** CRUD, `duplicateInvoice`, `getNextInvoiceNumber`, etc.
- [x] **Partial payments** — payment history, status recalculation, add/delete payments
- [x] **Payment history** UI + progress bar (`payment-history.tsx`, `add-payment-modal.tsx`)
- [x] **Invoice file attachments** (`invoice-attachments.tsx`, `getFiles` / `createFile` with **`invoiceId`**)
- [x] **Aging report** — `getAgingReport` + `aging-report-section.tsx` (compose where needed)
- [x] **Invoice number format** — sequential `INV-001` from settings
- [x] **English UI** — list, detail, edit, dialogs
- [x] **PDF** — English (`GET /api/invoices/[id]/pdf`, `InvoicePdfDocument`)
- [x] List page: summary cards, filters, table; detail: preview, PDF, mark paid, attachments, payments

---

## Files

- [x] Drizzle schema (`files`, incl. **`invoice_id`** FK → invoices)
- [x] POST /api/upload (ImageKit; **`scope`** incl. **`invoice-attachment`** + **`invoiceId`**, or explicit **`folder`** e.g. `agencyos/invoices/{id}`)
- [x] Server Actions: **`getFiles({ clientId?, projectId?, invoiceId? })`**, **`createFile`** (optional **`invoiceId`**), `deleteFile`
- [x] FileManager component (Client / Project detail Files tabs)
- [x] **Invoice attachments** (`invoice-attachments.tsx` on invoice detail)
- [x] Upload UI (drag & drop, file picker, parallel uploads, progress)
- [ ] Optional: renameFile (not in Phase 3)

---

## Dashboard (Home)

- [x] Dashboard layout and route
- [x] KPI cards (revenue this month, outstanding, active projects, overdue tasks)
- [x] Revenue chart (last 12 months)
- [x] Project status donut
- [x] Quick lists (overdue tasks, upcoming deadlines, recent invoices)
- [x] Quick actions (New Project, New Client, New Invoice, New Task)

---

## Reports

- [x] Financial + productivity tabs (English LTR financial tab; productivity tab with Arabic copy in legacy widgets)
- [x] KPI cards, **`RevenueChartSection`**, **`MonthlyComparisonChart`**, recent invoices, **SAR/EGP** toggle
- [x] **Profitability** — `getProjectProfitability` / `getClientProfitability` / `getServiceProfitability` + **`ProfitabilityVisualization`** on Financial tab
- [x] **P&L** action `getProfitLossStatement` + **`ProfitLossSection`** + PDF (`/api/reports/pdf`)
- [x] **Cash flow** action `getCashFlowForecast` + **`CashFlowForecastSection`**
- [x] **AR aging** action `getAgingReport` + **`AgingReportSection`** (compose on layout as needed)
- [x] **PDF exports** for profit-loss, project/client/service profitability (`downloadReportPdf`)
- [x] **Invoice list CSV/XLSX** and **expenses list CSV/XLSX** (data exports)
- [x] **Dashboard** finance KPIs: YTD profit, margin, top profitable project/client
- [x] Composable widgets: **`reports-financial-subtabs`**, **`project-profitability-section`**, **`client-profitability-section`**, **`top-profitable-projects-widget`**, **`outstanding-invoices-table`**
- [ ] Optional: mount all composable sections on a single “full financial dashboard” route (if desired)

---

## Expenses

- [x] Drizzle schema: **`expenses`** (+ **`project_id`**, **`client_id`**, **`is_billable`**), **`recurring_expenses`**, **`recurrence_frequency`**, **`files.expense_id`**
- [x] Server Actions: **`getExpenses`** (extended filters), **`getExpensesExportData`**, **`getExpenseById`**, **`getExpensesByProjectId`**, **`getExpensesByClientId`**, **`getProjectCostSummary`**, **`getClientCostSummary`**, **`getExpensesSummary`**, create/update/delete + **`deleteExpenses`**, team helpers
- [x] **`actions/recurring-expenses.ts`** — full CRUD, toggle active, **`processRecurringExpenses`**, **`getDueRecurringExpenses`**
- [x] Pages: **`/dashboard/expenses`** (list + exports + recurring link), **`/dashboard/expenses/[id]`** (detail + attachments), **`/dashboard/expenses/recurring`**
- [x] **Project** / **client** detail **Expenses** tabs (`ProjectExpensesTab`, `ClientExpensesTab`)
- [x] English + LTR UI, **SAR** icon, bulk delete, **CSV/XLSX**
- [x] Receipt + **expense attachments** (ImageKit + `files.expense_id`)
- [x] Sidebar "المصروفات" between الفواتير and التقارير
- [x] Reports/dashboard consume expense data for profit and cash-flow logic

---

## Settings

- [x] Settings route and layout, single page (no sidebar)
- [x] settings table (single row)
- [x] Server Actions: getSettings, updateAgencyProfile, updateInvoiceDefaults, updateBranding, changePassword (validate only)
- [x] Agency profile form (name, logo, address, email, website, VAT)
- [x] Invoice defaults (prefix, next number, currency, payment terms, footer)
- [x] PDF branding (invoice_color)
- [ ] Account: wire change password to update ADMIN_PASSWORD_HASH (e.g. script or env)

---

## Auth & global

- [x] NextAuth v5 credentials, single admin, JWT
- [x] Login page, dashboard protection, sign out
- [x] SessionProvider, NavUser with session
- [ ] Optional: change-password flow (e.g. script or simple form that outputs new hash)

---

## Docs

- [x] docs/README.md
- [x] docs/architecture.md (+ docs/ARCHITECTURE-legacy.md historical)
- [x] docs/DATABASE.md
- [x] docs/MODULES.md
- [x] docs/API.md
- [x] docs/DECISIONS.md
- [x] docs/changelog.md (living) + docs/CHANGELOG-archive.md (detailed history)
- [x] docs/TODO.md

## Current state addendum

<!-- ADDED 2026-03-23 -->

- [x] Workspace Calendar route and UI (`/dashboard/workspace/calendar`, `WorkspaceCalendarView`)
- [x] Workspace pages currently enforce English/LTR wrappers
- [x] Workspace My Tasks redesigned to Notion-style database table UI
- [x] Task schema now includes `tasks.start_date`
- [x] New Task modal supports Start date + End date
- [x] New Task modal supports assigning task to team member at create time (`assigneeId`)
- [x] Workspace Task Detail Panel now includes delete-task confirmation/action
- [ ] Reconcile migration metadata journal with SQL files (`drizzle/meta/_journal.json` currently lags 0002/0003)

<!-- Arabic-only descriptions in older modules (e.g. Proposals, parts of Clients) may still apply; Finance uses English/LTR. -->
