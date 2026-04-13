# Modules

One section per module: what it does, pages, Server Actions, and main components. **Update this file when adding or changing pages, actions, or module-specific components.**

---

## Clients

**Purpose:** Full client CRM — contact info (phone required, email optional), optional logo, notes, status. No location/address on form. Clients are the top-level entity; projects and invoices belong to a client.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/clients/page.tsx` | Server Component; Active \| Archived tab (query `?view=archived`); fetches via `getClientsList()` or `getArchivedClientsList()`, renders `ClientsDataTable` and "New Client" + `ClientFormSheet`. |
| Detail | `app/dashboard/clients/[id]/page.tsx` | Server Component; fetches client via `getClientById()`, plus `getProjectsByClientId()`, `getProjectTaskCounts()`, `getInvoicesByClientId()`, **`getExpensesByClientId()`**, **`getClientCostSummary()`**, `getSettings()`, `getNextInvoiceNumber()`. Tabs: **Overview** (ClientOverview), **Projects** (ClientProjectsTab), **Invoices** (ClientInvoicesTab — English actions: Download PDF, mark paid, delete), **`Expenses`** (**`ClientExpensesTab`** — cost summary + expense rows for this client), **Files** (FileManager), **Notes**. Core CRM tabs remain RTL where not overridden by child components. |

**Server Actions** (`actions/clients.ts`):

| Action | Purpose |
|--------|---------|
| `createClient(input)` | Insert client. Zod: companyName, status (lead \| active \| on_hold \| completed \| closed), contactName, contactEmail (optional), contactPhone (required), website, logoUrl (optional), notes. |
| `updateClient(input)` | Update by id; partial payload. Revalidates list + detail. |
| `archiveClient(id)` | Soft-delete: set `deleted_at`. |
| `deleteClient(id)` | Hard delete client; CASCADE removes linked projects, invoices, files. Revalidates list; after delete UI redirects to `/dashboard/clients`. |
| `getClientsList()` | Select all where `deleted_at` is null (active clients), order by companyName. |
| `getArchivedClientsList()` | Select all where `deleted_at` is not null (archived clients), order by companyName. |
| `unarchiveClient(id)` | Set `deleted_at` to null; revalidates list and detail. |
| `getClientById(id)` | Select one by id; returns client even if archived (so detail page works). |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ClientsDataTable | `app/dashboard/clients/data-table.tsx` | Client list: columns (company with logo/avatar, contact, phone, status with colored badges, actions). **Active \| Archived** tab above table (default Active); archived clients hidden from Active and vice versa. **Search** by company name or phone (single input, client-side filter). **Status filter** dropdown: All \| Lead \| Active \| On Hold \| Completed \| Closed (client-side); active filter shown with ring on dropdown. Row actions: View, Edit, **حذف (Delete)** — opens AlertDialog "هل أنت متأكد؟" with description "سيتم حذف العميل [اسم العميل] نهائياً…"; on confirm calls `deleteClient(id)`, toast, redirect to `/dashboard/clients`. Archive (Active) or Restore (Archived). No Columns visibility dropdown. Uses `ClientFormSheet` for edit. |
| ClientFormSheet | `components/modules/clients/client-form-sheet.tsx` | Sheet form create/edit: companyName, status, contactName, contactEmail (optional), contactPhone (required), website, optional logo upload (ImageKit via /api/upload), notes. |
| EditClientButton | `components/modules/clients/edit-client-button.tsx` | Opens `ClientFormSheet` with client for edit. |
| ClientOverview | `components/modules/clients/client-overview.tsx` | Detail overview: contact card, address card, notes card. |
| ClientProjectsTab | `components/modules/clients/client-projects-tab.tsx` | Client detail Projects tab: table (اسم المشروع link, الحالة, الموعد النهائي, الميزانية, شريط التقدم); "+ مشروع جديد" opens `NewProjectDialog` with `defaultClientId` (client locked); empty state "لا توجد مشاريع لهذا العميل بعد." + "+ إضافة مشروع". Uses `getProjectsByClientId`, `getProjectTaskCounts`. |
| ClientInvoicesTab | `components/modules/clients/client-invoices-tab.tsx` | Client detail Invoices tab: summary badges; table with invoice #, project, amount (**SAR icon**), status (**pending / partial / paid**), dates; **Download PDF**, mark paid, delete; new invoice with `defaultClientId`. |
| **ClientExpensesTab** | `components/modules/clients/client-expenses-tab.tsx` | **Expenses** tab: **`getClientCostSummary`** + **`getExpensesByClientId`**; links to expense detail where applicable. |

---

## Proposals (العروض)

**Purpose:** Track job proposals (e.g. Mostaql). Smart URL auto-fill via scrape API; status workflow (applied → viewed → shortlisted → won/lost/cancelled); convert won proposal to client + project.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/proposals/page.tsx` | Server Component; fetches `getProposals(filters)`, `getProposalStats()`, `getProposalStatsForCharts()`. Renders `ProposalsListView`: header "العروض المقدمة" + "+ إضافة عرض"; KPI cards (إجمالي العروض, تم الفوز, قيد الانتظار, إجمالي قيمة المشاريع المكسوبة); filters (search by title, status, date range); RTL table (العنوان link to Mostaql URL, الفئة badge, الميزانية, عرضي, الحالة clickable popover, تاريخ التقديم, إجراءات … تعديل \| تحويل لعميل \| حذف); analytics: نسبة الفوز شهرياً (bar, last 6 months), توزيع العروض حسب الحالة (donut). |

**Server Actions** (`actions/proposals.ts`):

| Action | Purpose |
|--------|---------|
| `getProposals(filters?)` | List with optional status, dateRange, search (title). Zod-validated filters. |
| `getProposalStats()` | Returns total, won, wonPercent, pending, totalWonValue (sum of my_bid where status=won). |
| `getProposalStatsForCharts()` | byMonth (last 6 months: won/total ratio), statusDistribution. |
| `createProposal(data)` | Insert proposal; Zod: title, url, platform, budgetMin/Max, category, description, myBid, status, appliedAt, notes. |
| `updateProposal(id, data)` | Partial update. |
| `updateProposalStatus(id, status)` | Inline status change (e.g. from badge popover). |
| `deleteProposal(id)` | Hard delete. |
| `convertToClient(proposalId)` | Creates client (name from proposal title) + project (name, budget from my_bid), links proposal to both, sets status=won; returns clientId for redirect. |

**API:**

| Route | Purpose |
|-------|---------|
| GET `/api/scrape-mostaql?url=...` | Fetches Mostaql job page HTML; extracts title, budget range, category, description via regex; returns JSON for auto-fill in New Proposal dialog. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ProposalsListView | `components/modules/proposals/proposals-list-view.tsx` | KPI cards, filters, table, delete AlertDialog, EditProposalDialog, ConvertToClientDialog, win-rate bar chart, status donut. |
| NewProposalDialog | `components/modules/proposals/new-proposal-dialog.tsx` | Centered dialog: URL field first + "✨ جلب البيانات" button (calls scrape API, auto-fills title/category/budget/description); title, category, budget min/max, عرضي, تاريخ التقديم (DatePickerAr), الحالة, ملاحظات; إلغاء \| حفظ العرض. |
| EditProposalDialog | `components/modules/proposals/edit-proposal-dialog.tsx` | Same fields for edit. |
| ProposalStatusBadge | `components/modules/proposals/proposal-status-badge.tsx` | Clickable badge with popover (same pattern as invoices); options: مُقدَّم, تمت المشاهدة, في القائمة المختصرة, تم الفوز 🎉, لم يُكسب, ملغي. |
| ConvertToClientDialog | `components/modules/proposals/convert-to-client-dialog.tsx` | "هل تريد إنشاء عميل جديد من هذا العرض؟" with proposal title as suggested name; on confirm calls convertToClient, toast "🎉 تم إنشاء العميل والمشروع بنجاح!", redirect to new client page. |
| ProposalsWinRateChart | `components/modules/proposals/proposals-win-rate-chart.tsx` | Bar chart last 6 months won/total ratio. |
| ProposalsStatusDonut | `components/modules/proposals/proposals-status-donut.tsx` | Donut/pie by status (shadcn ChartContainer). |

**Sidebar:** "العروض" (IconFileText) between العملاء and المشاريع. **RTL:** All text right-aligned; URL input `dir="ltr"`; modals `dir="rtl"`.

---

## Projects

**Purpose:** Project lifecycle — name, client, status, dates, budget, hourly rate, phases. List with card/list view, filters, and detail page with Overview, Tasks (Kanban), Invoices, Files (FileManager), Notes.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/projects/page.tsx` | Server Component; fetches projects via `getProjects(filters)` (search, status, clientId), `getProjectTaskCounts()`, **getProjectMemberIdsByProjectIds()**, **getTeamMembers()**, `getClientsList()`, `getSettings()`. Renders `ProjectsListView` (client): title "Projects", **view switcher** (Table \| Gallery \| Board, default Gallery) then "+ New Project" (Dialog). Search (project or client name), status filter, client filter — same across all views. **Table**: Company (avatar + name), Project name (with **avatar stack** of assigned team members, max 3 +N), **Status** (clickable badge with chevron; popover to change status inline via Server Action, toast on success), Deadline, Budget (SAR), Tasks progress, Actions (Edit, Delete). **Gallery**: grid 4/2/1 cols; card cover = project cover image if set, else client logo, else status-colored block + project initial; project name, **clickable status badge** (same popover), **avatar stack of assigned members** (max 3 +N), client avatar+name, deadline, progress, budget; … menu on hover; card click → detail. **Board**: Kanban columns by status; each card has **avatar stack** (if any), **clickable status badge** (popover fallback); card click → detail. **New Project dialog:** after status, **أعضاء الفريق** multi-select (dropdown + removable tags); on create, inserts into `project_members`. Edit opens `EditProjectDialog`; Delete calls `deleteProject`. |
| Detail | `app/dashboard/projects/[id]/page.tsx` | Server Component; breadcrumb "Projects > [Project Name]"; **cover banner** (if `cover_image_url` set): full-width image below breadcrumb, above tabs; on hover, "Edit cover" opens file picker → upload to ImageKit → `updateProject(coverImageUrl)`. If no cover, no placeholder. Fetches `getProjectById(id)`, clients, settings, tasks, invoices, **`getExpensesByProjectId`**, **`getProjectCostSummary`**, **getProjectMembers(id)**, **getTeamMembers()**. Tabs: Overview, Tasks, **الفريق (Team)**, Invoices, **`Expenses`** (**`ProjectExpensesTab`**), Files, Notes. **الفريق tab:** list of assigned team members (avatar, name, role, role on project), "+ تعيين عضو" opens modal (dropdown of active team members not already assigned, optional "الدور في المشروع"), "إزالة" with confirmation. |

**Server Actions** (`actions/projects.ts`):

| Action | Purpose |
|--------|---------|
| `createProject(input)` | Insert project; Zod: name, clientId, status (lead \| active \| on_hold \| review \| completed \| cancelled), startDate, endDate, budget, hourlyRate (optional), description, **teamMemberIds** (optional). Seeds default phases (Discovery, Design, Development, Review, Launch). Inserts **project_members** rows for each teamMemberId. Revalidates projects list and detail. |
| `updateProject(input)` | Update by id; partial payload. Revalidates list + detail. |
| `updateProjectNotes(projectId, notes)` | Update project notes only; used by Notes tab. |
| `deleteProject(id)` | Hard delete project; CASCADE removes tasks, phases, etc. Revalidates list. Row "حذف" opens AlertDialog "هل أنت متأكد؟" with description "سيتم حذف المشروع [اسم المشروع] نهائياً بما يشمل جميع مهامه…"; on confirm calls `deleteProject`, toast, refresh. |
| `getProjects(filters?)` | List with optional status, clientId, search (project name or client name). Joins clients for clientName/clientLogoUrl. Excludes deleted. |
| `getProjectsByClientId(clientId)` | Projects for one client, order by created_at DESC. Used by client detail Projects tab. |
| `getProjectTaskCounts(projectIds)` | Returns `Record<projectId, { total, done }>` for progress bars. |
| `getProjectById(id)` | One project with client name/logo and phases. |
| `updatePhaseStatus(phaseId, status)` | Set phase status to pending \| active \| completed. |

**Server Actions** (`actions/tasks.ts` — project-scoped): `getTasksByProjectId(projectId)`, `createTask`, `updateTask`. See **Tasks** module for global `getTasks`, `getTaskById`, `deleteTask`, `createSubtask`, `toggleSubtask`.

**Server Actions** (`actions/team-members.ts`): **getTeamMembers()** — active team members (for dropdowns). **getProjectMembers(projectId)** — members assigned to project (الفريق tab). **getProjectMemberIdsByProjectIds(projectIds)** — per-project member list for avatar stacks on list/gallery/board. **assignMemberToProject(projectId, teamMemberId, roleOnProject?)**. **removeMemberFromProject(projectId, projectMemberId)**.

**Server Actions** (`actions/invoices.ts`):

| Action | Purpose |
|--------|---------|
| `getInvoicesByProjectId(projectId)` | All invoices for a project (for project detail Invoices tab). |

**Server Actions** (`actions/settings.ts`):

| Action | Purpose |
|--------|---------|
| `getSettings()` | Single row (id=1); used for defaultCurrency on project list/detail. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ProjectsListView | `components/modules/projects/projects-list-view.tsx` | Client: search, status + client filters, 3-way view (Table, Gallery, Board). **Status badge**: clickable with chevron-down; opens Popover with 6 status options (colored dots); on select calls `updateProject({ id, status })`, toast "Status updated to [Label]", refresh. Table/Gallery/Board all use this. Gallery card cover: `cover_image_url` → client logo → status block + initial. Edit/**حذف** (Delete): "حذف" opens AlertDialog (title "هل أنت متأكد؟", description with project name, buttons إلغاء / حذف destructive); on confirm `deleteProject(id)`, toast, refresh. "New Project" opens `NewProjectDialog`. |
| NewProjectDialog | `components/modules/projects/new-project-dialog.tsx` | Dialog: optional **Project cover image** upload at top (preview thumbnail; upload via /api/upload scope `project-cover`); name, client, status, dates, budget, description. Calls `createProject` (includes coverImageUrl). |
| EditProjectDialog | `components/modules/projects/edit-project-dialog.tsx` | Same as New + optional cover upload (path `agencyos/projects/{id}/cover` when projectId set). Calls `updateProject`. |
| ProjectCoverBanner | `components/modules/projects/project-cover-banner.tsx` | Client: if `coverImageUrl` set, shows wide banner below breadcrumb on detail page; on hover "Edit cover" → file picker → upload → `updateProject(coverImageUrl)` → refresh. If no cover, renders nothing. |
| ProjectOverviewTab | `components/modules/projects/project-overview-tab.tsx` | Details card (client link, status, dates, budget, hourly rate, description), Edit button, Phases horizontal stepper (Discovery … Launch) with Mark Active / Done per phase via `updatePhaseStatus`. |
| ProjectTasksTab | `components/modules/projects/project-tasks-tab.tsx` | Kanban columns: Todo, In Progress, In Review, Done, Blocked. "+ Add Task" per column; task cards show title, priority badge, due date; status dropdown to move. Uses `getTasksByProjectId`, `createTask`, `updateTask`. |
| ProjectInvoicesTab | `components/modules/projects/project-invoices-tab.tsx` | Table: Invoice #, Amount, Status, Due Date. "+ New Invoice" links to `/dashboard/invoices?projectId=…`. |
| **ProjectExpensesTab** | `components/modules/projects/project-expenses-tab.tsx` | **Expenses** tab: **`getProjectCostSummary`** + **`getExpensesByProjectId`**; English/LTR table patterns aligned with global Expenses module. |
| ProjectNotesTab | `components/modules/projects/project-notes-tab.tsx` | Textarea for private notes; Save button calls `updateProjectNotes`. |

**Status badge colors (projects):** Lead=blue, Active=green, On Hold=amber, Review=purple, Completed=gray, Cancelled=red (see `types/index.ts` `PROJECT_STATUS_BADGE_CLASS`).

---

## Team

**Purpose:** Team members (name, role, email, phone, avatar, status, notes) with optional project assignments. Salary expenses can be linked to a team member for the "سجل الرواتب" tab on member detail.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/team/page.tsx` | Server: fetches `getTeamMembers()`. Renders `TeamListView` (client): title "الفريق", "+ إضافة عضو" button, grid of cards (avatar/initials, name, role, phone, status badge نشط/غير نشط, project count, … menu تعديل \| حذف). Empty state: "لا يوجد أعضاء في الفريق بعد. أضف أول عضو." |
| Detail | `app/dashboard/team/[id]/page.tsx` | Server: fetches `getTeamMemberById(id)`, `getMemberProjects(id)`, `getExpensesByTeamMemberId(id)`. Header: avatar, name, role, status badge, "تعديل العضو" (EditTeamMemberButton). Tabs: **المشاريع المعيّنة** (table: project name, client, status, role on project); **سجل الرواتب** (table: التاريخ, المبلغ, ملاحظات; total paid to member). |

**Server Actions** (`actions/team.ts`):

| Action | Purpose |
|--------|---------|
| `getTeamMembers()` | All members with `projectCount` per member. |
| `getTeamMemberById(id)` | One member by id. |
| `createTeamMember(data)` | Zod: name (required), role, email, phone, avatarUrl, status (active \| inactive), notes. |
| `updateTeamMember({ id, ...data })` | Partial update; revalidates list + detail. |
| `deleteTeamMember(id)` | Hard delete; CASCADE project_members. |
| `assignMemberToProject(projectId, memberId, roleOnProject?)` | Insert into project_members. |
| `removeMemberFromProject(projectId, memberId)` | Delete from project_members. |
| `getProjectMembers(projectId)` | Members assigned to a project (for project detail). |
| `getMemberProjects(teamMemberId)` | Projects assigned to a member (for member detail tab). |

**Server Actions** (`actions/expenses.ts`): **createExpense** / **updateExpense** accept **teamMemberId** (optional, for salary expenses). **getExpenses** left-joins team_members and returns **teamMemberName**. **getExpensesByTeamMemberId(teamMemberId)** — expenses where `team_member_id` = id (salary tab). **getTeamCostBreakdownThisMonth()** — per-team-member total salary expenses this month (for Reports productivity tab).

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| TeamListView | `components/modules/team/team-list-view.tsx` | Client: header, add modal trigger, grid of member cards or empty state; edit modal (controlled); delete AlertDialog. |
| NewMemberModal | `components/modules/team/new-member-modal.tsx` | Dialog RTL: الاسم*, الدور (free text), البريد، الهاتف، الصورة الشخصية (ImageKit scope team-avatar), ملاحظات، الحالة (نشط/غير نشط). Create/Edit; on success refresh. |
| EditTeamMemberButton | `components/modules/team/edit-team-member-button.tsx` | Wraps NewMemberModal with member + onSuccess router.refresh (used on member detail). |

**Sidebar:** "الفريق" (IconUsers) between المشاريع and المهام, url `/dashboard/team`.

---

## Tasks

**Purpose:** Global task management — Kanban (default) and List views, filters (search, project, priority, status in list view), create/edit/delete tasks, subtasks with toggle done. RTL layout. Tasks table has `parent_task_id` for subtasks; indexes on `project_id`, `status`, `parent_task_id`.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Global Tasks | `app/dashboard/tasks/page.tsx` | Server: fetches `getTasks({})`, `getProjects()`. Renders `TasksPageContent` (RTL) with header "المهام", view toggle (كانبان \| قائمة), "+ مهمة جديدة", filters bar (search, project dropdown "كل المشاريع", priority "كل الأولويات \| منخفض \| متوسط \| عالي \| عاجل", status in list view only). Kanban: 5 columns RTL (قيد الانتظار, قيد التنفيذ, قيد المراجعة, مكتمل, موقوف) with colored headers; "+ إضافة مهمة" per column; task cards (title, project link, priority badge, due date red if overdue, subtask count, … تعديل \| حذف). List: RTL table (المهمة, المشروع, الأولوية, الحالة, تاريخ الاستحقاق, الإجراءات). New Task Modal and Task Detail Modal (edit title/status/priority/description, subtasks with checkbox toggle, add subtask, delete with AlertDialog). |

**Server Actions** (`actions/tasks.ts`):

| Action | Purpose |
|--------|---------|
| `getTasks(filters?)` | Global list; filters: projectId, status, priority, search. Only root tasks (parentTaskId null). Joins projects for projectName; returns subtaskCount per task. Zod: getTasksFiltersSchema. |
| `getTaskById(id)` | One task with project name + subtasks array. |
| `createTask(input)` | Zod: projectId, title, status, priority, dueDate, description, estimatedHours. Revalidates tasks, projects, dashboard. |
| `updateTask(input)` | Update by id; partial. Revalidates tasks, projects, dashboard. |
| `updateTaskStatus(id, status)` | Set status only (e.g. for Kanban drag). |
| `deleteTask(id)` | Soft delete (deletedAt). Revalidates tasks, projects, dashboard. |
| `createSubtask(parentId, title)` | Insert task with parentTaskId; same project as parent. |
| `toggleSubtask(id)` | Toggle status between done and todo (for subtask checkbox). |
| `getTasksByProjectId(projectId)` | All non-deleted tasks for a project (used by project detail Tasks tab). |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| TasksPageContent | `components/modules/tasks/tasks-page-content.tsx` | Client: header, view toggle (Kanban/List), filters, refetch on filter change; New Task Modal (default status when adding from column), Task Detail Modal, delete AlertDialog. |
| TasksKanban | `components/modules/tasks/tasks-kanban.tsx` | 5 columns RTL with TASK_STATUS_HEADER_CLASS (blue, amber, purple, green, red); count per column; TaskCard list; "+ إضافة مهمة" opens New Task with that status. |
| TasksListView | `components/modules/tasks/tasks-list-view.tsx` | RTL table: المهمة (link), المشروع (link), الأولوية (badge), الحالة, تاريخ الاستحقاق (red if overdue), الإجراءات (… تعديل \| حذف). |
| TaskCard | `components/modules/tasks/task-card.tsx` | Title, project link, priority badge, due date (red if overdue), subtask count; … menu (تعديل opens detail, حذف). Click card opens detail. |
| NewTaskModal | `components/modules/tasks/new-task-modal.tsx` | Dialog RTL: عنوان المهمة, المشروع (required), الوصف, الحالة, الأولوية, تاريخ الاستحقاق, الساعات المقدرة; إلغاء \| إنشاء المهمة. |
| TaskDetailModal | `components/modules/tasks/task-detail-modal.tsx` | Dialog RTL: editable title (blur save), status/priority dropdowns, project link, due date, description textarea; subtasks list with checkbox (toggleSubtask), "+ إضافة مهمة فرعية" input; حذف المهمة with AlertDialog. |

---

## Invoices

**Purpose:** Create invoices with line items, optional **multiple projects** per invoice (`invoice_projects`), **partial payments** via the `payments` table, **payment history** and progress on detail, **file attachments**, and **English** UI + PDF. Invoice numbers use sequential **`INV-001`**-style formatting from settings (`invoice_prefix`, `invoice_next_number`). Uses `default_currency` SAR, `default_payment_terms`, `invoice_footer`, branding (`invoice_color`, logo).

**New features (Phase 1 complete):**

- **Partial payments** — Invoices can be partially paid; status becomes **`partial`** until fully settled.
- **Payment history** — All payments listed on invoice detail with add/delete (via `actions/payments.ts`).
- **Payment progress bar** — Visual progress + amount due on detail (`PaymentHistory`).
- **Invoice file attachments** — Upload/download/delete on detail (`InvoiceAttachments`, ImageKit path `agencyos/invoices/{invoiceId}/`, `files.invoice_id`).
- **AR aging** — Server action **`getAgingReport`** and UI **`AgingReportSection`** (`components/reports/aging-report-section.tsx`) implement buckets (current, 1–30, 31–60, 61–90, 90+ days); compose on a report view where needed.
- **Invoice number format** — Configurable prefix + sequential number (e.g. `INV-001`), not UUIDs.
- **List export** — **CSV** and **Excel (`.xlsx`)** from **`InvoicesListView`** via **`getInvoicesExportData`**.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/invoices/page.tsx` | Server: `getInvoices(filters)`, **`getInvoiceStatsWithPayments()`** (collected = sum of payments + legacy paid invoices without payment rows), `getClientsList()`, `getSettings()`, `getNextInvoiceNumber()`. `InvoicesListView`: **English** summary cards — **Total invoiced**, **Collected**, **Outstanding** (styled cards; SAR via `AmountWithSarIcon`); filters; table. |
| Detail | `app/dashboard/invoices/[id]/page.tsx` | **`getInvoiceWithPayments`**, `getSettings()`, **`getFiles({ invoiceId })`**. Preview card, **`PaymentHistory`**, **`InvoiceAttachments`**. English copy. |
| Edit | `app/dashboard/invoices/[id]/edit/page.tsx` | **Pending only** (404 if partial/paid). Server: `getInvoiceById` with **`linkedProjectIds`**; `EditInvoiceForm` with multi-project checkboxes. |

**API:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/invoices/[id]/pdf` | GET | PDF via `@react-pdf/renderer` + **`getInvoiceWithPayments`** + settings. English labels; payment history + amount due when applicable; **`relatedProjectsLabel`** when multiple projects. |

**Server Actions** (`actions/invoices.ts` + `actions/payments.ts`):

| Action | Purpose |
|--------|---------|
| `getInvoices` / `getInvoicesWithPayments` | List + enriched totals; project filter matches **primary** or **`invoice_projects`** |
| **`getInvoicesExportData`** | Filtered rows for **CSV / XLSX** export |
| **`getInvoiceStatsWithPayments`** | **collected** includes `payments` + **legacy** `paid` rows with no payment rows |
| `getInvoiceById` | Invoice + **`linkedProjectIds`**, combined project names, items |
| **`getInvoiceWithPayments`** | Invoice + client, project, **`invoiceProjects`**, items, payments, **`totalPaid`**, **`amountDue`**, **`linkedProjects`** |
| `getOverdueInvoices` | Past due with amount due |
| `createInvoice` / `updateInvoice` | Line items; **`projectIds`** syncs **`invoice_projects`** |
| **`markAsPaid`** | Inserts **`payments`** row for **remaining balance**, sets paid |
| `createPayment`, `updatePayment`, `deletePayment` | **`actions/payments.ts`** — recalculate invoice status |
| **`migrateLegacyPaidInvoicePayments`** | Backfill payments for historical data |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| InvoicesListView | `components/modules/invoices/invoices-list-view.tsx` | Stats, filters, table, `NewInvoiceDialog` |
| NewInvoiceDialog | `components/modules/invoices/new-invoice-dialog.tsx` | Client, **multi-select projects**, line items, create + PDF download (**English**) |
| **`payment-history.tsx`** | `components/modules/invoices/payment-history.tsx` | Payments table, progress bar, record/delete payment |
| **`add-payment-modal.tsx`** | `components/modules/invoices/add-payment-modal.tsx` | Record payment (amount, date, method, reference, notes) |
| **`invoice-attachments.tsx`** | `components/modules/invoices/invoice-attachments.tsx` | Upload/list/download/delete attachments |
| InvoiceDetailHeader / InvoiceDetailActions | `invoice-detail-header.tsx`, `invoice-detail-actions.tsx` | Actions + status |
| MarkAsPaidDialog | `mark-as-paid-dialog.tsx` | Full remaining balance — **English** |
| EditInvoiceForm | `edit-invoice-form.tsx` | Pending edit; multi-project |
| InvoicePdfDocument | `invoice-pdf-document.tsx` | English PDF; branding, payments, amount due |
| **`aging-report-section.tsx`** | `components/reports/aging-report-section.tsx` | AR aging UI (buckets + detail); fed by **`getAgingReport`** |

**Status workflow** (`invoice_status`):

- **`pending`** — No payments (or not fully covered).
- **`partial`** — Some payments recorded; balance remaining.
- **`paid`** — Fully paid (payments sum ≥ invoice total, or legacy mark-paid).

Labels: `types/index.ts` — `INVOICE_STATUS_LABELS` / `INVOICE_STATUS_BADGE_CLASS` (includes **Partial**).

---

## Workspace

**Purpose:** Professional project workspace (separate from `/dashboard/tasks`) with My Tasks, Project Board, Timeline, and Team Workload views.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| My Tasks | `app/dashboard/workspace/page.tsx` | Server page; fetches `getWorkspaceMyTasks()`, team members, and projects; renders `WorkspaceMyTasksView` with grouped tasks. |
| Board | `app/dashboard/workspace/board/page.tsx` | Server page; resolves `?project=`, fetches board data via `getWorkspaceBoard(projectId)` and renders `WorkspaceBoardView` (drag/reorder + task panel). |
| Timeline | `app/dashboard/workspace/timeline/page.tsx` | Server page; resolves `?project=`, fetches `getWorkspaceTimeline(projectId)` and renders `WorkspaceTimelineView` (week/month axis, bars). |
| Workload | `app/dashboard/workspace/workload/page.tsx` | Server page; fetches `getWorkspaceWorkload()` and renders `WorkspaceWorkloadView` (8-week capacity table). |

**Server Actions** (`actions/workspace.ts`): board/timeline/my-tasks/workload getters, `updateTaskSortOrder`, `logTime`, `deleteTimeLog`, `getTimeLogs`, `createTaskComment`, `getTaskComments`, `deleteTaskComment`, `assignTask`.

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| WorkspaceNav | `components/modules/workspace/workspace-nav.tsx` | Workspace tab bar + project selector for board/timeline routes |
| WorkspaceMyTasksView | `components/modules/workspace/workspace-my-tasks-view.tsx` | Grouped personal tasks with collapsible sections and quick completion |
| WorkspaceBoardView | `components/modules/workspace/workspace-board-view.tsx` | Kanban board columns with drag-to-reorder and optimistic local state |
| WorkspaceTimelineView | `components/modules/workspace/workspace-timeline-view.tsx` | Gantt-like timeline with LTR axis and mobile fallback cards |
| WorkspaceWorkloadView | `components/modules/workspace/workspace-workload-view.tsx` | Weekly team load grid with click-to-inspect task list |
| TaskDetailPanel | `components/modules/workspace/task-detail-panel.tsx` | Sheet panel for task editing, assignment, time logs, subtasks, and comments |

---

## Expenses

**Purpose:** Track agency expenses by category; link to **projects**, **clients**, and **billable** flag; optional **recurring schedules** that spawn real **`expenses`** rows. Receipts and extra files use ImageKit + **`files.expense_id`**. Drives **profit and loss**, **profitability**, and **cash-flow** reports.

**UI note:** List, detail, and recurring flows use **English + LTR** (`dir="ltr"`) so they stay consistent even when the app locale is Arabic. Amounts use **`SarCurrencyIcon`** / **`formatAmount`**.

**Phase 2 (complete):** Project/client linking, **`is_billable`**, **recurring expenses** UI + **`actions/recurring-expenses.ts`**, **bulk delete**, **CSV / XLSX export**, **expense detail** with **attachments**, **Expenses** tabs on **project** and **client** detail pages.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/expenses/page.tsx` | `getExpenses(filters)` — **category**, **dateFrom**, **dateTo**, **projectId**, **clientId** (from query); `getExpensesSummary()`; **getTeamMembers**, **getProjects**, **getClientsList** for dialogs/filters. **`ExpensesListView`**: summary cards, filters (incl. project/client), **billable** filter in UI where present, **SortableDataTable**, **bulk delete**, **Export CSV / Excel**, link to **Recurring** and **New expense**. |
| Detail | `app/dashboard/expenses/[id]/page.tsx` | **`getExpenseById`**, **`getFiles({ expenseId })`**, pickers data. Header + metadata; **`ExpenseAttachments`** (upload/preview/download/delete). |
| Recurring | `app/dashboard/expenses/recurring/page.tsx` | **`getRecurringExpenses()`**; **`RecurringExpensesView`** + **`NewRecurringExpenseDialog`**; optional **process due** workflow via **`processRecurringExpenses`**. |

**Server Actions** (`actions/expenses.ts`):

| Action | Purpose |
|--------|---------|
| `getExpenses(filters?)` | Filters: category, dates, **projectId**, **clientId**, **isBillable** |
| `getExpensesExportData`, `getExpenseById`, `getExpensesSummary` | Export rows, detail, aggregates |
| `getExpensesByProjectId`, `getExpensesByClientId`, `getProjectCostSummary`, `getClientCostSummary` | Scoped lists and KPIs for **project/client** tabs and widgets |
| `getExpensesByTeamMemberId`, `getTeamCostBreakdownThisMonth` | Team / salary reporting |
| `createExpense`, `updateExpense`, `deleteExpense`, `deleteExpenses` | CRUD + bulk |

**Server Actions** (`actions/recurring-expenses.ts`): **`getRecurringExpenses`**, **`createRecurringExpense`**, **`updateRecurringExpense`**, **`deleteRecurringExpense`**, **`toggleRecurringExpenseActive`**, **`processRecurringExpenses`**, **`getDueRecurringExpenses`**.

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ExpensesListView | `components/modules/expenses/expenses-list-view.tsx` | Filters, table, bulk actions, exports, navigation to recurring |
| NewExpenseDialog | `components/modules/expenses/new-expense-dialog.tsx` | Create/edit: **project**, **client**, **billable**, salaries → **team member**, receipt upload |
| **RecurringExpensesView** | `components/modules/expenses/recurring-expenses-view.tsx` | Table of schedules; active toggle; edit/delete |
| **NewRecurringExpenseDialog** | `components/modules/expenses/new-recurring-expense-dialog.tsx` | Create/edit recurring row (frequency labels from **`RECURRENCE_FREQUENCY_LABELS`**) |
| **ExpenseAttachments** | `components/modules/expenses/expense-attachments.tsx` | Files scoped by **`expenseId`** (PDF preview, grid) |
| **ExpenseDetailHeader** | `components/modules/expenses/expense-detail-header.tsx` | Detail actions |
| ExpenseCategoryBadge | `components/modules/expenses/expense-category-badge.tsx` | English category labels |

**Category badge colors:** Software → blue, Hosting → purple, Marketing → pink, Salaries → amber, Equipment → orange, Office → gray, Other → slate.

---

## Files

**Purpose:** ImageKit-backed file storage scoped by **client**, **project**, **invoice**, or **expense**. Upload, list, download, copy link, delete. Metadata in **`files`** (`invoice_id`, `expense_id`, …).

**Pages:** No dedicated list page. **Client** and **Project** detail **Files** tabs use **`FileManager`**. **Invoice** and **expense** attachments use module components (`invoice-attachments`, `expense-attachments`).

**API:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/upload` | POST | Multipart: `file`, `folder`, and/or **`scope`** (e.g. **`invoice-attachment`** + **`invoiceId`**, expense scopes, **`recurring-vendor-logo`**, etc.). Returns `{ url, fileId, name, size, mimeType, filePath }`. |

**Server Actions** (`actions/files.ts`):

| Action | Purpose |
|--------|---------|
| `getFiles({ clientId?, projectId?, invoiceId?, expenseId? })` | One scope required |
| `createFile(data)` | After upload; optional **`invoiceId`** or **`expenseId`** |
| `deleteFile(id)` | ImageKit + DB; revalidates related dashboard paths |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| FileManager | `components/modules/files/file-manager.tsx` | Client component. Props: `clientId?`, `projectId?`, `initialFiles`. Title "الملفات", "رفع ملف +" button, drag & drop zone, file grid (4/2/1 cols). Cards: image thumbnail (ImageKit `?tr=w-200,h-150,c-at_max`), PDF icon (red), generic file icon; name, size (KB/MB), date (DD/MM/YYYY); hover: تحميل \| نسخ الرابط \| حذف. Upload progress; empty state "لا توجد ملفات بعد. ارفع أول ملف." Delete: AlertDialog then deleteFile. RTL. |

---

## Dashboard (Home)

**Purpose:** First screen after login — KPIs, revenue chart, project status donut, overdue tasks, upcoming deadlines, recent invoices, quick actions, plus **finance-focused KPIs** tied to **Phase 3** (YTD profit, profit margin, top profitable project/client).

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Home | `app/dashboard/page.tsx` | Server component; **`getDashboardData()`**; **`DashboardHome`**: KPI cards, charts, lists, quick actions. |

**Server Actions** (`actions/dashboard.ts`):

| Action | Purpose |
|--------|---------|
| `getDashboardData()` | Currency, revenue this/last month, outstanding, active projects, overdue tasks, **12-month** invoiced vs collected, project status counts, overdue task list, upcoming projects, recent invoices, **`totalProfit`** (YTD payments − YTD expenses), **`profitMargin`**, **`topProfitableProject`**, **`topProfitableClient`** (via **`getProjectProfitability`** / **`getClientProfitability`**). |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| DashboardHome | `components/dashboard-home.tsx` | Composes KPI cards (incl. **profit** / **margin** / **top performers** where implemented), Recharts bar + donut, task/project/invoice columns, quick actions. |

---

## Reports

**Purpose:** **English + LTR** financial analytics (revenue, profit, **P&L**, **cash flow**, **profitability**, **AR aging**, exports) and a **Projects & productivity** tab (mixed Arabic labels in older widgets — see `ProductivityReportsTab`). Optional **SAR ↔ EGP** toggle on the financial tab (`ReportsCurrencyProvider`, live rate).

**Phase 3 (complete):** Profitability and finance **server actions** (**`getProjectProfitability`**, **`getClientProfitability`**, **`getServiceProfitability`**, legacy **`getServicesProfitability`**, **`getProfitLossStatement`**, **`getCashFlowForecast`**, **`getAgingReport`**) plus **PDF** pipeline **`/api/reports/pdf`** (`downloadReportPdf`, `reports-pdf-document.tsx`). **Invoices** and **Expenses** lists support **CSV/XLSX** export.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Reports | `app/dashboard/reports/page.tsx` | **`getFinancialSummary`**, **`getMonthlyRevenue(dateRange)`**, **`getMonthlyComparison`**, **`getRecentInvoices`**, productivity loaders, **`getTeamCostBreakdownThisMonth`**, SAR→EGP rate. Tabs: **Financial** = **`ReportsFinancialTab`** (`app/dashboard/reports/reports-financial-tab.tsx`); **Projects & productivity** = **`ProductivityReportsTab`**. **Financial tab (mounted today):** KPI cards, **SAR/EGP** toggle, **`RevenueChartSection`**, **`MonthlyComparisonChart`**, inline **recent invoices** list, **`ProfitabilityVisualization`** (client-side fetch of **`getProjectProfitability` / `getClientProfitability` / `getServiceProfitability`**; bar / pie / treemap; **Download PDF** for the active profitability mode). Date range chips: `this_month` … `all`. |

**Composable report sections (same module):** **`ProfitLossSection`**, **`CashFlowForecastSection`**, **`AgingReportSection`**, **`ProjectProfitabilitySection`**, **`ClientProfitabilitySection`**, **`TopProfitableProjectsWidget`**, and **`reports-financial-subtabs.tsx`** (**`ReportsProfitabilitySubtabs`**, **`ReportsFinancialDetailsSubtabs`**) — pair with the matching **`actions/reports.ts`** loaders when composing extended report layouts.

**Server Actions** (`actions/reports.ts`): See **[`docs/server-actions.md`](./server-actions.md)** — financial core, profitability, **`getAgingReport`**, productivity getters, **`getClientSpendByService`**, **`getServicesProfitability`** vs **`getServiceProfitability`**.

**API:**

| Route | Purpose |
|-------|---------|
| `GET /api/reports/pdf` | Query `type`: `profit-loss`, `project-profitability`, `client-profitability`, `service-profitability` (+ params as implemented). Returns PDF buffer. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ReportsFinancialTab | `app/dashboard/reports/reports-financial-tab.tsx` | Currency toggle, KPIs, **`RevenueChartSection`**, **`MonthlyComparisonChart`**, recent invoices, **`ProfitabilityVisualization`** |
| RevenueChartSection | `components/reports/revenue-chart-section.tsx` | Revenue / expenses chart wrapper |
| MonthlyComparisonChart | `components/reports/monthly-comparison-chart.tsx` | Month-over-month comparison |
| **ProfitabilityVisualization** | `components/reports/profitability-visualization.tsx` | Charts + **Download PDF** for combined profitability views |
| **ProfitLossSection** | `components/reports/profit-loss-section.tsx` | **`getProfitLossStatement`** UI + period selector + **PDF** |
| **CashFlowForecastSection** | `components/reports/cash-flow-forecast-section.tsx` | **`getCashFlowForecast`** outlook UI |
| AgingReportSection | `components/reports/aging-report-section.tsx` | **`getAgingReport`** buckets + table |
| ReportsProfitabilitySubtabs (and related) | `components/reports/reports-financial-subtabs.tsx` | Project vs client **Profitability** subtabs; financial **Details** subtabs (recent invoices, outstanding, etc.) |
| ProjectProfitabilitySection / ClientProfitabilitySection | `components/reports/project-profitability-section.tsx`, `client-profitability-section.tsx` | Tables + **PDF** per section |
| TopProfitableProjectsWidget | `components/reports/top-profitable-projects-widget.tsx` | Highlight widget |
| RevenueChart | `components/reports/revenue-chart.tsx` | Shared Recharts bar helper |
| OutstandingInvoicesTable | `components/reports/outstanding-invoices-table.tsx` | Outstanding balances; mark paid flow |
| ProductivityReportsTab | `components/reports/productivity-reports-tab.tsx` | Productivity + **team cost** table |

---

## Settings

**Purpose:** Agency profile, invoice defaults (prefix, currency, terms, footer), PDF branding, account. Single-row `settings` table (id = 1). Single page, no tabs — sections: Agency Profile, Invoice Defaults, Branding, Account.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Settings | `app/dashboard/settings/page.tsx` | Server component; fetches `getSettings()`, renders `SettingsContent` with initial data and admin email from env. |
| Layout | `app/dashboard/settings/layout.tsx` | Minimal layout; renders children only. |
| SettingsContent | `app/dashboard/settings/settings-content.tsx` | Client component; 4 section cards, each with its own Save button and success toast (sonner). |

**Server Actions** (`actions/settings.ts`):

| Action | Purpose |
|--------|---------|
| `getSettings()` | Return single row (id=1) or null. |
| `updateAgencyProfile(input)` | Update agency name, email, website, VAT, logo URL, address (Zod). Upsert if no row. |
| `updateInvoiceDefaults(input)` | Update prefix, next number, currency, payment terms (0/15/30/60), footer. |
| `updateBranding(input)` | Update invoice_color (hex). |
| `changePassword(input)` | Validate only (Zod); no backend update — toast instructs to update ADMIN_PASSWORD_HASH. |

**Section 1 — Agency Profile:** Agency name, email, website, VAT, logo (upload via `/api/upload` scope `agency-logo`), address (street, city, country, postal). **Section 2 — Invoice Defaults:** Prefix, next number, currency (USD/EUR/GBP/SAR/AED/EGP), payment terms (Due on receipt, Net 15/30/60), footer. **Section 3 — Branding:** Primary color (color picker + hex), preview swatch. **Section 4 — Account:** Read-only admin email (env), change password form (current, new, confirm) — success toast only.

---

## Verification snapshot

<!-- ADDED 2026-03-23 -->

### Route verification (module pages)

- Clients: `/dashboard/clients`, `/dashboard/clients/[id]`
- Projects: `/dashboard/projects`, `/dashboard/projects/[id]`
- Tasks: `/dashboard/tasks`, `/dashboard/my-tasks`
- Invoices: `/dashboard/invoices`, `/dashboard/invoices/[id]`, `/dashboard/invoices/[id]/edit`
- Expenses: `/dashboard/expenses`
- Proposals: `/dashboard/proposals`
- Team: `/dashboard/team`, `/dashboard/team/[id]`
- Services: `/dashboard/services`
- Files: embedded in clients/projects detail tabs (no standalone page)
- Reports: `/dashboard/reports`
- Settings: `/dashboard/settings`
- Workspace: `/dashboard/workspace`, `/dashboard/workspace/board`, `/dashboard/workspace/calendar`, `/dashboard/workspace/timeline`, `/dashboard/workspace/workload`

### Workspace module (current)

- Actions in `actions/workspace.ts` now include:
  - `getWorkspaceBoard`
  - `getWorkspaceTimeline`
  - `getWorkspaceCalendar`
  - `getWorkspaceMyTasks`
  - `getWorkspaceWorkload`
  - `updateTaskSortOrder`
  - `logTime`
  - `deleteTimeLog`
  - `getTimeLogs`
  - `createTaskComment`
  - `getTaskComments`
  - `deleteTaskComment`
  - `assignTask`
- Components in `components/modules/workspace/`:
  - `workspace-nav`
  - `workspace-my-tasks-view`
  - `workspace-board-view`
  - `workspace-calendar-view`
  - `workspace-timeline-view`
  - `workspace-workload-view`
  - `task-detail-panel`
- Current UI state:
  - Workspace pages are currently rendered English + LTR.
  - My Tasks uses a Notion-style database table layout.

### Tasks module (current)

- `actions/tasks.ts` `createTask` now supports `startDate` and `assigneeId`.
- `NewTaskModal` supports:
  - start date + end date
  - assignee selector at create time (when team members are passed)
- Task delete is soft delete via `deleteTask(id)` and is now exposed from Workspace task detail panel.

<!-- Finance modules (Invoices, Expenses, Reports) use English + LTR where documented above; CRM modules may remain Arabic/RTL. -->
