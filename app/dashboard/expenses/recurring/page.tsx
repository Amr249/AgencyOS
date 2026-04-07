import type { Metadata } from "next";
import { getRecurringExpenses, getDueRecurringExpenses } from "@/actions/recurring-expenses";
import { getProjects } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { getTeamMembers } from "@/actions/team";
import { RecurringExpensesView } from "@/components/modules/expenses/recurring-expenses-view";

export const metadata: Metadata = {
  title: "Recurring Expenses",
  description: "Manage recurring expense templates",
};

export default async function RecurringExpensesPage() {
  const [recurringResult, dueResult, projectsResult, clientsResult, teamResult] = await Promise.all([
    getRecurringExpenses(),
    getDueRecurringExpenses(),
    getProjects({}),
    getClientsList(),
    getTeamMembers(),
  ]);

  const recurringExpenses = recurringResult.ok ? recurringResult.data : [];
  const dueExpenses = dueResult.ok ? dueResult.data : [];
  const projects = projectsResult.ok ? projectsResult.data : [];
  const clients = clientsResult.ok ? clientsResult.data : [];
  const teamMembers = teamResult.ok ? teamResult.data : [];

  return (
    <div className="p-6" dir="ltr">
      <RecurringExpensesView
        recurringExpenses={recurringExpenses}
        dueExpenses={dueExpenses}
        projects={projects}
        clients={clients}
        teamMembers={teamMembers}
      />
    </div>
  );
}
