/**
 * AgencyOS v2 Solo — Database schema (PRD v2.0)
 * Single-user dashboard. No users table, no RBAC, no activity_log.
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
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

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
  dueDate: date("due_date"),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("tasks_project_id_idx").on(table.projectId),
  index("tasks_status_idx").on(table.status),
  index("tasks_parent_task_id_idx").on(table.parentTaskId),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// team_members
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  status: teamMemberStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

// task_assignments (junction: task ↔ user)
export const taskAssignments = pgTable("task_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// settings — single row (id always 1)
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  agencyName: text("agency_name"),
  agencyEmail: text("agency_email"),
  agencyWebsite: text("agency_website"),
  vatNumber: text("vat_number"),
  agencyLogoUrl: text("agency_logo_url"),
  agencyAddress: jsonb("agency_address").$type<AddressJson>(),
  invoicePrefix: text("invoice_prefix").default("فاتورة"),
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
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  phases: many(phases),
  tasks: many(tasks),
  invoices: many(invoices),
  files: many(files),
  projectMembers: many(projectMembers),
  projectServices: many(projectServices),
  projectUserMembers: many(projectUserMembers),
  proposals: many(proposals),
}));

export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  projectMembers: many(projectMembers),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  projectServices: many(projectServices),
  clientServices: many(clientServices),
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
  user: one(users, { fields: [taskAssignments.userId], references: [users.id] }),
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
  subtasks: many(tasks),
  files: many(files),
  taskAssignments: many(taskAssignments),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  client: one(clients, { fields: [files.clientId], references: [clients.id] }),
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [files.taskId], references: [tasks.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  client: one(clients, { fields: [proposals.clientId], references: [clients.id] }),
  project: one(projects, { fields: [proposals.projectId], references: [projects.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  teamMember: one(teamMembers, { fields: [expenses.teamMemberId], references: [teamMembers.id] }),
}));

export type ProjectMember = typeof projectUserMembers.$inferSelect;
export type NewProjectMember = typeof projectUserMembers.$inferInsert;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;
