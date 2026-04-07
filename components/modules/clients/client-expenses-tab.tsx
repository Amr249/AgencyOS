"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, User } from "lucide-react";
import type { ExpenseRow } from "@/actions/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { NewExpenseDialog, type ExpenseDialogClient, type ExpenseDialogProject } from "@/components/modules/expenses/new-expense-dialog";
import { ExpenseCategoryBadge } from "@/components/modules/expenses/expense-category-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type TeamMemberOption = { id: string; name: string; role: string | null };

export type ClientCostSummary = {
  totalExpenses: number;
  billableExpenses: number;
  nonBillableExpenses: number;
  expenseCount: number;
};

type ClientExpensesTabProps = {
  clientId: string;
  expenses: ExpenseRow[];
  costSummary: ClientCostSummary | null;
  teamMembers: TeamMemberOption[];
  projects: ExpenseDialogProject[];
  clients: ExpenseDialogClient[];
};

function fmtSar(n: number) {
  return formatAmount(String(n));
}

export function ClientExpensesTab({
  clientId,
  expenses,
  costSummary,
  teamMembers,
  projects,
  clients,
}: ClientExpensesTabProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  const handleSuccess = () => {
    setDialogOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-6" dir="ltr">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold tabular-nums">
              {fmtSar(costSummary?.totalExpenses ?? 0)}
              <SarCurrencyIcon className="h-5 w-5 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Billable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-2xl font-bold tabular-nums text-green-600">
              {fmtSar(costSummary?.billableExpenses ?? 0)}
              <SarCurrencyIcon className="h-5 w-5 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Non-Billable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground flex items-center gap-1 text-2xl font-bold tabular-nums">
              {fmtSar(costSummary?.nonBillableExpenses ?? 0)}
              <SarCurrencyIcon className="h-5 w-5 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Expense Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{costSummary?.expenseCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Client Expenses</h3>
        <Button type="button" onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4 text-center text-sm">No expenses for this client yet.</p>
            <Button type="button" onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Project</TableHead>
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
                      {expense.teamMemberName ? (
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 shrink-0" aria-hidden />
                          {expense.teamMemberName}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {expense.projectId && expense.projectName ? (
                      <Link
                        href={`/dashboard/projects/${expense.projectId}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {expense.projectName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ExpenseCategoryBadge category={expense.category} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {formatAmount(expense.amount)}
                      <SarCurrencyIcon className="h-4 w-4 shrink-0" />
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(expense.date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {expense.isBillable ? (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        Billable
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamMembers={teamMembers}
        projects={clientProjects}
        clients={clients}
        defaultClientId={clientId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
