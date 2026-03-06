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

// Address type (clients + agency settings)
export type AddressJson = {
  street?: string;
  city?: string;
  country?: string;
  postal?: string;
};

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

// expenses
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: expenseCategoryEnum("category").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
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
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  phases: many(phases),
  tasks: many(tasks),
  invoices: many(invoices),
  files: many(files),
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

// expenses have no relations (standalone)
