"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import type { ExpenseRow } from "@/actions/expenses";
import { NewExpenseDialog } from "@/components/modules/expenses/new-expense-dialog";
import { ExpenseCategoryBadge } from "@/components/modules/expenses/expense-category-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/utils";

export type ProjectCostSummary = {
  totalExpenses: number;
  billableExpenses: number;
  nonBillableExpenses: number;
  expenseCount: number;
};

type TeamMemberOption = { id: string; name: string; role: string | null };

type ProjectExpensesTabProps = {
  projectId: string;
  projectName: string;
  clientId: string;
  clientCompanyName: string;
  expenses: ExpenseRow[];
  costSummary: ProjectCostSummary | null;
  teamMembers: TeamMemberOption[];
};

export function ProjectExpensesTab({
  projectId,
  projectName,
  clientId,
  clientCompanyName,
  expenses,
  costSummary,
  teamMembers,
}: ProjectExpensesTabProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleSuccess = () => {
    router.refresh();
  };

  const dialogProjects = React.useMemo(
    () => [{ id: projectId, name: projectName, clientId }],
    [projectId, projectName, clientId]
  );
  const dialogClients = React.useMemo(
    () => [{ id: clientId, companyName: clientCompanyName || "Client" }],
    [clientId, clientCompanyName]
  );

  return (
    <div className="space-y-6" dir="ltr">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold">
              {formatAmount(String(costSummary?.totalExpenses ?? 0))}
              <SarCurrencyIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Billable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold text-green-600">
              {formatAmount(String(costSummary?.billableExpenses ?? 0))}
              <SarCurrencyIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Non-Billable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold text-muted-foreground">
              {formatAmount(String(costSummary?.nonBillableExpenses ?? 0))}
              <SarCurrencyIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expense Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costSummary?.expenseCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Project Expenses</h3>
        <Button type="button" onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="me-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No expenses for this project yet.</p>
            <Button type="button" onClick={() => setDialogOpen(true)} variant="outline">
              <Plus className="me-2 h-4 w-4" />
              Add First Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Billable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/dashboard/expenses/${expense.id}`}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {expense.title}
                        </Link>
                        {expense.teamMemberName && (
                          <div className="text-sm text-muted-foreground">Member: {expense.teamMemberName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ExpenseCategoryBadge category={expense.category} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {formatAmount(expense.amount)}
                        <SarCurrencyIcon className="h-4 w-4" />
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(`${expense.date}T12:00:00`), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      {expense.isBillable ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                          Billable
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamMembers={teamMembers}
        projects={dialogProjects}
        clients={dialogClients}
        defaultProjectId={projectId}
        defaultClientId={clientId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
