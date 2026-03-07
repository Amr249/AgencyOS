import type { Metadata } from "next";
import { getExpenses, getExpensesSummary, type ExpenseCategory } from "@/actions/expenses";
import { getTeamMembers } from "@/actions/team-members";
import { ExpensesListView } from "@/components/modules/expenses/expenses-list-view";

export const metadata: Metadata = {
  title: "المصروفات",
  description: "تتبع المصروفات والفئات",
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
  searchParams: Promise<{ category?: string; dateFrom?: string; dateTo?: string }>;
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category =
    params.category && categoryValues.includes(params.category as ExpenseCategory)
      ? (params.category as ExpenseCategory)
      : undefined;
  const filters = {
    category,
    dateFrom: params.dateFrom?.trim() || undefined,
    dateTo: params.dateTo?.trim() || undefined,
  };

  const [expensesResult, summary, teamMembersResult] = await Promise.all([
    getExpenses(filters),
    getExpensesSummary(),
    getTeamMembers(),
  ]);
  const expenses = expensesResult.ok ? expensesResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];

  return (
    <ExpensesListView
      initialExpenses={expenses}
      summary={summary}
      teamMembers={teamMembers}
    />
  );
}
