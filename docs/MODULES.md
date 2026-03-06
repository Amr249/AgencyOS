# Modules

One section per module: what it does, pages, Server Actions, and main components. **Update this file when adding or changing pages, actions, or module-specific components.**

---

## Clients

**Purpose:** Full client CRM — contact info (phone required, email optional), optional logo, notes, status. No location/address on form. Clients are the top-level entity; projects and invoices belong to a client.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/clients/page.tsx` | Server Component; Active \| Archived tab (query `?view=archived`); fetches via `getClientsList()` or `getArchivedClientsList()`, renders `ClientsDataTable` and "New Client" + `ClientFormSheet`. |
| Detail | `app/dashboard/clients/[id]/page.tsx` | Server Component; fetches client via `getClientById()`, plus `getProjectsByClientId()`, `getProjectTaskCounts()`, `getInvoicesByClientId()`, `getSettings()`, `getNextInvoiceNumber()`. Tabs: **Overview** (ClientOverview), **Projects** (ClientProjectsTab — live table with name link, status, end date, budget SAR, progress bar; "+ مشروع جديد" with client locked; empty state "+ إضافة مشروع"), **Invoices** (ClientInvoicesTab — summary badges total invoiced/paid/outstanding, table with invoice #, project, amount SAR, status badge, issue/due dates, actions تحميل PDF \| تحديد كمدفوعة \| حذف; "+ فاتورة جديدة" with client locked; empty state "+ إنشاء فاتورة"), **Files** (FileManager: رفع ملف +, drag & drop, grid with thumbnails, تحميل \| نسخ الرابط \| حذف), **Notes**. All tables RTL. |

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
| ClientInvoicesTab | `components/modules/clients/client-invoices-tab.tsx` | Client detail Invoices tab: summary badges (إجمالي الفواتير, مدفوع, غير مدفوع); table (رقم الفاتورة, المشروع, المبلغ, الحالة بانتظار الدفع/تم الدفع, تاريخ الإصدار, تاريخ الاستحقاق, إجراءات: تحميل PDF \| تحديد كمدفوعة \| حذف); "+ فاتورة جديدة" with `defaultClientId`; empty state "+ إنشاء فاتورة". Mark-as-paid dialog; delete AlertDialog (draft/cancelled only). |

---

## Projects

**Purpose:** Project lifecycle — name, client, status, dates, budget, hourly rate, phases. List with card/list view, filters, and detail page with Overview, Tasks (Kanban), Invoices, Files (FileManager), Notes.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/projects/page.tsx` | Server Component; fetches projects via `getProjects(filters)` (search, status, clientId), `getProjectTaskCounts()`, `getClientsList()`, `getSettings()`. Renders `ProjectsListView` (client): title "Projects", **view switcher** (Table \| Gallery \| Board, default Gallery) then "+ New Project" (Dialog). Search (project or client name), status filter, client filter — same across all views. **Table**: Company (avatar + name), Project name, **Status** (clickable badge with chevron; popover to change status inline via Server Action, toast on success), Deadline, Budget (SAR), Tasks progress, Actions (Edit, Delete). **Gallery**: grid 4/2/1 cols; card cover = project cover image if set, else client logo, else status-colored block + project initial; project name, **clickable status badge** (same popover), client avatar+name, deadline, progress, budget; … menu on hover; card click → detail. **Board**: Kanban columns by status; each card has **clickable status badge** (popover fallback); card click → detail. Edit opens `EditProjectDialog`; Delete calls `deleteProject`. |
| Detail | `app/dashboard/projects/[id]/page.tsx` | Server Component; breadcrumb "Projects > [Project Name]"; **cover banner** (if `cover_image_url` set): full-width image below breadcrumb, above tabs; on hover, "Edit cover" opens file picker → upload to ImageKit → `updateProject(coverImageUrl)`. If no cover, no placeholder. Fetches `getProjectById(id)`, clients, settings, tasks, invoices. Tabs: Overview, Tasks, Invoices, Files, Notes. |

**Server Actions** (`actions/projects.ts`):

| Action | Purpose |
|--------|---------|
| `createProject(input)` | Insert project; Zod: name, clientId, status (lead \| active \| on_hold \| review \| completed \| cancelled), startDate, endDate, budget, hourlyRate (optional), description. Seeds default phases (Discovery, Design, Development, Review, Launch). Revalidates projects list and detail. |
| `updateProject(input)` | Update by id; partial payload. Revalidates list + detail. |
| `updateProjectNotes(projectId, notes)` | Update project notes only; used by Notes tab. |
| `deleteProject(id)` | Hard delete project; CASCADE removes tasks, phases, etc. Revalidates list. Row "حذف" opens AlertDialog "هل أنت متأكد؟" with description "سيتم حذف المشروع [اسم المشروع] نهائياً بما يشمل جميع مهامه…"; on confirm calls `deleteProject`, toast, refresh. |
| `getProjects(filters?)` | List with optional status, clientId, search (project name or client name). Joins clients for clientName/clientLogoUrl. Excludes deleted. |
| `getProjectsByClientId(clientId)` | Projects for one client, order by created_at DESC. Used by client detail Projects tab. |
| `getProjectTaskCounts(projectIds)` | Returns `Record<projectId, { total, done }>` for progress bars. |
| `getProjectById(id)` | One project with client name/logo and phases. |
| `updatePhaseStatus(phaseId, status)` | Set phase status to pending \| active \| completed. |

**Server Actions** (`actions/tasks.ts` — project-scoped): `getTasksByProjectId(projectId)`, `createTask`, `updateTask`. See **Tasks** module for global `getTasks`, `getTaskById`, `deleteTask`, `createSubtask`, `toggleSubtask`.

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
| ProjectNotesTab | `components/modules/projects/project-notes-tab.tsx` | Textarea for private notes; Save button calls `updateProjectNotes`. |

**Status badge colors (projects):** Lead=blue, Active=green, On Hold=amber, Review=purple, Completed=gray, Cancelled=red (see `types/index.ts` `PROJECT_STATUS_BADGE_CLASS`).

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

**Purpose:** Create invoices, line items, track status (pending | paid only), PDF export. Uses settings (invoice_prefix, default_currency SAR, default_payment_terms, invoice_footer) and clients/projects for auto-fill.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/invoices/page.tsx` | Server: fetches `getInvoices(filters)`, `getInvoiceStats()`, `getClientsList()`, `getSettings()`, `getNextInvoiceNumber()`. Renders `InvoicesListView`: KPI cards (إجمالي الفواتير, المحصّل, المستحق); filters (search, status: الكل \| بانتظار الدفع \| تم الدفع, date range); table. **حذف** allowed for pending and paid; confirmation dialog. |
| Detail | `app/dashboard/invoices/[id]/page.tsx` | Server: `getInvoiceById(id)`, `getSettings()`. `InvoiceDetailActions`: تحميل PDF, تحديد كمدفوعة (opens payment date dialog if pending), نسخ. When status is paid, preview card shows تاريخ الدفع (DD/MM/YYYY) and طريقة الدفع (تحويل بنكي / نقداً / بطاقة ائتمان / أخرى). |
| Edit | `app/dashboard/invoices/[id]/edit/page.tsx` | Pending only. Server: `getInvoiceById`, `getSettings()`; 404 if not pending. `EditInvoiceForm`: Save calls `updateInvoice`. |

**API:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/invoices/[id]/pdf` | GET | Returns PDF using `@react-pdf/renderer`. Fetches invoice + settings; renders `InvoicePdfDocument` (agency logo, name, address, invoice #/dates, Bill To, line items, totals, notes). Uses `settings.invoice_color` for header/accent. Filename: `invoice-AGY-0001.pdf`. |

**Server Actions** (`actions/invoices.ts`):

| Action | Purpose |
|--------|---------|
| `getInvoices(filters?)` | status, dateRange (this_month/last_month/this_year/all), search (invoice # or client name). Joins clients, projects. Returns list with clientName, projectName. |
| `getInvoiceStats()` | Returns totalInvoiced, collected (paid total), outstanding (pending total). |
| `getInvoiceById(id)` | Invoice with clientName, clientAddress, projectName, items (ordered). |
| `createInvoice(data)` | New invoices created with status `pending`. Inserts invoice + invoice_items. |
| `updateInvoice(id, data)` | Only if status is pending. Partial update; lineItems recalculates totals. |
| `markAsPaid({ id, paidAt, paymentMethod? })` | Sets status paid, **paid_at = user-entered date** (not server time), payment_method (optional). Revalidates invoices + reports. |
| `deleteInvoice(id)` | Allowed for both pending and paid; confirmation dialog. Revalidates list. |
| `duplicateInvoice(id)` | Clones invoice + items as new pending; uses next invoice number. |
| `getNextInvoiceNumber()` | Returns prefix + padded next number (e.g. INV-001). |
| `getInvoicesByProjectId(projectId)` | For project detail Invoices tab. |
| `getInvoicesByClientId(clientId)` | Invoices for one client, order by created_at DESC. Used by client detail Invoices tab. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| InvoicesListView | `components/modules/invoices/invoices-list-view.tsx` | Summary cards, filters, table, New Invoice button + modal. |
| NewInvoiceDialog | `components/modules/invoices/new-invoice-dialog.tsx` | Single button: "إنشاء وتحميل" — creates invoice as pending and triggers PDF download. |
| InvoiceDetailHeader | `components/modules/invoices/invoice-detail-header.tsx` | Client wrapper for detail page: renders InvoiceDetailActions, InvoiceStatusBadge, and one MarkAsPaidDialog so both the button and the badge open the same payment dialog. |
| InvoiceDetailActions | `components/modules/invoices/invoice-detail-actions.tsx` | تحميل PDF, تحديد كمدفوعة (opens MarkAsPaidDialog or parent callback), نسخ. |
| MarkAsPaidDialog | `components/modules/invoices/mark-as-paid-dialog.tsx` | Dialog "تأكيد استلام الدفعة": تاريخ الدفع (date, default today), طريقة الدفع (تحويل بنكي \| نقداً \| بطاقة ائتمان \| أخرى, optional). On confirm calls markAsPaid with user date; toast "تم تسجيل الدفعة بنجاح". Used on invoice list (… menu + status badge), invoice detail, reports outstanding table, client invoices tab. |
| EditInvoiceForm | `components/modules/invoices/edit-invoice-form.tsx` | Form for pending invoice edit; Save calls updateInvoice. |
| InvoicePdfDocument | `components/modules/invoices/invoice-pdf-document.tsx` | @react-pdf/renderer Document/Page: agency logo/name/address, invoice #/dates, Bill To, table, totals, notes. Used by PDF API. |

**Status:** pending (بانتظار الدفع, amber), paid (تم الدفع, green) — `types/index.ts` `INVOICE_STATUS_LABELS`, `INVOICE_STATUS_BADGE_CLASS`.

---

## Expenses

**Purpose:** Track agency expenses by category (software, hosting, marketing, salaries, equipment, office, other). Used in Financial Reports for profit (collected − expenses). Receipt upload via ImageKit (folder `agencyos/expenses/receipts`).

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| List | `app/dashboard/expenses/page.tsx` | Server: fetches `getExpenses(filters)` (category, dateFrom, dateTo from searchParams), `getExpensesSummary()`. Renders `ExpensesListView`: title "المصروفات", "+ إضافة مصروف" button; summary bar (إجمالي المصروفات هذا الشهر, إجمالي المصروفات هذه السنة, أكبر فئة مصروفات); filters (category dropdown, date range); RTL table (العنوان, الفئة badge, المبلغ, التاريخ DD/MM/YYYY, ملاحظات, إجراءات … تعديل \| حذف). New/Edit expense dialog; delete AlertDialog. |

**Server Actions** (`actions/expenses.ts`):

| Action | Purpose |
|--------|---------|
| `getExpenses(filters?)` | category (expense_category), dateFrom, dateTo. Returns list ordered by date desc. Zod-validated. |
| `getExpensesSummary()` | totalThisMonth, totalThisYear, topCategory (category with highest spend). |
| `createExpense(data)` | Zod: title, amount, category, date, notes, receiptUrl. Revalidates /dashboard/expenses, /dashboard/reports. |
| `updateExpense(input)` | Partial update by id. Revalidates expenses + reports. |
| `deleteExpense(id)` | Hard delete. Revalidates expenses + reports. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ExpensesListView | `components/modules/expenses/expenses-list-view.tsx` | Summary cards, category + date range filters, table, "+ إضافة مصروف" opens NewExpenseDialog; row … menu (تعديل \| حذف). |
| NewExpenseDialog | `components/modules/expenses/new-expense-dialog.tsx` | Dialog RTL: العنوان, المبلغ بالريال, الفئة (برمجيات \| استضافة \| تسويق \| رواتب \| معدات \| مكتب \| أخرى), التاريخ (default today), ملاحظات, إيصال (optional file upload → /api/upload folder expenses/receipts). Create or Edit mode. |
| ExpenseCategoryBadge | `components/modules/expenses/expense-category-badge.tsx` | Colored badge per category: برمجيات blue, استضافة purple, تسويق pink, رواتب amber, معدات orange, مكتب gray, أخرى slate. |

**Category badge colors:** برمجيات → blue, استضافة → purple, تسويق → pink, رواتب → amber, معدات → orange, مكتب → gray, أخرى → slate.

---

## Files

**Purpose:** ImageKit-backed file storage scoped by client or project. Upload, list, download, copy link, delete. All uploads via server-side ImageKit; metadata in `files` table.

**Pages:** No dedicated list page. **Client detail** (الملفات tab) and **Project detail** (الملفات tab) each render `FileManager` with `clientId` or `projectId`.

**API:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/upload` | POST | Multipart form: `file`, `folder` (ImageKit path). Optional legacy: `scope`, `projectId`. Returns `{ url, fileId, name, size, mimeType, filePath }`. Used by FileManager (folder: `agencyos/clients/{id}/` or `agencyos/projects/{id}/`) and by client logo, agency logo, project cover. |

**Server Actions** (`actions/files.ts`):

| Action | Purpose |
|--------|---------|
| `getFiles({ clientId?, projectId? })` | Fetch files scoped to client or project (one of them required). Returns list ordered by createdAt desc. |
| `createFile(data)` | Save file metadata after ImageKit upload. Zod: name, imagekitFileId, imagekitUrl, filePath, mimeType, sizeBytes, clientId, projectId. |
| `deleteFile(id)` | Delete file from ImageKit by imagekit_file_id, then hard-delete from DB. Revalidates client/project paths. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| FileManager | `components/modules/files/file-manager.tsx` | Client component. Props: `clientId?`, `projectId?`, `initialFiles`. Title "الملفات", "رفع ملف +" button, drag & drop zone, file grid (4/2/1 cols). Cards: image thumbnail (ImageKit `?tr=w-200,h-150,c-at_max`), PDF icon (red), generic file icon; name, size (KB/MB), date (DD/MM/YYYY); hover: تحميل \| نسخ الرابط \| حذف. Upload progress; empty state "لا توجد ملفات بعد. ارفع أول ملف." Delete: AlertDialog then deleteFile. RTL. |

---

## Dashboard (Home)

**Purpose:** First screen after login — KPIs, revenue chart, project status donut, overdue tasks, upcoming deadlines, recent invoices, quick actions.

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Home | `app/dashboard/page.tsx` | Server component; fetches `getDashboardData()` from `actions/dashboard.ts`, renders `DashboardHome` (client) with KPI cards, bar chart (revenue 12 months), donut (project status), three columns (overdue tasks, upcoming deadlines, recent invoices), quick action buttons. |

**Server Actions** (`actions/dashboard.ts`):

| Action | Purpose |
|--------|---------|
| `getDashboardData()` | Returns: currency (from settings), revenueThisMonth/revenueLastMonth, outstandingTotal/outstandingCount, activeProjectsCount, overdueTasksCount, revenueByMonth (12 months: invoiced vs collected), projectStatusCounts, overdueTasks (up to 5), upcomingProjects (end_date in next 14 days, up to 5), recentInvoices (last 5). All via direct Drizzle queries. |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| DashboardHome | `components/dashboard-home.tsx` | Client: Row 1 — 4 KPI cards (Revenue This Month with vs last month %, Outstanding with count, Active Projects with link to filtered list, Overdue Tasks in red). Row 2 — Bar chart (Recharts) Revenue last 12 months (Invoiced vs Collected), Donut (Recharts) Project status. Row 3 — Overdue tasks (title, project name, days overdue, link to project), Upcoming deadlines (project name, client, date, status badge), Recent invoices (number, client, amount, status). Row 4 — Quick actions: New Project, New Client, New Invoice, New Task (links to respective pages). Currency from settings for formatting; empty states when no data. |

---

## Reports

**Purpose:** Financial reports (revenue, KPIs, top clients, outstanding invoices) and project/productivity reports. RTL, Arabic labels, amounts as `1,000 ر.س`, Western numerals (1,2,3).

**Pages:**

| Route | File | Description |
|-------|------|-------------|
| Reports | `app/dashboard/reports/page.tsx` | Two tabs: **التقارير المالية** (Financial) and **تقارير المشاريع والإنتاجية** (Productivity). Date range filter (Financial only): هذا الشهر \| الشهر الماضي \| هذا الربع \| هذه السنة \| كل الوقت (default هذه السنة). **Financial tab:** KPI cards (إيرادات هذا الشهر with delta vs last month, إجمالي المحصّل, المستحق حالياً, إجمالي الفواتير هذا العام, **صافي الربح** — collected − expenses for selected period, green if positive / red if negative), revenue bar chart (الإيرادات شهر بشهر — Recharts, 3 bars per month: الفواتير المُصدرة gray, المحصّل indigo, المصروفات red/rose; tooltip shows all three; summary below: إجمالي المحصّل \| إجمالي المصروفات \| صافي الربح), two columns (أفضل العملاء إيراداً — top 5 by paid, آخر الفواتير — last 8), outstanding table (الفواتير المستحقة — pending only, مع "تحديد كمدفوعة" inline). **Productivity tab:** (1) KPI cards: المشاريع النشطة (status=active), مشاريع مكتملة هذا العام, المهام المتأخرة (red), معدل إنجاز المهام (percentage + mini progress bar); (2) two charts: توزيع المشاريع حسب الحالة (donut — نشط/متوقف/مراجعة/مكتمل/ملغي/عميل محتمل with colors), المهام المنجزة أسبوعياً (bar, last 8 weeks, indigo); (3) table "حالة المشاريع الحالية" (non-cancelled, non-completed): المشروع (link), العميل (avatar+name), الحالة, الموعد النهائي (red if passed), الميزانية, تقدم المهام (bar + fraction), الأيام المتبقية (red/amber/green); (4) "المهام المتأخرة" list with "تحديد كمكتملة" button (marks task done, revalidates); empty state "🎉 لا توجد مهام متأخرة!"; (5) "العملاء الجدد هذا العام": big count, 12-month bar chart, last 5 clients with name, status, date. |

**Server Actions** (`actions/reports.ts`):

| Action | Purpose |
|--------|---------|
| **Financial** | |
| `getFinancialSummary()` | Returns revenueThisMonth, revenueLastMonth, totalCollectedAllTime, outstandingTotal, invoicedThisYear. |
| `getMonthlyRevenue(dateRange)` | Last 12 months (or Jan–Dec for this_year) with Arabic month labels; **invoiced** (sum of invoice total by created_at), **collected** (sum of paid invoice total by paid_at), **expenses** (sum of expenses by date) per month. |
| `getTopClientsByRevenue(limit)` | Top N clients by total paid (all time). |
| `getRecentInvoices(limit)` | Last N invoices by created_at DESC. |
| `getOutstandingInvoices()` | All pending invoices with client/project, days since issue. |
| **Productivity** | |
| `getProjectsSummary()` | activeProjectsCount, completedThisYearCount, overdueTasksCount, taskCompletionRate, totalTasks, doneTasks. |
| `getProjectsByStatus()` | Count per project status for donut (Arabic labels). |
| `getWeeklyTaskCompletion()` | Last 8 weeks: count of tasks with status=done (by week of createdAt). |
| `getOverdueTasks()` | Tasks where due_date &lt; today and status ≠ done, ordered by due_date ASC. |
| `getActiveProjectsWithProgress()` | Non-cancelled, non-completed projects with client, task counts, days remaining. |
| `getNewClientsPerMonth(year)` | Total new clients in year, byMonth (12 rows), recent (last 5). |

**Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| RevenueChart | `components/reports/revenue-chart.tsx` | Client; Recharts BarChart, 3 bars: الفواتير المُصدرة (gray), المحصّل (indigo), المصروفات (red); Arabic tooltips with all three values; Legend. |
| OutstandingInvoicesTable | `components/reports/outstanding-invoices-table.tsx` | Client; RTL table, "تحديد كمدفوعة" button and dialog. |
| ProductivityReportsTab | `components/reports/productivity-reports-tab.tsx` | Client; KPI cards, donut (project status), bar (weekly task completion), projects table, overdue tasks table with "تحديد كمكتملة" (calls `updateTask`), new clients section; RTL, Arabic tooltips, Western numerals. |

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
