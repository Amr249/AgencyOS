"use server";

import { getClientsList, getClientById } from "@/actions/clients";
import { getProjects, getProjectById, getProjectsByClientId, getProjectTaskCounts } from "@/actions/projects";
import { getInvoices, getInvoiceStatsWithPayments, getInvoicesByClientId } from "@/actions/invoices";
import { getExpenses, getExpensesSummary } from "@/actions/expenses";
import { getTasks, getTasksByProjectId, getTasksSnapshotForAiChat, type AiTaskAssigneeSnapshot } from "@/actions/tasks";
import { getTeamMembers } from "@/actions/team";
import { getDashboardData, type DashboardData } from "@/actions/dashboard";
import { getProposals, getProposalStats } from "@/actions/proposals";
import { getOrganizationIdForAiDataAccess } from "@/lib/ai-chat/ai-chat-org";
import { shouldSkipRetrieval } from "@/lib/ai-chat/intent-skip";

const CONTEXT_MAX_CHARS = 56000;

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function fmtNum(n: number | string | null | undefined): string {
  const x = typeof n === "string" ? parseFloat(n) : Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("en-US");
}

function ymd(v: unknown): string {
  if (v == null) return "N/A";
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "N/A" : v.toISOString().slice(0, 10);
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s || "N/A";
}

function truncateContext(s: string): string {
  if (s.length <= CONTEXT_MAX_CHARS) return s;
  return `${s.slice(0, CONTEXT_MAX_CHARS)}\n\n…[context truncated]`;
}

function formatClientsContext(clients: { companyName: string; status: string; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null }[]): string {
  if (!clients.length) return "CLIENTS: No clients found.";

  let ctx = `CLIENTS (${clients.length} total):\n`;
  ctx += clients
    .map(
      (c) =>
        `- ${c.companyName} | Status: ${c.status} | Contact: ${c.contactName || "N/A"} | Phone: ${c.contactPhone || "N/A"} | Email: ${c.contactEmail || "N/A"}`
    )
    .join("\n");
  return ctx;
}

function formatProjectsContext(
  projects: { id: string; name: string; clientName?: string | null; status: string; budget?: string | null; endDate?: string | null }[],
  taskCounts: Record<string, { total: number; done: number }>
): string {
  if (!projects.length) return "PROJECTS: No projects found.";

  let ctx = `PROJECTS (${projects.length} total):\n`;
  ctx += projects
    .map((p) => {
      const tc = taskCounts[p.id] ?? { total: 0, done: 0 };
      const progress = tc.total > 0 ? Math.round((tc.done / tc.total) * 100) : 0;
      const budget = p.budget != null ? `${fmtNum(p.budget)} SAR` : "N/A";
      return `- ${p.name} | Client: ${p.clientName || "N/A"} | Status: ${p.status} | Budget: ${budget} | Deadline: ${ymd(p.endDate)} | Tasks: ${tc.done}/${tc.total} (${progress}%)`;
    })
    .join("\n");
  return ctx;
}

function formatInvoicesContext(
  invoices: {
    invoiceNumber: string;
    clientName?: string | null;
    total: string | number;
    status: string;
    issueDate: string;
    dueDate?: string | null;
    paidAt?: Date | string | null;
  }[],
  stats: { totalInvoiced: number; collected: number; outstanding: number }
): string {
  let ctx = `INVOICE SUMMARY:\n`;
  ctx += `- Total invoiced: ${fmtNum(stats.totalInvoiced)} SAR\n`;
  ctx += `- Collected (paid): ${fmtNum(stats.collected)} SAR\n`;
  ctx += `- Outstanding (pending): ${fmtNum(stats.outstanding)} SAR\n\n`;
  ctx += `INVOICES (${invoices.length} total):\n`;
  ctx += invoices
    .slice(0, 20)
    .map(
      (inv) =>
        `- ${inv.invoiceNumber} | Client: ${inv.clientName || "N/A"} | Amount: ${fmtNum(inv.total)} SAR | Status: ${inv.status} | Issue: ${ymd(inv.issueDate)} | Due: ${ymd(inv.dueDate)}${inv.paidAt ? ` | Paid: ${ymd(inv.paidAt)}` : ""}`
    )
    .join("\n");
  if (invoices.length > 20) ctx += `\n... and ${invoices.length - 20} more invoices`;
  return ctx;
}

function formatExpensesContext(
  expenses: { title: string; category: string; amount: string | number; date: string; teamMemberName?: string | null }[],
  summary: { totalThisMonth: number; totalThisYear: number; topCategory: { category: string; total: number } | null }
): string {
  const top =
    summary.topCategory != null
      ? `${summary.topCategory.category} (${fmtNum(summary.topCategory.total)} SAR)`
      : "N/A";
  let ctx = `EXPENSE SUMMARY:\n`;
  ctx += `- Total this month: ${fmtNum(summary.totalThisMonth)} SAR\n`;
  ctx += `- Total this year: ${fmtNum(summary.totalThisYear)} SAR\n`;
  ctx += `- Top category: ${top}\n\n`;
  ctx += `EXPENSES (${expenses.length} total):\n`;
  ctx += expenses
    .slice(0, 20)
    .map(
      (e) =>
        `- ${e.title} | Category: ${e.category} | Amount: ${fmtNum(e.amount)} SAR | Date: ${ymd(e.date)}${e.teamMemberName ? ` | Team: ${e.teamMemberName}` : ""}`
    )
    .join("\n");
  if (expenses.length > 20) ctx += `\n... and ${expenses.length - 20} more expenses`;
  return ctx;
}

function formatTasksContext(
  tasks: { title: string; projectName?: string; status: string; priority: string; dueDate?: string | null }[]
): string {
  if (!tasks.length) return "TASKS: No tasks found.";

  const byStatus = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    in_review: tasks.filter((t) => t.status === "in_review").length,
    done: tasks.filter((t) => t.status === "done").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  let ctx = `TASKS SUMMARY:\n`;
  ctx += `- Total: ${tasks.length} | Todo: ${byStatus.todo} | In Progress: ${byStatus.in_progress} | In Review: ${byStatus.in_review} | Done: ${byStatus.done} | Blocked: ${byStatus.blocked}\n\n`;
  ctx += `TASKS (showing active, max 20):\n`;
  const activeTasks = tasks.filter((t) => t.status !== "done").slice(0, 20);
  ctx += activeTasks
    .map(
      (t) =>
        `- ${t.title} | Project: ${t.projectName || "N/A"} | Status: ${t.status} | Priority: ${t.priority} | Due: ${ymd(t.dueDate)}`
    )
    .join("\n");
  return ctx;
}

/** Rich task list for AI: includes Assignee(s) from DB (primary + multi-assign). */
function formatTasksWithAssigneesContext(rows: AiTaskAssigneeSnapshot[]): string {
  if (!rows.length) return "TASKS (with assignees): No tasks found.";

  const open = rows.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.daysOverdue != null && t.daysOverdue > 0);

  let ctx = `TASKS WITH ASSIGNEES (root tasks only; snapshot up to ${rows.length} rows).\n`;
  ctx += `Assignee(s) uses the primary assignee on the task plus anyone in task_assignments. "Unassigned" means no one is linked.\n`;
  ctx += `Summary: ${open.length} not done | ${overdue.length} overdue (due date before today, status not done).\n\n`;

  if (overdue.length) {
    ctx += `OVERDUE TASKS (first ${Math.min(45, overdue.length)}):\n`;
    ctx += overdue
      .slice(0, 45)
      .map(
        (t) =>
          `- ${t.title} | Assignee(s): ${t.assigneeNames} | Project: ${t.projectName} | Status: ${t.status} | Priority: ${t.priority} | Due: ${ymd(t.dueDate)} | Days overdue: ${t.daysOverdue}`
      )
      .join("\n");
    ctx += "\n\n";
  }

  const notOverdueOpen = open.filter((t) => !(t.daysOverdue != null && t.daysOverdue > 0)).slice(0, 35);
  if (notOverdueOpen.length) {
    ctx += `OTHER OPEN TASKS (not done, max 35):\n`;
    ctx += notOverdueOpen
      .map(
        (t) =>
          `- ${t.title} | Assignee(s): ${t.assigneeNames} | Project: ${t.projectName} | Status: ${t.status} | Priority: ${t.priority} | Due: ${ymd(t.dueDate)}`
      )
      .join("\n");
  }

  return ctx;
}

function formatTeamContext(
  members: { name: string; role?: string | null; status: string; projectCount?: number; phone?: string | null; email?: string | null }[]
): string {
  if (!members.length) return "TEAM: No team members found.";

  let ctx = `TEAM MEMBERS (${members.length} total):\n`;
  ctx += members
    .map(
      (m) =>
        `- ${m.name} | Role: ${m.role || "N/A"} | Status: ${m.status} | Projects: ${m.projectCount ?? 0} | Phone: ${m.phone || "N/A"} | Email: ${m.email || "N/A"}`
    )
    .join("\n");
  return ctx;
}

function formatDashboardContext(data: DashboardData): string {
  let ctx = `AGENCY OVERVIEW:\n`;
  ctx += `- Revenue this month: ${fmtNum(data.revenueThisMonth)} SAR\n`;
  ctx += `- Revenue last month: ${fmtNum(data.revenueLastMonth)} SAR\n`;
  ctx += `- Outstanding invoices: ${fmtNum(data.outstandingTotal)} SAR (${data.outstandingCount} invoices)\n`;
  ctx += `- Active projects: ${data.activeProjectsCount}\n`;
  ctx += `- Overdue tasks: ${data.overdueTasksCount}\n`;
  ctx += `- YTD profit (collected − expenses, calendar year): ${fmtNum(data.totalProfit)} SAR\n`;

  if (data.overdueTasks?.length) {
    ctx += `\nOVERDUE TASKS:\n`;
    ctx += data.overdueTasks
      .map((t) => `- ${t.title} | Project: ${t.projectName} | Due: ${ymd(t.dueDate)}`)
      .join("\n");
  }

  if (data.recentInvoices?.length) {
    ctx += `\nRECENT INVOICES:\n`;
    ctx += data.recentInvoices
      .map((inv) => `- ${inv.invoiceNumber} | ${inv.clientName ?? "N/A"} | ${fmtNum(inv.total)} SAR | ${inv.status}`)
      .join("\n");
  }

  return ctx;
}

function formatProposalsContext(
  proposals: { title: string; status: string; myBid?: string | null; appliedAt?: Date | string | null }[],
  stats: { total: number; won: number; pending: number; wonPercent: number; totalWonValue: number }
): string {
  let ctx = `PROPOSALS SUMMARY:\n`;
  ctx += `- Total: ${stats.total} | Won: ${stats.won} | Pending: ${stats.pending}\n`;
  ctx += `- Win rate: ${stats.wonPercent}%\n`;
  ctx += `- Total won value: ${fmtNum(stats.totalWonValue)} SAR\n\n`;
  ctx += `PROPOSALS (${proposals.length} total):\n`;
  ctx += proposals
    .slice(0, 15)
    .map((p) => `- ${p.title} | Status: ${p.status} | My bid: ${p.myBid != null ? `${fmtNum(p.myBid)} SAR` : "N/A"} | Applied: ${ymd(p.appliedAt)}`)
    .join("\n");
  return ctx;
}

function formatSpecificClientContext(
  client: {
    companyName: string;
    status: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    website?: string | null;
    notes?: string | null;
  },
  projects: { name: string; status: string; budget?: string | null }[],
  invoices: { invoiceNumber: string; total: string | number; status: string; issueDate: string }[]
): string {
  let ctx = `SPECIFIC CLIENT DETAILS:\n`;
  ctx += `Name: ${client.companyName}\n`;
  ctx += `Status: ${client.status}\n`;
  ctx += `Contact: ${client.contactName || "N/A"}\n`;
  ctx += `Phone: ${client.contactPhone || "N/A"}\n`;
  ctx += `Email: ${client.contactEmail || "N/A"}\n`;
  ctx += `Website: ${client.website || "N/A"}\n`;
  ctx += `Notes: ${client.notes?.trim() ? String(client.notes).slice(0, 2000) : "None"}\n\n`;

  ctx += `PROJECTS FOR ${client.companyName} (${projects.length}):\n`;
  ctx += projects
    .map((p) => `- ${p.name} | Status: ${p.status} | Budget: ${p.budget != null ? `${fmtNum(p.budget)} SAR` : "N/A"}`)
    .join("\n");

  ctx += `\n\nINVOICES FOR ${client.companyName} (${invoices.length}):\n`;
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(String(inv.total || 0)), 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(String(inv.total || 0)), 0);
  ctx += `- Total invoiced: ${totalInvoiced.toLocaleString("en-US")} SAR\n`;
  ctx += `- Total paid: ${totalPaid.toLocaleString("en-US")} SAR\n`;
  ctx += `- Outstanding: ${Math.max(0, totalInvoiced - totalPaid).toLocaleString("en-US")} SAR\n`;
  ctx += invoices.map((inv) => `- ${inv.invoiceNumber} | ${fmtNum(inv.total)} SAR | ${inv.status} | ${ymd(inv.issueDate)}`).join("\n");

  return ctx;
}

function formatSpecificProjectContext(
  project: {
    name: string;
    clientName?: string | null;
    status: string;
    budget?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
    notes?: string | null;
    phases?: { name: string; status: string }[];
  },
  tasks: { title: string; status: string; priority: string; dueDate?: string | null }[]
): string {
  let ctx = `SPECIFIC PROJECT DETAILS:\n`;
  ctx += `Name: ${project.name}\n`;
  ctx += `Client: ${project.clientName || "N/A"}\n`;
  ctx += `Status: ${project.status}\n`;
  ctx += `Budget: ${project.budget != null ? `${fmtNum(project.budget)} SAR` : "N/A"}\n`;
  ctx += `Start: ${ymd(project.startDate)}\n`;
  ctx += `Deadline: ${ymd(project.endDate)}\n`;
  ctx += `Description: ${project.description?.trim() ? String(project.description).slice(0, 1500) : "None"}\n`;
  ctx += `Notes: ${project.notes?.trim() ? String(project.notes).slice(0, 1500) : "None"}\n\n`;

  if (project.phases?.length) {
    ctx += `PHASES:\n`;
    ctx += project.phases.map((ph) => `- ${ph.name} | Status: ${ph.status}`).join("\n");
    ctx += "\n\n";
  }

  ctx += `TASKS (${tasks.length}):\n`;
  ctx += tasks
    .map((t) => `- ${t.title} | Status: ${t.status} | Priority: ${t.priority} | Due: ${ymd(t.dueDate)}`)
    .join("\n");

  return ctx;
}

/**
 * Keyword-driven snapshot of AgencyOS data for the latest user question (admin session).
 */
export async function getContextForQuestion(question: string): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed || shouldSkipRetrieval(trimmed)) return "";

  const orgGate = await getOrganizationIdForAiDataAccess();
  if (!orgGate.ok) return "";

  const lowerQ = trimmed.toLowerCase();
  const contextParts: string[] = [];

  const clientsRes = await getClientsList();
  const clientsList = clientsRes.ok ? clientsRes.data : [];

  for (const client of clientsList) {
    const name = (client.companyName ?? "").trim().toLowerCase();
    if (name.length >= 3 && lowerQ.includes(name)) {
      const fullClient = await getClientById(client.id);
      if (fullClient.ok) {
        const [projectsForClient, invoicesForClient] = await Promise.all([
          getProjectsByClientId(client.id),
          getInvoicesByClientId(client.id),
        ]);
        contextParts.push(
          formatSpecificClientContext(
            fullClient.data,
            projectsForClient.ok ? projectsForClient.data : [],
            invoicesForClient.ok ? invoicesForClient.data : []
          )
        );
      }
      break;
    }
  }

  const projectsRes = await getProjects({});
  const projectsList = projectsRes.ok ? projectsRes.data : [];

  for (const project of projectsList) {
    const pn = (project.name ?? "").trim().toLowerCase();
    if (pn.length >= 3 && lowerQ.includes(pn)) {
      const fullProject = await getProjectById(project.id);
      if (fullProject.ok) {
        const tasksRes = await getTasksByProjectId(project.id);
        contextParts.push(formatSpecificProjectContext(fullProject.data, tasksRes.ok ? tasksRes.data : []));
      }
      break;
    }
  }

  if (
    matchesAny(lowerQ, [
      "client",
      "عميل",
      "عملاء",
      "clients",
      "company",
      "شركة",
      "contact",
      "اتصال",
    ])
  ) {
    contextParts.push(formatClientsContext(clientsList));
  }

  if (
    matchesAny(lowerQ, [
      "project",
      "مشروع",
      "مشاريع",
      "projects",
      "deadline",
      "موعد",
      "budget",
      "ميزانية",
      "phase",
      "مرحلة",
    ])
  ) {
    const ids = projectsList.map((p) => p.id);
    const tcRes = await getProjectTaskCounts(ids);
    const taskCounts = tcRes.ok ? tcRes.data : {};
    contextParts.push(formatProjectsContext(projectsList, taskCounts));
  }

  if (
    matchesAny(lowerQ, [
      "invoice",
      "فاتورة",
      "فواتير",
      "invoices",
      "bill",
      "payment",
      "دفع",
      "paid",
      "مدفوع",
      "outstanding",
      "مستحق",
      "revenue",
      "إيرادات",
      "collected",
      "محصل",
    ])
  ) {
    const [invRes, statsRes] = await Promise.all([getInvoices({}), getInvoiceStatsWithPayments()]);
    const invoices = invRes.ok ? invRes.data : [];
    const stats = statsRes.ok ? statsRes.data : { totalInvoiced: 0, collected: 0, outstanding: 0 };
    contextParts.push(formatInvoicesContext(invoices, stats));
  }

  if (
    matchesAny(lowerQ, [
      "expense",
      "مصروف",
      "مصروفات",
      "expenses",
      "cost",
      "تكلفة",
      "spend",
      "إنفاق",
      "software",
      "hosting",
      "salary",
      "رواتب",
      "profit",
      "ربح",
    ])
  ) {
    const [expRes, summary] = await Promise.all([getExpenses({}), getExpensesSummary()]);
    const expenses = expRes.ok ? expRes.data : [];
    contextParts.push(formatExpensesContext(expenses, summary));
  }

  if (
    matchesAny(lowerQ, [
      "task",
      "مهمة",
      "مهام",
      "tasks",
      "todo",
      "overdue",
      "متأخر",
      "متاخر",
      "blocked",
      "in progress",
      "قيد التنفيذ",
      "done",
      "مكتمل",
      "فريق",
      "مين",
      "من ",
      "خلص",
      "لم ينجز",
      "لم يكمل",
      "assignee",
      "assigned",
      "assignment",
      "مكلف",
      "مكلفون",
      "مسؤول",
      "تعيين",
      "مسند",
    ])
  ) {
    const snap = await getTasksSnapshotForAiChat();
    if (snap.ok) {
      contextParts.push(formatTasksWithAssigneesContext(snap.data));
    } else {
      const tasksRes = await getTasks({});
      contextParts.push(formatTasksContext(tasksRes.ok ? tasksRes.data : []));
      contextParts.push(`NOTE: Assignee snapshot unavailable (${snap.error}).`);
    }
  }

  if (
    matchesAny(lowerQ, [
      "team",
      "فريق",
      "member",
      "عضو",
      "أعضاء",
      "employee",
      "موظف",
      "ahmed",
      "sara",
      "designer",
      "developer",
      "مصمم",
      "مطور",
    ])
  ) {
    const membersRes = await getTeamMembers();
    contextParts.push(formatTeamContext(membersRes.ok ? membersRes.data : []));
  }

  if (
    matchesAny(lowerQ, [
      "report",
      "تقرير",
      "summary",
      "ملخص",
      "overview",
      "نظرة عامة",
      "dashboard",
      "لوحة",
      "this month",
      "هذا الشهر",
      "this year",
      "هذه السنة",
      "how much",
      "كم",
      "total",
      "إجمالي",
    ])
  ) {
    try {
      const dashboard = await getDashboardData();
      contextParts.push(formatDashboardContext(dashboard));
    } catch (e) {
      console.error("getContextForQuestion getDashboardData", e);
      contextParts.push("AGENCY OVERVIEW: (failed to load dashboard data)");
    }
  }

  if (
    matchesAny(lowerQ, [
      "proposal",
      "عرض",
      "عروض",
      "proposals",
      "bid",
      "mostaql",
      "مستقل",
      "won",
      "فوز",
      "applied",
    ])
  ) {
    const [propRes, statsRes] = await Promise.all([getProposals({}), getProposalStats()]);
    const proposals = propRes.ok ? propRes.data : [];
    const stats = statsRes.ok
      ? statsRes.data
      : { total: 0, won: 0, pending: 0, wonPercent: 0, totalWonValue: 0 };
    contextParts.push(formatProposalsContext(proposals, stats));
  }

  if (contextParts.length === 0) {
    try {
      const dashboard = await getDashboardData();
      contextParts.push(formatDashboardContext(dashboard));
    } catch (e) {
      console.error("getContextForQuestion fallback dashboard", e);
      contextParts.push("AGENCY OVERVIEW: (failed to load dashboard data)");
    }
  }

  return truncateContext(contextParts.join("\n\n---\n\n"));
}
