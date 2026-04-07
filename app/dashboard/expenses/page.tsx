import type { Metadata } from "next";
import { z } from "zod";
import { getExpenses, getExpensesSummary, type ExpenseCategory } from "@/actions/expenses";
import { getTeamMembers } from "@/actions/team-members";
import { getProjects } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { ExpensesListView } from "@/components/modules/expenses/expenses-list-view";

export const metadata: Metadata = {
  title: "Expenses",
  description: "Track expenses and categories",
};

const categoryValues: ExpenseCategory[] = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
];

type PageProps = {
  searchParams: Promise<{
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
    clientId?: string;
  }>;
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category =
    params.category && categoryValues.includes(params.category as ExpenseCategory)
      ? (params.category as ExpenseCategory)
      : undefined;
  const projectIdParsed = z.string().uuid().safeParse(params.projectId?.trim());
  const clientIdParsed = z.string().uuid().safeParse(params.clientId?.trim());
  const filters = {
    category,
    dateFrom: params.dateFrom?.trim() || undefined,
    dateTo: params.dateTo?.trim() || undefined,
    projectId: projectIdParsed.success ? projectIdParsed.data : undefined,
    clientId: clientIdParsed.success ? clientIdParsed.data : undefined,
  };

  const [expensesResult, summary, teamMembersResult, projectsResult, clientsResult] = await Promise.all([
    getExpenses(filters),
    getExpensesSummary(),
    getTeamMembers(),
    getProjects({}),
    getClientsList(),
  ]);
  const expenses = expensesResult.ok ? expensesResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];
  const projects = projectsResult.ok
    ? projectsResult.data.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))
    : [];
  const clients = clientsResult.ok
    ? clientsResult.data.map((c) => ({ id: c.id, companyName: c.companyName }))
    : [];

  return (
    <ExpensesListView
      initialExpenses={expenses}
      summary={summary}
      teamMembers={teamMembers}
      projects={projects}
      clients={clients}
    />
  );
}
