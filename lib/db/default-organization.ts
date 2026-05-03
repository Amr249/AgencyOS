import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  expenses,
  invoices,
  organizations,
  projects,
  settings,
  teamMembers,
  tasks,
} from "@/lib/db/schema";

const DEFAULT_SLUG = "default";

/** First organization by creation time, if any. */
export async function getDefaultOrganizationId(): Promise<string | null> {
  const [row] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Ensures at least one organization exists (single-tenant bootstrap).
 * Used until the app resolves the active org from session / subdomain.
 */
export async function ensureDefaultOrganization(): Promise<string> {
  const existing = await getDefaultOrganizationId();
  if (existing) return existing;
  const [inserted] = await db
    .insert(organizations)
    .values({
      name: "Default agency",
      slug: DEFAULT_SLUG,
      plan: "internal",
    })
    .returning({ id: organizations.id });
  if (!inserted?.id) throw new Error("Failed to create default organization");
  return inserted.id;
}

/** Load organization id for a client row. */
export async function getOrganizationIdForClient(clientId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: clients.organizationId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return row?.organizationId ?? null;
}

/** Load organization id for a project row. */
export async function getOrganizationIdForProject(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function getOrganizationIdForInvoice(invoiceId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: invoices.organizationId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function getOrganizationIdForExpense(expenseId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: expenses.organizationId })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function getOrganizationIdForTask(taskId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: tasks.organizationId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function getOrganizationIdForTeamMember(teamMemberId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: teamMembers.organizationId })
    .from(teamMembers)
    .where(eq(teamMembers.id, teamMemberId))
    .limit(1);
  return row?.organizationId ?? null;
}

/** Resolve tenant for an expense from optional FKs; falls back to default org. */
export async function resolveOrganizationIdForExpense(params: {
  clientId?: string | null;
  projectId?: string | null;
  teamMemberId?: string | null;
}): Promise<string> {
  if (params.projectId) {
    const id = await getOrganizationIdForProject(params.projectId);
    if (id) return id;
  }
  if (params.clientId) {
    const id = await getOrganizationIdForClient(params.clientId);
    if (id) return id;
  }
  if (params.teamMemberId) {
    const id = await getOrganizationIdForTeamMember(params.teamMemberId);
    if (id) return id;
  }
  return ensureDefaultOrganization();
}

/** One settings row per organization; create empty row if missing. */
export async function ensureSettingsForOrganization(organizationId: string) {
  const [existing] = await db.select().from(settings).where(eq(settings.organizationId, organizationId));
  if (existing) return existing;
  const [row] = await db.insert(settings).values({ organizationId }).returning();
  if (!row) throw new Error("Failed to create settings row");
  return row;
}
