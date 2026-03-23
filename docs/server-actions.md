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
| `getExpenses`, `getExpensesSummary`, `getExpensesByTeamMemberId`, `getTeamCostBreakdownThisMonth` | Queries + summaries |
| `createExpense`, `updateExpense` | Create / partial update (includes optional `teamMemberId` for salary expenses) |
| `deleteExpense(id)` | Delete one expense by UUID |
| `deleteExpenses(ids)` | Bulk delete: `ids: string[]` (min 1 UUID); uses `inArray`; returns `{ ok, count }` on success |

**DB errors:** `getDbErrorKey` pattern.

---

## `files.ts`

| Export | Purpose |
|--------|---------|
| `getFiles` | `{ clientId?, projectId? }` |
| `createFile` | Record after ImageKit upload |
| `deleteFile` | ImageKit + DB |

**DB errors:** `getDbErrorKey` pattern.

---

## `invoices.ts`

| Export | Purpose |
|--------|---------|
| `getInvoices`, `getInvoicesByProjectId`, `getInvoicesByClientId`, `getInvoiceStats`, `getInvoiceById`, `getNextInvoiceNumber` | Reads |
| `createInvoice`, `updateInvoice` | CRUD with line items |
| `updateInvoiceStatus`, `markAsPaid`, `duplicateInvoice`, `deleteInvoice` | Workflow |
| `migrateInvoicesToNewFormat` | Maintenance / one-off migration helper |

**DB errors:** `getDbErrorKey` pattern throughout.

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

Many read-only exports for dashboards: `getProjectsSummary`, `getProjectsByStatus`, `getWeeklyTaskCompletion`, `getOverdueTasks`, `getActiveProjectsWithProgress`, `getNewClientsPerMonth`, `getFinancialSummary`, `getMonthlyRevenue`, `getMonthlyAreaData`, `getTopClientsByRevenue`, `getRecentInvoices`, `getOutstandingInvoices`, `getClientSpendByService`, `getServicesProfitability`.

**DB errors:** **None** — functions return typed data; **failures propagate as thrown errors**. Consider wrapping critical report loaders for graceful Neon failure messages.

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
| **`isDbConnectionError` + `getDbErrorKey`** | `clients`, `expenses`, `files`, `invoices`, `project-services`, `projects`, `proposals`, `services`, `settings`, `tasks`, `team`, `team-members` |
| **`isDbConnectionError` only (Arabic strings)** | `assignments` |
| **Not used** | `dashboard`, `reports` |
