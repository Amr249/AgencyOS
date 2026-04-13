# Server Actions (`/actions`)

All listed files use `"use server"`. Return shapes vary: many CRUD actions use `{ ok: true, data } | { ok: false, error: string | object }` where `error` may be a **`DbErrorKey`** (`connectionTimeout` | `fetchFailed` | `unknown`) when `getDbErrorKey` is used — translate in the client with [`useTranslateActionError`](../hooks/use-translate-action-error.ts) and `next-intl` keys under `errors.*`.

## `assignments.ts`

Task assignment to **app users** (`users` + `task_assignments`), distinct from `team-members` / `team` (agency staff).

| Export | Purpose | Inputs | Returns / errors |
|--------|---------|--------|------------------|
| `getTeamMembers` | Lists all `users` for assignee picker | — | `{ data, error }`; Arabic strings on failure |
| `assignTask` | Inserts `task_assignments` | `taskId`, `userId` | `{ success, error }`; auth + duplicate checks |
| `unassignTask` | Deletes assignment row | `taskId`, `userId` | `{ success, error }` |
| `getMyTasks` | Tasks for current session user | — | `{ data, error }` |
| `getTaskAssignees` | Assignees for one task | `taskId` | `{ data, error }` |
| `getAssigneesForTaskIds` | Batch assignees map | `taskIds: string[]` | `{ data, error }` |

**DB errors:** Uses **`isDbConnectionError` only** — returns **inline Arabic** strings (e.g. تعذّر الاتصال بقاعدة البيانات), **not** `getDbErrorKey`. Consider aligning with `getDbErrorKey` + `useTranslateActionError` for consistency.

---

## `clients.ts`

| Export | Purpose |
|--------|---------|
| `deleteClient`, `deleteClients` | Hard delete |
| `createClient`, `updateClient` | Zod-validated; form errors may include `_form` with DB error key |
| `archiveClient`, `unarchiveClient` | Soft delete / restore |
| `getClientsList`, `getArchivedClientsList` | Lists |
| `getClientById` | Single client |
| `getClientServiceIds`, `getServiceIdsByClientIds` | Service tagging |

**DB errors:** `getDbErrorKey` + `isDbConnectionError` on catch blocks.

---

## `dashboard.ts`

| Export | Purpose |
|--------|---------|
| `getDashboardData` | Aggregated KPIs, charts data, overdue tasks, upcoming projects, recent invoices |

**Returns:** `Promise<DashboardData>` — **throws on DB failure** (no `db-errors` wrapper). Callers should use error boundaries / try-catch.

---

## `expenses.ts`

| Export | Purpose |
|--------|---------|
| `getExpenses(filters?)` | List with joins (team member, project, direct client). Filters: **`category`**, **`dateFrom`**, **`dateTo`**, **`projectId`**, **`clientId`**, **`isBillable`** (Zod) |
| `getExpensesExportData(filters?)` | Same filter shape as `getExpenses`; returns rows for **CSV / Excel** export from the UI |
| `getExpenseById(id)` | Single expense with relations for **expense detail** page |
| `getExpensesSummary()` | Aggregates: this month / this year totals, top category |
| `getExpensesByTeamMemberId` | Salary-style rows for team member detail |
| `getExpensesByProjectId(projectId)` | All expenses linked to a project |
| `getExpensesByClientId(clientId)` | Expenses with **`client_id`** = client or **`project_id`** on that client’s projects |
| `getProjectCostSummary(projectId)` | Totals / counts for project cost widgets |
| `getClientCostSummary(clientId)` | Totals for client cost widgets |
| `getTeamCostBreakdownThisMonth` | Per–team-member salary totals (reports / productivity) |
| `createExpense`, `updateExpense` | Create / partial update — supports **`projectId`**, **`clientId`**, **`isBillable`**, **`teamMemberId`**, receipt URL |
| `deleteExpense(id)` | Delete one |
| `deleteExpenses(ids)` | Bulk delete (`inArray`); returns `{ ok, count }` on success |

**DB errors:** `getDbErrorKey` pattern.

---

## `files.ts`

| Export | Purpose |
|--------|---------|
| `getFiles` | `{ clientId?, projectId?, invoiceId?, expenseId? }` — **exactly one** scope id required |
| `createFile` | After ImageKit upload; optional **`invoiceId`** or **`expenseId`** for attachments |
| `deleteFile` | ImageKit + DB row |

**DB errors:** `getDbErrorKey` pattern.

---

## `payments.ts` (`actions/payments.ts`)

| Export | Purpose |
|--------|---------|
| `createPayment(input)` | Insert payment; **recalculates** parent invoice **`status`** (`pending` / `partial` / `paid`) and **`paid_at`** |
| `updatePayment(input)` | Update payment by id; **recalculates** invoice status |
| `deletePayment(id)` | Remove payment; **recalculates** invoice status |
| `getPaymentsByInvoiceId(invoiceId)` | List payments for one invoice (ordered by date / created) |
| `getInvoicePaymentSummary(invoiceId)` | **`totalPaid`**, **`amountDue`**, **`invoiceTotal`**, **`paymentProgress`** (uses `invoiceCollectedAmount` for legacy paid rows) |

There is **no** global `getPaymentHistory` export; use **`getPaymentsByInvoiceId`** per invoice (or add a dedicated query if cross-invoice history is needed).

**DB errors:** `getDbErrorKey` on connection failures; Zod errors on validation.

---

## `recurring-expenses.ts` (`actions/recurring-expenses.ts`)

| Export | Purpose |
|--------|---------|
| `getRecurringExpenses()` | List with **project**, **client**, **team member** names |
| `createRecurringExpense(input)` | Insert row (frequency, next due date, optional links, **`vendorLogoUrl`** when category is software) |
| `updateRecurringExpense(input)` | Partial update by id |
| `deleteRecurringExpense(id)` | Hard delete |
| `toggleRecurringExpenseActive(id)` | Flip **`is_active`** |
| `processRecurringExpenses()` | For due **`next_due_date`**: inserts matching **`expenses`** rows, advances schedule |
| `getDueRecurringExpenses()` | Due rows (for dashboards / reminders) |

**DB errors:** `getDbErrorKey` pattern (and Zod flatten on validation errors).

---

## `invoices.ts`

| Export | Purpose |
|--------|---------|
| `getInvoices`, `getInvoicesWithPayments`, `getInvoicesByProjectId`, `getInvoicesByClientId`, `getInvoiceStats`, **`getInvoiceStatsWithPayments`**, `getInvoiceById`, **`getInvoiceWithPayments`**, `getNextInvoiceNumber` | Reads — list stats use **`getInvoiceStatsWithPayments`** for collected/outstanding |
| **`getInvoicesExportData(filters?)`** | Rows for **CSV / Excel** export from invoice list |
| `createInvoice`, `updateInvoice` | Line items; **`projectIds`** syncs **`invoice_projects`** + primary **`project_id`** |
| `getOverdueInvoices` | Past due (or issue) with **amount due** |
| `updateInvoiceStatus`, `markAsPaid`, `duplicateInvoice`, `deleteInvoice`, `deleteInvoices` | Workflow |
| **`markAsPaid`** | Inserts **`payments`** row for **remaining balance**, then **`paid`** when balance > 0 |
| `migrateInvoicesToNewFormat` | Maintenance helper |
| **`migrateLegacyPaidInvoicePayments`** | Backfill **`payments`** for legacy paid invoices |

**DB errors:** `getDbErrorKey` pattern throughout.

**Aging:** AR aging data is loaded via **`getAgingReport`** in **`actions/reports.ts`** (not `invoices.ts`).

---

## `project-services.ts`

| Export | Purpose |
|--------|---------|
| `syncProjectServices` | Replace junction rows for a project |
| `getServiceIdsByProjectIds` | Batch lookup for lists |

**DB errors:** `getDbErrorKey` pattern.

---

## `projects.ts`

| Export | Purpose |
|--------|---------|
| `createProject`, `updateProject`, `updateProjectNotes`, `deleteProject`, `deleteProjects` | CRUD |
| `getProjects`, `getProjectsByClientId`, `getProjectTaskCounts`, `getProjectById` | Reads |
| `updatePhaseStatus` | Phase stepper |

**DB errors:** `getDbErrorKey` pattern.

---

## `proposals.ts`

| Export | Purpose |
|--------|---------|
| `getProposals`, `getProposalStats`, `getProposalStatsForCharts` | List + analytics |
| `createProposal`, `updateProposal`, `updateProposalStatus`, `deleteProposal` | CRUD |
| `convertToClient` | Creates client + project from winning proposal |

**DB errors:** `getDbErrorKey` pattern.

---

## `reports.ts`

Most exports are **read-only**. Several profitability helpers return **`{ ok: true, data } | { ok: false, error: DbErrorKey }`** (see implementations).

### Financial (core)

| Export | Purpose |
|--------|---------|
| `getFinancialSummary()` | KPIs: revenue months, **collected this year** (by payment activity), outstanding, etc. |
| `getMonthlyRevenue(dateRange)` | Per month: invoiced, collected, expenses, **profits** (shape used by charts) |
| `getMonthlyComparison()` | Recent months comparison dataset |
| `getMonthlyAreaDefaultBounds` / `getMonthlyAreaData(start, end)` | Range bounds + area-chart series |
| `getTopClientsByRevenue(limit)` | Top clients by paid revenue |
| `getRecentInvoices(limit)` | Latest invoices |
| `getOutstandingInvoices()` | Pending / partial with amount due |
| `getProfitLossStatement(period)` | **Profit and loss** for a period key (`this_month`, `this_quarter`, `this_year`, `all_time`, …); includes comparison window when applicable |
| `getCashFlowForecast()` | Current net position + **3-month** outlook (outstanding AR, recurring + avg spend) |

### Profitability (Phase 3)

| Export | Purpose |
|--------|---------|
| `getProjectProfitability(range?)` | Per-project revenue (payments, multi-project split) vs **expenses** |
| `getClientProfitability(range?)` | Per-client revenue vs expenses (direct + project-linked, no double count) |
| `getServiceProfitability(range?)` | Revenue/expense/profit **by service** (allocates **`getProjectProfitability`** across **`project_services`**) |
| `getServicesProfitability()` | **Legacy / simpler** service revenue roll-up from **paid** invoices (no expense side) |

### Other analytics

| Export | Purpose |
|--------|---------|
| `getClientSpendByService()` | Client × service spend from paid invoices |
| `getAgingReport()` | AR buckets + invoice list with **amount due** (respects **payments**) |

### Productivity (unchanged)

`getProjectsSummary`, `getProjectsByStatus`, `getWeeklyTaskCompletion`, `getOverdueTasks`, `getActiveProjectsWithProgress`, `getNewClientsPerMonth`.

**DB errors:** Mixed — profitability + aging use **`getDbErrorKey`**; older helpers may **throw** on failure. Prefer try/catch or `ok` checks per call site.

---

## `services.ts`

| Export | Purpose |
|--------|---------|
| `getServices` | List |
| `createService`, `updateService`, `deleteService` | CRUD |

**DB errors:** `getDbErrorKey` pattern.

---

## `settings.ts`

| Export | Purpose |
|--------|---------|
| `getSettings` | singleton row |
| `updateAgencyProfile`, `updateInvoiceDefaults`, `updateBranding` | Partial updates; form errors `_form` + DB key |
| `changePassword` | Password change with validation |

**DB errors:** `getDbErrorKey` pattern.

---

## `tasks.ts`

| Export | Purpose |
|--------|---------|
| `getTasks`, `getTasksByProjectId`, `getTaskById` | Reads |
| `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask` | CRUD |
| `createSubtask`, `toggleSubtask` | Subtask helpers |

**DB errors:** `getDbErrorKey` pattern.

<!-- ADDED 2026-03-23 -->
- `createTask(input)` currently also accepts `startDate` and `assigneeId` in addition to `dueDate`.
- `updateTask(input)` currently supports `startDate` updates.

---

## `team.ts`

**Agency** `team_members` (staff) CRUD and `project_members` ↔ projects.

| Export | Purpose |
|--------|---------|
| `getTeamMembers`, `getTeamMemberById` | With project counts where applicable |
| `createTeamMember`, `updateTeamMember`, `deleteTeamMember` | CRUD |
| `assignMemberToProject`, `removeMemberFromProject` | Junction |
| `getProjectMembers`, `getMemberProjects` | Joins |

**DB errors:** `getDbErrorKey` pattern.

---

## `team-members.ts`

Focused helpers for **project ↔ team_member** assignment used by project UI (overlaps conceptually with `team.ts` but narrower API surface).

| Export | Purpose |
|--------|---------|
| `getTeamMembers` | Active members only (dropdowns) |
| `getProjectMembers`, `getProjectMemberIdsByProjectIds` | Assignment data |
| `assignMemberToProject`, `removeMemberFromProject` | Junction mutations |

**DB errors:** `getDbErrorKey` pattern.

---

## `workspace.ts`

Workspace module actions for My Tasks, Board, Timeline, Workload, time tracking, comments, and assignee changes.

| Export | Purpose |
|--------|---------|
| `getWorkspaceBoard(projectId)` | Project board data grouped by status columns with assignee + logged hours |
| `getWorkspaceTimeline(projectId)` | Timeline dataset (tasks with due dates) |
| `getWorkspaceCalendar(month)` | Calendar dataset scoped to `YYYY-MM` month |
| `getWorkspaceMyTasks()` | Grouped personal tasks: today / this_week / later / no_date |
| `getWorkspaceWorkload()` | 8-week workload matrix per active team member |
| `updateTaskSortOrder(updates)` | Batch update `sort_order` + status after Kanban drag |
| `logTime(input)` | Insert `time_logs` row and recalculate `tasks.actual_hours` |
| `deleteTimeLog(id)` | Delete time entry and recalculate parent task actual hours |
| `getTimeLogs(taskId)` | List logs for one task (latest first) |
| `createTaskComment(taskId, body)` | Insert `task_comments` row |
| `getTaskComments(taskId)` | List comments oldest first |
| `deleteTaskComment(id)` | Hard delete one comment |
| `assignTask(taskId, teamMemberId)` | Update `tasks.assignee_id` and revalidate workspace paths |

**DB errors:** `getDbErrorKey` + `isDbConnectionError` pattern.

---

## Summary: `db-errors` usage

| Pattern | Files |
|---------|--------|
| **`isDbConnectionError` + `getDbErrorKey`** | `clients`, `expenses`, `files`, `invoices`, `payments`, `project-services`, `projects`, `proposals`, **`recurring-expenses`**, `services`, `settings`, `tasks`, `team`, `team-members` |
| **`isDbConnectionError` + `getDbErrorKey`** | `workspace` |
| **`isDbConnectionError` only (Arabic strings)** | `assignments` |
| **Mixed / throws** | **`reports`** — many helpers use **`getDbErrorKey`** on `ok: false`; older paths may still **throw** |
| **Not used** | `dashboard` |
