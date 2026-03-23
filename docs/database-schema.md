# Database schema (Drizzle)

Source of truth: [`lib/db/schema.ts`](../lib/db/schema.ts). Migrations live in [`/drizzle`](../drizzle/). The Drizzle client uses **Neon serverless** (`drizzle-orm/neon-http`) in [`lib/db/index.ts`](../lib/db/index.ts).

## Enums (`pgEnum`)

| Enum | Values |
|------|--------|
| `user_role` | `admin`, `member` |
| `client_status` | `lead`, `active`, `on_hold`, `completed`, `closed` |
| `project_status` | `lead`, `active`, `on_hold`, `review`, `completed`, `cancelled` |
| `phase_status` | `pending`, `active`, `completed` |
| `task_status` | `todo`, `in_progress`, `in_review`, `done`, `blocked` |
| `task_priority` | `low`, `medium`, `high`, `urgent` |
| `invoice_status` | `pending`, `paid` |
| `expense_category` | `software`, `hosting`, `marketing`, `salaries`, `equipment`, `office`, `other` |
| `team_member_status` | `active`, `inactive` |
| `proposal_status` | `applied`, `viewed`, `shortlisted`, `won`, `lost`, `cancelled` |
| `service_status` | `active`, `inactive` |
| `workspace_view` | `board`, `list`, `timeline` |

## TypeScript-only type

- **`AddressJson`** — `{ street?, city?, country?, postal? }` used for `clients.address` and `settings.agency_address`.

## Tables

### `users`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK, default random |
| `name` | text | NOT NULL |
| `email` | text | NOT NULL, UNIQUE |
| `password_hash` | text | NOT NULL |
| `role` | user_role | NOT NULL, default `member` |
| `avatar_url` | text | nullable |
| `created_at` | timestamp | NOT NULL, default now |

### `clients`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `company_name` | text | NOT NULL |
| `status` | client_status | NOT NULL, default `lead` |
| `contact_name`, `contact_email`, `contact_phone` | text | optional |
| `website` | text | optional |
| `address` | jsonb | `AddressJson` |
| `logo_url`, `notes` | text | optional |
| `created_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | soft delete |

### `projects`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `client_id` | UUID | NOT NULL → `clients.id` **ON DELETE CASCADE** |
| `name` | text | NOT NULL |
| `description`, `cover_image_url`, `notes` | text | optional |
| `status` | project_status | NOT NULL, default `lead` |
| `start_date`, `end_date` | date | optional |
| `budget` | numeric(12,2) | optional |
| `created_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | soft delete |

### `phases`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL → `projects.id` **CASCADE** |
| `name` | text | NOT NULL |
| `order` | integer | NOT NULL, default 0 |
| `status` | phase_status | NOT NULL, default `pending` |

### `tasks`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL → `projects.id` **CASCADE** |
| `phase_id` | UUID | → `phases.id` **ON DELETE SET NULL** |
| `parent_task_id` | UUID | self-FK → `tasks.id` **CASCADE** (subtasks) |
| `title` | text | NOT NULL |
| `description`, `notes` | text | optional |
| `status` | task_status | NOT NULL, default `todo` |
| `priority` | task_priority | NOT NULL, default `medium` |
| `due_date` | date | optional |
| `estimated_hours` | numeric(6,2) | optional |
| `sort_order` | integer | NOT NULL, default 0 |
| `assignee_id` | UUID | optional → `team_members.id` (**SET NULL**) |
| `actual_hours` | numeric(6,2) | optional |
| `created_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | soft delete |

Indexes: `tasks_project_id_idx`, `tasks_status_idx`, `tasks_parent_task_id_idx`.

### `invoices`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `invoice_number` | text | NOT NULL, UNIQUE |
| `client_id` | UUID | NOT NULL → `clients.id` **CASCADE** |
| `project_id` | UUID | → `projects.id` **SET NULL** |
| `status` | invoice_status | NOT NULL, default `pending` |
| `issue_date` | date | NOT NULL |
| `subtotal`, `tax_amount`, `total` | numeric(12,2) | tax default 0 |
| `currency` | char(3) | NOT NULL, default `SAR` |
| `notes`, `payment_method` | text | optional |
| `paid_at` | timestamptz | optional |
| `created_at` | timestamptz | NOT NULL |

### `invoice_items`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `invoice_id` | UUID | NOT NULL → `invoices.id` **CASCADE** |
| `description` | text | NOT NULL |
| `quantity` | numeric(8,2) | NOT NULL |
| `unit_price`, `tax_rate`, `amount` | numeric | NOT NULL |
| `order` | integer | NOT NULL, default 0 |

### `files`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `name` | text | NOT NULL |
| `imagekit_file_id`, `imagekit_url`, `file_path` | text | NOT NULL |
| `mime_type` | text | optional |
| `size_bytes` | bigint | optional |
| `client_id`, `project_id`, `task_id` | UUID | optional FKs with **CASCADE** |
| `created_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | optional |

### `team_members`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `name` | text | NOT NULL |
| `role`, `email`, `phone`, `avatar_url`, `notes` | text | optional |
| `status` | team_member_status | NOT NULL, default `active` |
| `created_at` | timestamptz | NOT NULL |

### `services`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `name` | text | NOT NULL |
| `description` | text | optional |
| `status` | service_status | NOT NULL, default `active` |
| `created_at`, `updated_at` | timestamptz | NOT NULL |

Indexes: `services_name_idx`, `services_status_idx`.

### `project_services` (junction)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL → `projects` **CASCADE** |
| `service_id` | UUID | NOT NULL → `services` **CASCADE** |
| `created_at` | timestamptz | NOT NULL |

Indexes on `project_id`, `service_id`.

### `client_services` (junction)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `client_id` | UUID | NOT NULL → `clients` **CASCADE** |
| `service_id` | UUID | NOT NULL → `services` **CASCADE** |
| `created_at` | timestamptz | NOT NULL |

Indexes on `client_id`, `service_id`.

### `project_members` (team ↔ project)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL → `projects` **CASCADE** |
| `team_member_id` | UUID | NOT NULL → `team_members` **CASCADE** |
| `role_on_project` | text | optional |
| `assigned_at` | timestamptz | NOT NULL |

### `project_user_members` (app users ↔ project)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `project_id` | UUID | NOT NULL → `projects` **CASCADE** |
| `user_id` | UUID | NOT NULL → `users` **CASCADE** |
| `role` | text | NOT NULL, default `member` |
| `joined_at` | timestamp | NOT NULL |

### `task_assignments` (task ↔ user)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `task_id` | UUID | NOT NULL → `tasks` **CASCADE** |
| `user_id` | UUID | NOT NULL → `users` **CASCADE** |
| `assigned_by` | UUID | → `users` **SET NULL** |
| `assigned_at` | timestamp | NOT NULL |

### `proposals`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `title` | text | NOT NULL |
| `url`, `category`, `description`, `notes` | text | optional |
| `platform` | text | NOT NULL, default `mostaql` |
| `budget_min`, `budget_max`, `my_bid` | numeric(12,2) | optional |
| `currency` | text | NOT NULL, default `SAR` |
| `status` | proposal_status | NOT NULL, default `applied` |
| `applied_at` | date | NOT NULL |
| `client_id`, `project_id` | UUID | optional → **SET NULL** |
| `created_at` | timestamptz | NOT NULL |

Indexes: `proposals_status_idx`, `proposals_applied_at_idx`.

### `expenses`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `title` | text | NOT NULL |
| `amount` | numeric(12,2) | NOT NULL |
| `category` | expense_category | NOT NULL |
| `date` | date | NOT NULL |
| `notes`, `receipt_url` | text | optional |
| `team_member_id` | UUID | → `team_members` **SET NULL** |
| `created_at` | timestamptz | NOT NULL |

### `settings` (singleton row)

| Column | Type | Notes |
|--------|------|--------|
| `id` | integer | PK, default `1` — single row |
| `agency_name`, `agency_email`, `agency_website`, `vat_number`, `agency_logo_url`, `invoice_prefix`, `invoice_footer` | text | optional |
| `agency_address` | jsonb | `AddressJson` |
| `invoice_next_number` | integer | default 1 |
| `default_currency` | char(3) | default `SAR` |
| `default_payment_terms` | integer | default 30 |
| `invoice_color` | char(7) | optional hex |

### `time_logs`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `task_id` | UUID | NOT NULL → `tasks.id` **CASCADE** |
| `team_member_id` | UUID | optional → `team_members.id` **SET NULL** |
| `description` | text | optional |
| `started_at` | timestamptz | optional |
| `ended_at` | timestamptz | optional |
| `hours` | numeric(6,2) | NOT NULL |
| `logged_at` | timestamptz | NOT NULL, default now |
| `created_at` | timestamptz | NOT NULL, default now |

### `task_comments`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `task_id` | UUID | NOT NULL → `tasks.id` **CASCADE** |
| `author_name` | text | NOT NULL, default `Admin` |
| `body` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

## Relationships (summary)

- **clients** → many **projects**, **invoices**, **files**, **proposals**, **client_services**
- **projects** → many **phases**, **tasks**, **invoices**, **files**, **project_members**, **project_services**, **project_user_members**, **proposals**
- **phases** → many **tasks**
- **tasks** → self-referential subtasks; many **files**; many **task_assignments** (users)
- **tasks** → optional **team_members** assignee; many **time_logs**; many **task_comments**
- **invoices** → many **invoice_items**
- **team_members** → **project_members**, **expenses**
- **services** ↔ **projects** / **clients** via junction tables

Drizzle `relations()` definitions at the bottom of `schema.ts` mirror the above for query API.
