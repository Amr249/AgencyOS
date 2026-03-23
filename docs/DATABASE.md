# Database

Neon (PostgreSQL) via Drizzle ORM. All tables use UUID primary keys unless noted. Timestamps are `timestamptz`. Soft-delete uses `deleted_at` where listed. **Update this file whenever the Drizzle schema changes.**

---

## Enums

| Enum | Values |
|------|--------|
| `client_status` | `lead`, `active`, `on_hold`, `completed`, `closed` |
| `project_status` | `lead`, `active`, `on_hold`, `review`, `completed`, `cancelled` |
| `phase_status` | `pending`, `active`, `completed` |
| `task_status` | `todo`, `in_progress`, `in_review`, `done`, `blocked` |
| `task_priority` | `low`, `medium`, `high`, `urgent` |
| `invoice_status` | `pending`, `paid` |
| `expense_category` | `software`, `hosting`, `marketing`, `salaries`, `equipment`, `office`, `other` |
| `team_member_status` | `active`, `inactive` |
| `proposal_status` | `applied`, `viewed`, `shortlisted`, `won`, `lost`, `cancelled` |
| `workspace_view` | `board`, `list`, `timeline` |

**Migrating `invoice_status` from old values:** If the DB currently has `draft`/`sent`/`overdue`/`cancelled`, run a data migration before changing the enum: map all non-`paid` to `pending` (e.g. `UPDATE invoices SET status = 'pending' WHERE status IN ('draft','sent','overdue','cancelled')`). Then recreate the enum: create new type `invoice_status_new` with values `('pending','paid')`, alter column to use it with a `USING` expression, drop old type, rename new type. Alternatively use `drizzle-kit generate` and adapt the generated migration.

**Note:** If migrating from an older schema where `client_status` was `lead` | `active` | `inactive`, generate and run a Drizzle migration to alter the enum (add `on_hold`, `completed`, `closed`; migrate existing `inactive` rows to e.g. `closed` if desired; then remove `inactive` from the enum).

---

## Type: AddressJson

Used in `clients.address` and `settings.agency_address`.

```ts
type AddressJson = {
  street?: string;
  city?: string;
  country?: string;
  postal?: string;
};
```

---

## Tables

### clients

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| company_name | text | NOT NULL |
| status | client_status | NOT NULL, default `lead` |
| contact_name | text | Primary contact full name |
| contact_email | text | |
| contact_phone | text | |
| website | text | |
| address | jsonb | AddressJson |
| logo_url | text | ImageKit CDN URL |
| notes | text | Private notes |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Archived at (soft delete); when set, client is archived and excluded from active list |

**Indexes:** Primary key on `id`.  
**Relations:** One-to-many to `projects`, `invoices`, `files`, `proposals`.

---

### projects

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| client_id | uuid | NOT NULL, FK → clients.id, ON DELETE CASCADE |
| name | text | NOT NULL |
| description | text | |
| status | project_status | NOT NULL, default `lead` |
| cover_image_url | text | Optional; ImageKit URL for project cover (Gallery card + detail banner). |
| start_date | date | |
| end_date | date | Deadline |
| budget | numeric(12,2) | |
| notes | text | Private notes |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft delete |

**Relations:** Many-to-one `client`; one-to-many `phases`, `tasks`, `invoices`, `files`, `proposals`.

---

### proposals

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| title | text | NOT NULL — job title |
| url | text | Mostaql job URL |
| platform | text | NOT NULL, default `mostaql` (future: other platforms) |
| budget_min | numeric(12,2) | Extracted from page |
| budget_max | numeric(12,2) | Extracted from page |
| currency | text | NOT NULL, default `SAR` |
| category | text | e.g. تطوير مواقع |
| description | text | Job description |
| my_bid | numeric(12,2) | What you proposed |
| status | proposal_status | NOT NULL, default `applied` |
| applied_at | date | NOT NULL — default today |
| notes | text | |
| client_id | uuid | FK → clients.id, nullable; set when converted to client |
| project_id | uuid | FK → projects.id, nullable; set when converted to project |
| created_at | timestamptz | NOT NULL, default now() |

**Relations:** Many-to-one `client`, `project`.  
**Indexes:** Index on `status`, `applied_at`.

---

### phases

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| project_id | uuid | NOT NULL, FK → projects.id, ON DELETE CASCADE |
| name | text | NOT NULL (e.g. Discovery, Design, Dev) |
| order | int | NOT NULL, default 0, display order |
| status | phase_status | NOT NULL, default `pending` |

**Relations:** Many-to-one `project`; one-to-many `tasks`.

---

### tasks

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| project_id | uuid | NOT NULL, FK → projects.id, ON DELETE CASCADE |
| phase_id | uuid | FK → phases.id, ON DELETE SET NULL |
| parent_task_id | uuid | FK → tasks.id, subtasks, ON DELETE CASCADE |
| title | text | NOT NULL |
| description | text | Rich text |
| status | task_status | NOT NULL, default `todo` |
| priority | task_priority | NOT NULL, default `medium` |
| due_date | date | |
| estimated_hours | numeric(6,2) | |
| sort_order | integer | NOT NULL, default 0 |
| assignee_id | uuid | FK → team_members.id, ON DELETE SET NULL |
| actual_hours | numeric(6,2) | Logged tracked hours aggregate |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft delete |

**Relations:** Many-to-one `project`, `phase`, `parentTask`; one-to-many `subtasks`, `files`.

---

### time_logs

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| task_id | uuid | NOT NULL, FK → tasks.id, ON DELETE CASCADE |
| team_member_id | uuid | FK → team_members.id, ON DELETE SET NULL |
| description | text | Optional |
| started_at | timestamptz | Optional |
| ended_at | timestamptz | Optional |
| hours | numeric(6,2) | NOT NULL |
| logged_at | timestamptz | NOT NULL, default now() |
| created_at | timestamptz | NOT NULL, default now() |

**Relations:** many-to-one `task`, optional many-to-one `team_member`.

---

### task_comments

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| task_id | uuid | NOT NULL, FK → tasks.id, ON DELETE CASCADE |
| author_name | text | NOT NULL, default `Admin` |
| body | text | NOT NULL |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**Relations:** many-to-one `task`.

---

### invoices

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| invoice_number | text | NOT NULL, UNIQUE (e.g. فاتورة-001) |
| client_id | uuid | NOT NULL, FK → clients.id, ON DELETE CASCADE |
| project_id | uuid | FK → projects.id, ON DELETE SET NULL |
| status | invoice_status | NOT NULL, default `pending` |
| issue_date | date | NOT NULL |
| due_date | date | NOT NULL |
| subtotal | numeric(12,2) | NOT NULL |
| tax_amount | numeric(12,2) | NOT NULL, default 0 |
| total | numeric(12,2) | NOT NULL |
| currency | char(3) | NOT NULL, default `SAR` (ISO 4217) |
| notes | text | Payment instructions / footer |
| paid_at | timestamptz | Set when marked paid |
| payment_method | text | e.g. bank_transfer, cash, other |
| created_at | timestamptz | NOT NULL, default now() |

**Relations:** Many-to-one `client`, `project`; one-to-many `invoice_items`.  
**Indexes:** Unique on `invoice_number`.

---

### invoice_items

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| invoice_id | uuid | NOT NULL, FK → invoices.id, ON DELETE CASCADE |
| description | text | NOT NULL |
| quantity | numeric(8,2) | NOT NULL |
| unit_price | numeric(12,2) | NOT NULL |
| tax_rate | numeric(5,2) | NOT NULL, default 0 (percent) |
| amount | numeric(12,2) | NOT NULL (quantity × unit_price) |
| order | int | NOT NULL, default 0, line order |

**Relations:** Many-to-one `invoice`.

---

### team_members

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| role | text | e.g. مصمم, مطور, مدير مشروع |
| email | text | |
| phone | text | |
| avatar_url | text | ImageKit URL (scope team-avatar) |
| status | team_member_status | NOT NULL, default `active` |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |

**Relations:** One-to-many to `project_members`; expenses can reference via `team_member_id`.  
**Indexes:** Primary key on `id`.

---

### project_members

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| project_id | uuid | NOT NULL, FK → projects.id, ON DELETE CASCADE |
| team_member_id | uuid | NOT NULL, FK → team_members.id, ON DELETE CASCADE |
| role_on_project | text | Optional e.g. المطور الرئيسي |
| assigned_at | timestamptz | NOT NULL, default now() |

**Relations:** Many-to-one `project`, `team_member`.  
**Indexes:** Primary key on `id`; index on `project_id`; index on `team_member_id`.

---

### expenses

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| title | text | NOT NULL (e.g. "Adobe Creative Cloud") |
| amount | numeric(12,2) | NOT NULL, in SAR |
| category | expense_category | NOT NULL |
| date | date | NOT NULL, when the expense occurred |
| notes | text | Optional description |
| receipt_url | text | Optional ImageKit URL for receipt photo |
| team_member_id | uuid | FK → team_members.id, ON DELETE SET NULL (for salary tracking) |
| created_at | timestamptz | NOT NULL, default now() |

**Relations:** Optional many-to-one `team_member` (for salary/سجل الرواتب).  
**Indexes:** Primary key on `id`.

---

### files

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL, original filename |
| imagekit_file_id | text | NOT NULL, ImageKit internal ID |
| imagekit_url | text | NOT NULL, full CDN URL |
| file_path | text | NOT NULL, ImageKit folder path |
| mime_type | text | |
| size_bytes | bigint | |
| client_id | uuid | FK → clients.id, ON DELETE CASCADE |
| project_id | uuid | FK → projects.id, ON DELETE CASCADE |
| task_id | uuid | FK → tasks.id, ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft delete |

At least one of `client_id`, `project_id`, `task_id` is set (scoped to client/project/task).  
**Relations:** Many-to-one `client`, `project`, `task`.

---

### settings

Single-row table (id always 1). Agency branding and invoice defaults.

| Field | Type | Notes |
|-------|------|-------|
| id | int | PK, default 1 (only row) |
| agency_name | text | |
| agency_logo_url | text | ImageKit URL |
| agency_website | text | |
| agency_address | jsonb | AddressJson |
| agency_email | text | |
| invoice_prefix | text | default `فاتورة` |
| invoice_next_number | int | default 1, auto-increment source |
| default_currency | char(3) | default `SAR` |
| default_payment_terms | int | default 30 (days) |
| invoice_footer | text | |
| vat_number | text | |
| invoice_color | char(7) | Hex for PDF branding |

**No relations.** One row per app.

---

## Relationships summary

- **clients** → projects, invoices, files  
- **projects** → client, phases, tasks, invoices, files  
- **phases** → project, tasks  
- **tasks** → project, phase, parentTask, subtasks, files  
- **tasks** → optional assignee (`team_members`) + many `time_logs` + many `task_comments`
- **invoices** → client, project, invoice_items  
- **invoice_items** → invoice  
- **expenses** → team_member (optional, for salary)
- **projects** → project_members → team_members  
- **files** → client, project, task  
- **settings** — standalone
