/**
 * AgencyOS v2 Solo — Database schema (PRD v2.0)
 * Single-user dashboard. No RBAC. Optional `activity_logs` for audit trail.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  numeric,
  integer,
  bigint,
  char,
  jsonb,
  pgEnum,
  index,
  primaryKey,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums (v2 Solo)
export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);

export const clientStatusEnum = pgEnum("client_status", [
  "lead",
  "active",
  "on_hold",
  "completed",
  "closed",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "lead",
  "active",
  "on_hold",
  "review",
  "completed",
  "cancelled",
]);
export const phaseStatusEnum = pgEnum("phase_status", ["pending", "active", "completed"]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const workspaceViewEnum = pgEnum("workspace_view", ["board", "list", "timeline"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "partial", "paid"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
]);
export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
export const milestoneStatusEnum = pgEnum("milestone_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
export const teamMemberStatusEnum = pgEnum("team_member_status", ["active", "inactive"]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "applied",
  "viewed",
  "shortlisted",
  "won",
  "lost",
  "cancelled",
]);
export const serviceStatusEnum = pgEnum("service_status", ["active", "inactive"]);

/** Client documents tab (contracts, NDAs, etc.); null = general file in Files tab. */
export const fileDocumentTypeEnum = pgEnum("file_document_type", [
  "contract",
  "agreement",
  "proposal",
  "nda",
  "other",
]);

export {
  CLIENT_SOURCE_VALUES,
  type ClientSourceValue,
  CLIENT_TAG_COLOR_VALUES,
  type ClientTagColorValue,
} from "@/lib/client-constants";

// Address type (clients + agency settings)
export type AddressJson = {
  street?: string;
  city?: string;
  country?: string;
  postal?: string;
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("member"),
  avatarUrl: text("avatar_url"),
  /** User's UI theme preference. One of 'light' | 'dark' | 'system'. Null = not yet set. */
  themePreference: text("theme_preference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * In-app notifications. One row per recipient user.
 * `actorId` is the user who triggered the event (may be self, may be an admin editing a member).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Machine-readable event key, e.g. "profile.email_changed". */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Optional deep-link (e.g. /dashboard/account). */
    linkUrl: text("link_url"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.readAt),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);

// clients
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  status: clientStatusEnum("status").notNull().default("lead"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  address: jsonb("address").$type<AddressJson>(),
  logoUrl: text("logo_url"),
  notes: text("notes"),
  /** Acquisition channel (e.g. referral, website). */
  source: text("source"),
  /** Extra context (referrer name, campaign, etc.). */
  sourceDetails: text("source_details"),
  /** Free-text win/loss reason (may match a row in `win_loss_reasons`). */
  wonLostReason: text("won_lost_reason"),
  wonLostDate: date("won_lost_date"),
  /** Deal value when marked won (pipeline); optional. */
  dealValue: numeric("deal_value", { precision: 12, scale: 2 }),
  /** When true, client portal login may be allowed for this client (routes TBD). */
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Predefined win/loss reason labels for the sales pipeline (`type`: won | lost). */
export const winLossReasons = pgTable(
  "win_loss_reasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("win_loss_reasons_type_reason_unique").on(table.type, table.reason),
    index("win_loss_reasons_type_idx").on(table.type),
  ]
);

export const clientTags = pgTable("client_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("blue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientTagAssignments = pgTable(
  "client_tag_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => clientTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("client_tag_assignments_client_tag_unique").on(table.clientId, table.tagId),
    index("client_tag_assignments_client_id_idx").on(table.clientId),
    index("client_tag_assignments_tag_id_idx").on(table.tagId),
  ]
);

/** Client portal login identities (password/auth wired later). */
export const clientUsers = pgTable(
  "client_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    name: text("name"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("client_users_client_id_idx").on(table.clientId)]
);

// projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("lead"),
  coverImageUrl: text("cover_image_url"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// phases
export const phases = pgTable("phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  status: phaseStatusEnum("status").notNull().default("pending"),
});

/** Reusable project blueprints (phases + task templates). */
export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  defaultPhases: jsonb("default_phases").$type<string[]>().notNull().default([]),
  defaultBudget: numeric("default_budget", { precision: 12, scale: 2 }),
  sourceProjectId: uuid("source_project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectTemplateId: uuid("project_template_id")
      .notNull()
      .references(() => projectTemplates.id, { onDelete: "cascade" }),
    parentTaskTemplateId: uuid("parent_task_template_id").references((): any => taskTemplates.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    phaseIndex: integer("phase_index").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("task_templates_project_template_id_idx").on(table.projectTemplateId),
    index("task_templates_parent_task_template_id_idx").on(table.parentTaskTemplateId),
  ]
);

// tasks
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  phaseId: uuid("phase_id").references(() => phases.id, { onDelete: "set null" }),
  parentTaskId: uuid("parent_task_id").references((): any => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  sortOrder: integer("sort_order").notNull().default(0),
  assigneeId: uuid("assignee_id").references(() => teamMembers.id, { onDelete: "set null" }),
  milestoneId: uuid("milestone_id").references((): any => milestones.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("tasks_project_id_idx").on(table.projectId),
  index("tasks_status_idx").on(table.status),
  index("tasks_parent_task_id_idx").on(table.parentTaskId),
  index("tasks_milestone_id_idx").on(table.milestoneId),
]);

// invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: invoiceStatusEnum("status").notNull().default("pending"),
  issueDate: date("issue_date").notNull(),
  /** When null, overdue logic falls back to issue date. */
  dueDate: date("due_date"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("SAR"),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// invoice_items
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  order: integer("order").notNull().default(0),
});

/** Many-to-many: one invoice can reference multiple client projects. */
export const invoiceProjects = pgTable(
  "invoice_projects",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.invoiceId, t.projectId] }),
    index("invoice_projects_project_id_idx").on(t.projectId),
  ]
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("payments_invoice_id_idx").on(table.invoiceId),
  index("payments_date_idx").on(table.paymentDate),
]);

// files
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  imagekitFileId: text("imagekit_file_id").notNull(),
  imagekitUrl: text("imagekit_url").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  expenseId: uuid("expense_id").references((): any => expenses.id, { onDelete: "cascade" }),
  documentType: fileDocumentTypeEnum("document_type"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("files_invoice_id_idx").on(table.invoiceId),
  index("files_expense_id_idx").on(table.expenseId),
]);

// team_members
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** When set, links this roster row to a login (`users`). Falls back to email match if null. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    status: teamMemberStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_user_id_unique").on(table.userId),
  ]
);

/** Time off / holidays — used to reduce workload capacity for weekdays in range. */
export const teamAvailability = pgTable(
  "team_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    type: text("type").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_availability_member_date_unique").on(table.teamMemberId, table.date),
    index("team_availability_member_idx").on(table.teamMemberId),
    index("team_availability_date_idx").on(table.date),
  ]
);

// services
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  status: serviceStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("services_name_idx").on(table.name),
  index("services_status_idx").on(table.status),
]);

// project_services (junction: project ↔ service)
export const projectServices = pgTable("project_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("project_services_project_id_idx").on(table.projectId),
  index("project_services_service_id_idx").on(table.serviceId),
]);

// client_services (junction: client ↔ service)
export const clientServices = pgTable("client_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("client_services_client_id_idx").on(table.clientId),
  index("client_services_service_id_idx").on(table.serviceId),
]);

// project_members (junction: project ↔ team member)
export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  teamMemberId: uuid("team_member_id")
    .notNull()
    .references(() => teamMembers.id, { onDelete: "cascade" }),
  roleOnProject: text("role_on_project"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("project_members_project_id_idx").on(table.projectId),
  index("project_members_team_member_id_idx").on(table.teamMemberId),
]);

// project_user_members (junction: project ↔ user)
export const projectUserMembers = pgTable("project_user_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// task_assignments (junction: task ↔ team member; no login required)
export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_assignments_task_team_unique").on(table.taskId, table.teamMemberId),
  ]
);

// proposals (Mostaql job proposals)
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  url: text("url"),
  platform: text("platform").notNull().default("mostaql"),
  budgetMin: numeric("budget_min", { precision: 12, scale: 2 }),
  budgetMax: numeric("budget_max", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("SAR"),
  category: text("category"),
  /** Client skill tags from the job page (e.g. Mostaql), comma-separated or free text. */
  skillsTags: text("skills_tags"),
  description: text("description"),
  myBid: numeric("my_bid", { precision: 12, scale: 2 }),
  status: proposalStatusEnum("status").notNull().default("applied"),
  appliedAt: date("applied_at").notNull(),
  notes: text("notes"),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("proposals_status_idx").on(table.status),
  index("proposals_applied_at_idx").on(table.appliedAt),
]);

// proposal_services (junction: proposal ↔ service)
export const proposalServices = pgTable(
  "proposal_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("proposal_services_proposal_service_unique").on(
      table.proposalId,
      table.serviceId
    ),
    index("proposal_services_proposal_id_idx").on(table.proposalId),
    index("proposal_services_service_id_idx").on(table.serviceId),
  ]
);

// expenses
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: expenseCategoryEnum("category").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  isBillable: boolean("is_billable").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: expenseCategoryEnum("category").notNull(),
  frequency: recurrenceFrequencyEnum("frequency").notNull(),
  nextDueDate: date("next_due_date").notNull(),
  notes: text("notes"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "set null" }),
  isBillable: boolean("is_billable").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  /** Vendor logo (e.g. Vercel, Adobe) when category is software */
  vendorLogoUrl: text("vendor_logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timeLogs = pgTable(
  "time_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** Denormalized for faster project-level queries */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "set null" }),
    description: text("description"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    isBillable: boolean("is_billable").notNull().default(true),
    /** Optional rate override for this entry (e.g. billing) */
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  },
  (table) => [index("time_logs_project_id_idx").on(table.projectId)]
);

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull().default("Admin"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The blocked task */
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** The blocking task */
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("finish_to_start"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_dependencies_task_id_idx").on(table.taskId),
    index("task_dependencies_depends_on_task_id_idx").on(table.dependsOnTaskId),
  ]
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Milestone window start */
    startDate: date("start_date").notNull(),
    /** Milestone window end (same column name as before; was “due” in UI) */
    dueDate: date("due_date").notNull(),
    status: milestoneStatusEnum("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("milestones_project_id_idx").on(table.projectId),
    index("milestones_start_date_idx").on(table.startDate),
    index("milestones_due_date_idx").on(table.dueDate),
    index("milestones_status_idx").on(table.status),
  ]
);

/** Team members assigned to work on a milestone (subset of project team). */
export const milestoneTeamMembers = pgTable(
  "milestone_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("milestone_team_members_milestone_team_unique").on(table.milestoneId, table.teamMemberId),
    index("milestone_team_members_milestone_id_idx").on(table.milestoneId),
  ]
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    actorName: text("actor_name"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_logs_entity_type_entity_id_idx").on(table.entityType, table.entityId),
    index("activity_logs_created_at_idx").on(table.createdAt),
  ]
);

// settings — single row (id always 1)
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  agencyName: text("agency_name"),
  agencyEmail: text("agency_email"),
  agencyWebsite: text("agency_website"),
  vatNumber: text("vat_number"),
  agencyLogoUrl: text("agency_logo_url"),
  agencyAddress: jsonb("agency_address").$type<AddressJson>(),
  invoicePrefix: text("invoice_prefix").default("INV"),
  invoiceNextNumber: integer("invoice_next_number").default(1),
  defaultCurrency: char("default_currency", { length: 3 }).default("SAR"),
  defaultPaymentTerms: integer("default_payment_terms").default(30),
  invoiceFooter: text("invoice_footer"),
  invoiceColor: char("invoice_color", { length: 7 }),
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  invoices: many(invoices),
  files: many(files),
  proposals: many(proposals),
  clientServices: many(clientServices),
  expenses: many(expenses),
  recurringExpenses: many(recurringExpenses),
  tagAssignments: many(clientTagAssignments),
  portalUsers: many(clientUsers),
}));

export const clientTagsRelations = relations(clientTags, ({ many }) => ({
  assignments: many(clientTagAssignments),
}));

export const clientTagAssignmentsRelations = relations(clientTagAssignments, ({ one }) => ({
  client: one(clients, { fields: [clientTagAssignments.clientId], references: [clients.id] }),
  tag: one(clientTags, { fields: [clientTagAssignments.tagId], references: [clientTags.id] }),
}));

export const clientUsersRelations = relations(clientUsers, ({ one }) => ({
  client: one(clients, { fields: [clientUsers.clientId], references: [clients.id] }),
}));

export const projectTemplatesRelations = relations(projectTemplates, ({ one, many }) => ({
  taskTemplates: many(taskTemplates),
  sourceProject: one(projects, {
    fields: [projectTemplates.sourceProjectId],
    references: [projects.id],
  }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  projectTemplate: one(projectTemplates, {
    fields: [taskTemplates.projectTemplateId],
    references: [projectTemplates.id],
  }),
  parent: one(taskTemplates, {
    fields: [taskTemplates.parentTaskTemplateId],
    references: [taskTemplates.id],
    relationName: "taskTemplateTree",
  }),
  children: many(taskTemplates, { relationName: "taskTemplateTree" }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  phases: many(phases),
  tasks: many(tasks),
  templatesSavedFrom: many(projectTemplates),
  milestones: many(milestones),
  invoices: many(invoices),
  invoiceProjects: many(invoiceProjects),
  files: many(files),
  projectMembers: many(projectMembers),
  projectServices: many(projectServices),
  projectUserMembers: many(projectUserMembers),
  proposals: many(proposals),
  expenses: many(expenses),
  recurringExpenses: many(recurringExpenses),
  timeLogs: many(timeLogs),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  projectMembers: many(projectMembers),
  tasks: many(tasks),
  timeLogs: many(timeLogs),
  recurringExpenses: many(recurringExpenses),
  availability: many(teamAvailability),
  milestoneAssignments: many(milestoneTeamMembers),
}));

export const teamAvailabilityRelations = relations(teamAvailability, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [teamAvailability.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  projectServices: many(projectServices),
  clientServices: many(clientServices),
  proposalServices: many(proposalServices),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  teamMember: one(teamMembers, { fields: [projectMembers.teamMemberId], references: [teamMembers.id] }),
}));

export const projectServicesRelations = relations(projectServices, ({ one }) => ({
  project: one(projects, { fields: [projectServices.projectId], references: [projects.id] }),
  service: one(services, { fields: [projectServices.serviceId], references: [services.id] }),
}));

export const clientServicesRelations = relations(clientServices, ({ one }) => ({
  client: one(clients, { fields: [clientServices.clientId], references: [clients.id] }),
  service: one(services, { fields: [clientServices.serviceId], references: [services.id] }),
}));

export const projectUserMembersRelations = relations(projectUserMembers, ({ one }) => ({
  project: one(projects, { fields: [projectUserMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectUserMembers.userId], references: [users.id] }),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignments.taskId], references: [tasks.id] }),
  teamMember: one(teamMembers, {
    fields: [taskAssignments.teamMemberId],
    references: [teamMembers.id],
  }),
  assignedByUser: one(users, { fields: [taskAssignments.assignedBy], references: [users.id] }),
}));

export const phasesRelations = relations(phases, ({ one, many }) => ({
  project: one(projects, { fields: [phases.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  phase: one(phases, { fields: [tasks.phaseId], references: [phases.id] }),
  parentTask: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  assignee: one(teamMembers, { fields: [tasks.assigneeId], references: [teamMembers.id] }),
  subtasks: many(tasks),
  files: many(files),
  taskAssignments: many(taskAssignments),
  timeLogs: many(timeLogs),
  comments: many(taskComments),
  blockedByDependencies: many(taskDependencies, { relationName: "taskBlockedBy" }),
  blockingDependencies: many(taskDependencies, { relationName: "taskBlocking" }),
}));

export const invoiceProjectsRelations = relations(invoiceProjects, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceProjects.invoiceId], references: [invoices.id] }),
  project: one(projects, { fields: [invoiceProjects.projectId], references: [projects.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  invoiceProjects: many(invoiceProjects),
  items: many(invoiceItems),
  payments: many(payments),
  files: many(files),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  client: one(clients, { fields: [files.clientId], references: [clients.id] }),
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [files.taskId], references: [tasks.id] }),
  invoice: one(invoices, { fields: [files.invoiceId], references: [invoices.id] }),
  expense: one(expenses, { fields: [files.expenseId], references: [expenses.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  client: one(clients, { fields: [proposals.clientId], references: [clients.id] }),
  project: one(projects, { fields: [proposals.projectId], references: [projects.id] }),
  proposalServices: many(proposalServices),
}));

export const proposalServicesRelations = relations(proposalServices, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalServices.proposalId],
    references: [proposals.id],
  }),
  service: one(services, {
    fields: [proposalServices.serviceId],
    references: [services.id],
  }),
}));

export const expenseServices = pgTable("expense_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
});

export const expenseServicesRelations = relations(expenseServices, ({ one }) => ({
  expense: one(expenses, { fields: [expenseServices.expenseId], references: [expenses.id] }),
  service: one(services, { fields: [expenseServices.serviceId], references: [services.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  teamMember: one(teamMembers, { fields: [expenses.teamMemberId], references: [teamMembers.id] }),
  project: one(projects, { fields: [expenses.projectId], references: [projects.id] }),
  client: one(clients, { fields: [expenses.clientId], references: [clients.id] }),
  expenseServices: many(expenseServices),
  files: many(files),
}));

export const recurringExpensesRelations = relations(recurringExpenses, ({ one }) => ({
  project: one(projects, {
    fields: [recurringExpenses.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [recurringExpenses.clientId],
    references: [clients.id],
  }),
  teamMember: one(teamMembers, {
    fields: [recurringExpenses.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const timeLogsRelations = relations(timeLogs, ({ one }) => ({
  task: one(tasks, { fields: [timeLogs.taskId], references: [tasks.id] }),
  project: one(projects, { fields: [timeLogs.projectId], references: [projects.id] }),
  teamMember: one(teamMembers, { fields: [timeLogs.teamMemberId], references: [teamMembers.id] }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: "taskBlockedBy",
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "taskBlocking",
  }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(tasks),
  assignees: many(milestoneTeamMembers),
}));

export const milestoneTeamMembersRelations = relations(milestoneTeamMembers, ({ one }) => ({
  milestone: one(milestones, {
    fields: [milestoneTeamMembers.milestoneId],
    references: [milestones.id],
  }),
  teamMember: one(teamMembers, {
    fields: [milestoneTeamMembers.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export type ProjectMember = typeof projectUserMembers.$inferSelect;
export type NewProjectMember = typeof projectUserMembers.$inferInsert;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;
