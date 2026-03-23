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

- [x] Drizzle schema (invoices, invoice_items, payment_method)
- [x] Placeholder page
- [x] getInvoicesByProjectId (for project detail Invoices tab)
- [x] Server Actions: getInvoices, getInvoiceStats, getInvoiceById, createInvoice, updateInvoice, markAsSent, markAsPaid, cancelInvoice, duplicateInvoice, autoMarkOverdue, getNextInvoiceNumber
- [x] List page with summary bar (Total Invoiced, Collected, Outstanding, Overdue), filters, table
- [x] New Invoice dialog (client, project, line items, Save as Draft / Create & Send)
- [x] Invoice detail page (preview, Download PDF, Mark Sent/Paid, Duplicate, Cancel, Edit)
- [x] Edit invoice page (draft only)
- [x] GET /api/invoices/[id]/pdf (PDF via @react-pdf/renderer)

---

## Files

- [x] Drizzle schema (files)
- [x] POST /api/upload (ImageKit server-side; accepts file + folder; returns url, fileId, name, size, mimeType, filePath)
- [x] Server Actions: getFiles({ clientId?, projectId? }), createFile(data), deleteFile(id) — ImageKit delete then DB
- [x] FileManager component (Client detail Files tab, Project detail Files tab)
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

- [x] Placeholder page
- [x] Financial tab: KPI cards, revenue chart (invoiced by created_at, collected by paid_at, expenses bar), profit KPI (صافي الربح = collected − expenses), summary below chart
- [ ] Revenue report (CSV export)
- [ ] Project profitability view
- [x] Outstanding invoices table with "تحديد كمدفوعة"
- [ ] Client summary (billed per client)

---

## Expenses

- [x] Drizzle schema (expenses table, expense_category enum)
- [x] Server Actions: getExpenses(filters), getExpensesSummary(), createExpense, updateExpense, deleteExpense, **deleteExpenses** (bulk) (Zod)
- [x] Page app/dashboard/expenses: **English + LTR**; summary bar with **SAR icon** (`SarCurrencyIcon`) + formatted amount; category + date filters; **SortableDataTable** (`uiVariant="clients"`); **row selection + bulk delete**; New/Edit dialog (English); single + bulk delete AlertDialogs
- [x] Receipt upload via /api/upload (folder agencyos/expenses/receipts)
- [x] Sidebar "المصروفات" between الفواتير and التقارير
- [x] Financial reports: monthly expenses in chart, profit KPI

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
