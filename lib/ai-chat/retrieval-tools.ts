/**
 * Whitelisted read-only queries for AI chat context. No model-generated SQL.
 * Every query is scoped by organizationId from the server session (see executeAiChatTool).
 */

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  db,
  clients,
  projects,
  tasks,
  invoices,
  proposals,
  mostaqlProjects,
  mostaqlScrapeRuns,
  settings,
} from "@/lib/db";
import { getOrganizationIdForAiDataAccess } from "@/lib/ai-chat/ai-chat-org";

export function cleanLikeToken(raw: string): string | null {
  const t = raw.replace(/[%_\\]/g, "").trim().slice(0, 64);
  return t.length >= 2 ? t : null;
}

export async function getSettingsSnapshot(organizationId: string) {
  const [row] = await db
    .select({
      agencyName: settings.agencyName,
      agencyEmail: settings.agencyEmail,
      agencyWebsite: settings.agencyWebsite,
      defaultCurrency: settings.defaultCurrency,
    })
    .from(settings)
    .where(eq(settings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

export async function getProjectStatusCounts(organizationId: string) {
  const rows = await db
    .select({
      status: projects.status,
      total: sql<number>`cast(count(*) as int)`.as("total"),
    })
    .from(projects)
    .where(and(isNull(projects.deletedAt), eq(projects.organizationId, organizationId)))
    .groupBy(projects.status);
  return rows;
}

/** Job proposals (Mostaql etc.) — `status` includes applied | viewed | shortlisted | won | lost | cancelled. */
export async function getProposalStatusCounts(organizationId: string) {
  const rows = await db
    .select({
      status: proposals.status,
      total: sql<number>`cast(count(*) as int)`.as("total"),
    })
    .from(proposals)
    .where(eq(proposals.organizationId, organizationId))
    .groupBy(proposals.status);
  return rows;
}

export type ProposalOutcomeStatus =
  | "applied"
  | "viewed"
  | "shortlisted"
  | "won"
  | "lost"
  | "cancelled";

export async function listProposalsByOutcomeStatus(
  organizationId: string,
  status: ProposalOutcomeStatus,
  limit = 25
) {
  return db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      platform: proposals.platform,
      appliedAt: proposals.appliedAt,
      myBid: proposals.myBid,
      url: proposals.url,
    })
    .from(proposals)
    .where(and(eq(proposals.organizationId, organizationId), eq(proposals.status, status)))
    .orderBy(desc(proposals.appliedAt))
    .limit(limit);
}

export async function listProjectsByStatus(
  organizationId: string,
  status: "lead" | "active" | "on_hold" | "review" | "completed" | "cancelled",
  limit = 25
) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      clientId: projects.clientId,
      clientName: clients.companyName,
      budget: projects.budget,
      startDate: projects.startDate,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(clients.organizationId, organizationId),
        eq(projects.status, status),
        isNull(projects.deletedAt),
        isNull(clients.deletedAt)
      )
    )
    .orderBy(desc(projects.createdAt))
    .limit(limit);
}

export async function searchClients(organizationId: string, pattern: string, limit = 15) {
  const p = `%${pattern}%`;
  return db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      status: clients.status,
      contactName: clients.contactName,
      contactEmail: clients.contactEmail,
    })
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
        or(ilike(clients.companyName, p), ilike(clients.contactName, p), ilike(clients.contactEmail, p))
      )
    )
    .orderBy(desc(clients.createdAt))
    .limit(limit);
}

export async function searchProjects(organizationId: string, pattern: string, limit = 15) {
  const p = `%${pattern}%`;
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      clientId: projects.clientId,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(clients.organizationId, organizationId),
        isNull(projects.deletedAt),
        isNull(clients.deletedAt),
        or(ilike(projects.name, p), ilike(projects.description, p))
      )
    )
    .orderBy(desc(projects.createdAt))
    .limit(limit);
}

export async function searchTasks(organizationId: string, pattern: string, limit = 15) {
  const p = `%${pattern}%`;
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      projectId: tasks.projectId,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.organizationId, organizationId),
        eq(projects.organizationId, organizationId),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
        or(ilike(tasks.title, p), ilike(tasks.description, p))
      )
    )
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
}

export async function recentInvoices(organizationId: string, limit = 10) {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      clientName: clients.companyName,
      projectId: invoices.projectId,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.organizationId, organizationId), eq(clients.organizationId, organizationId)))
    .orderBy(desc(invoices.issueDate))
    .limit(limit);
}

export async function searchProposals(organizationId: string, pattern: string, limit = 12) {
  const p = `%${pattern}%`;
  return db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      platform: proposals.platform,
      appliedAt: proposals.appliedAt,
      budgetMin: proposals.budgetMin,
      budgetMax: proposals.budgetMax,
      currency: proposals.currency,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.organizationId, organizationId),
        or(
          ilike(proposals.title, p),
          ilike(proposals.description, p),
          ilike(proposals.skillsTags, p),
          ilike(proposals.notes, p)
        )
      )
    )
    .orderBy(desc(proposals.appliedAt))
    .limit(limit);
}

export async function latestMostaqlScrapeRuns(organizationId: string, limit = 5) {
  return db
    .select({
      id: mostaqlScrapeRuns.id,
      startedAt: mostaqlScrapeRuns.startedAt,
      finishedAt: mostaqlScrapeRuns.finishedAt,
      status: mostaqlScrapeRuns.status,
      pagesRequested: mostaqlScrapeRuns.pagesRequested,
      pagesFetched: mostaqlScrapeRuns.pagesFetched,
      projectsFound: mostaqlScrapeRuns.projectsFound,
      projectsSaved: mostaqlScrapeRuns.projectsSaved,
      categoriesJson: mostaqlScrapeRuns.categoriesJson,
      errorMessage: mostaqlScrapeRuns.errorMessage,
    })
    .from(mostaqlScrapeRuns)
    .where(eq(mostaqlScrapeRuns.organizationId, organizationId))
    .orderBy(desc(mostaqlScrapeRuns.startedAt))
    .limit(limit);
}

export async function searchMostaqlProjects(organizationId: string, pattern: string, limit = 12) {
  const p = `%${pattern}%`;
  return db
    .select({
      id: mostaqlProjects.id,
      runId: mostaqlProjects.runId,
      mostaqlId: mostaqlProjects.mostaqlId,
      title: mostaqlProjects.title,
      category: mostaqlProjects.category,
      projectStatus: mostaqlProjects.projectStatus,
      url: mostaqlProjects.url,
      scrapedAt: mostaqlProjects.scrapedAt,
    })
    .from(mostaqlProjects)
    .innerJoin(mostaqlScrapeRuns, eq(mostaqlProjects.runId, mostaqlScrapeRuns.id))
    .where(
      and(
        eq(mostaqlScrapeRuns.organizationId, organizationId),
        or(
          ilike(mostaqlProjects.title, p),
          ilike(mostaqlProjects.description, p),
          ilike(mostaqlProjects.clientName, p)
        )
      )
    )
    .orderBy(desc(mostaqlProjects.scrapedAt))
    .limit(limit);
}

export type WhitelistedToolName =
  | "list_projects"
  | "list_clients"
  | "recent_invoices"
  | "mostaql_latest_runs";

export type ListProjectsArgs = { status?: "lead" | "active" | "on_hold" | "review" | "completed" | "cancelled" };

/**
 * Structured "tool" dispatch without OpenRouter — same whitelist the model would use in a tool loop.
 * organizationId is always taken from the server session (never from tool args).
 */
export async function executeAiChatTool(
  name: WhitelistedToolName,
  args: unknown
): Promise<string> {
  const org = await getOrganizationIdForAiDataAccess();
  if (!org.ok) {
    return JSON.stringify({
      error: "forbidden",
      message: "AI data tools require an authenticated admin session with an organization.",
    });
  }
  const organizationId = org.organizationId;

  switch (name) {
    case "list_projects": {
      const allowed = ["lead", "active", "on_hold", "review", "completed", "cancelled"] as const;
      type ProjectListStatus = (typeof allowed)[number];
      const raw =
        args &&
        typeof args === "object" &&
        "status" in args &&
        typeof (args as ListProjectsArgs).status === "string"
          ? (args as ListProjectsArgs).status
          : undefined;
      const st: ProjectListStatus =
        raw && (allowed as readonly string[]).includes(raw) ? (raw as ProjectListStatus) : "active";
      const rows = await listProjectsByStatus(organizationId, st, 30);
      return JSON.stringify({ tool: name, status: st, projects: rows });
    }
    case "list_clients": {
      const q =
        args && typeof args === "object" && "query" in args && typeof (args as { query?: string }).query === "string"
          ? (args as { query: string }).query
          : "";
      const token = cleanLikeToken(q.trim());
      if (!token) {
        return JSON.stringify({ tool: name, query: q, clients: [], note: "query too short or empty" });
      }
      const rows = await searchClients(organizationId, token, 25);
      return JSON.stringify({ tool: name, query: q, clients: rows });
    }
    case "recent_invoices": {
      const rows = await recentInvoices(organizationId, 12);
      return JSON.stringify({ tool: name, invoices: rows });
    }
    case "mostaql_latest_runs": {
      const rows = await latestMostaqlScrapeRuns(organizationId, 5);
      return JSON.stringify({ tool: name, runs: rows });
    }
    default:
      return JSON.stringify({ error: "unknown_tool", name });
  }
}

/** OpenRouter-compatible tool definitions for a future non-stream tool round (documented contract). */
export const AI_CHAT_OPENROUTER_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_projects",
      description: "List projects filtered by status (default active). Admin-only; scoped to the signed-in organization.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["lead", "active", "on_hold", "review", "completed", "cancelled"],
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_clients",
      description: "Search clients by company or contact substring within the signed-in organization only.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search substring" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recent_invoices",
      description: "Recent invoices with client names and totals for the signed-in organization only.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mostaql_latest_runs",
      description: "Latest Mostaql scrape runs for this organization only (counts, status, errors).",
      parameters: { type: "object", properties: {} },
    },
  },
];
