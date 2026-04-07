"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Pause, Trash2, Edit, RefreshCw } from "lucide-react";
import { formatAmount, formatDate } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { ExpenseCategoryBadge } from "@/components/modules/expenses/expense-category-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteRecurringExpense,
  toggleRecurringExpenseActive,
  processRecurringExpenses,
} from "@/actions/recurring-expenses";
import {
  NewRecurringExpenseDialog,
  type RecurringExpenseFormShape,
} from "./new-recurring-expense-dialog";
import { RECURRENCE_FREQUENCY_LABELS } from "@/types";
import type { ExpenseCategory } from "@/actions/expenses";

export type RecurringExpenseRow = {
  id: string;
  title: string;
  amount: string;
  category: string;
  frequency: string;
  nextDueDate: string;
  notes?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  isBillable: boolean;
  isActive: boolean;
  vendorLogoUrl?: string | null;
};

export type DueRecurringRow = {
  id: string;
  title: string;
  amount: string;
  category: string;
  frequency: string;
  nextDueDate: string;
};

interface RecurringExpensesViewProps {
  recurringExpenses: RecurringExpenseRow[];
  dueExpenses: DueRecurringRow[];
  projects: { id: string; name: string; clientId: string }[];
  clients: { id: string; companyName: string | null }[];
  teamMembers: { id: string; name: string }[];
}

function vendorInitial(title: string): string {
  const t = title.trim();
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

function toFormShape(row: RecurringExpenseRow): RecurringExpenseFormShape {
  return {
    id: row.id,
    title: row.title,
    amount: String(row.amount),
    category: row.category,
    frequency: row.frequency,
    nextDueDate: row.nextDueDate,
    notes: row.notes,
    projectId: row.projectId,
    clientId: row.clientId,
    teamMemberId: row.teamMemberId,
    isBillable: row.isBillable,
    isActive: row.isActive,
    vendorLogoUrl: row.vendorLogoUrl ?? null,
  };
}

export function RecurringExpensesView({
  recurringExpenses,
  dueExpenses,
  projects,
  clients,
  teamMembers,
}: RecurringExpensesViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpenseFormShape | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingExpense(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const result = await deleteRecurringExpense(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    if (result.ok) {
      toast.success("Recurring expense deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete recurring expense");
    }
  };

  const handleToggleActive = async (id: string) => {
    const result = await toggleRecurringExpenseActive(id);
    if (result.ok) {
      toast.success(result.data?.isActive ? "Activated" : "Paused");
      router.refresh();
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleProcessDue = async () => {
    setIsProcessing(true);
    const result = await processRecurringExpenses();
    setIsProcessing(false);

    if (result.ok) {
      toast.success(`Processed ${result.data?.processed ?? 0} recurring expenses`);
      router.refresh();
    } else {
      toast.error("Failed to process recurring expenses");
    }
  };

  const handleEdit = (expense: RecurringExpenseRow) => {
    setEditingExpense(toFormShape(expense));
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recurring Expenses</h1>
          <p className="text-muted-foreground">
            Manage templates for recurring expenses like subscriptions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/expenses">← Back to Expenses</Link>
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      {dueExpenses.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 dark:text-amber-200">
              {dueExpenses.length} expense{dueExpenses.length > 1 ? "s" : ""} due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
              The following recurring expenses are due and can be processed:
            </p>
            <ul className="mb-4 space-y-1 text-sm text-amber-800 dark:text-amber-200">
              {dueExpenses.map((exp) => (
                <li key={exp.id}>
                  • {exp.title} — {formatAmount(String(exp.amount))} SAR
                </li>
              ))}
            </ul>
            <Button
              onClick={() => void handleProcessDue()}
              disabled={isProcessing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isProcessing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Process Due Expenses
            </Button>
          </CardContent>
        </Card>
      )}

      {recurringExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No recurring expenses yet.</p>
            <Button onClick={openNew} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create First Template
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
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringExpenses.map((expense) => (
                  <TableRow key={expense.id} className={!expense.isActive ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        {expense.category === "software" ? (
                          <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                            <AvatarImage src={expense.vendorLogoUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">{vendorInitial(expense.title)}</AvatarFallback>
                          </Avatar>
                        ) : null}
                        <div className="min-w-0">
                        <div className="font-medium">{expense.title}</div>
                        {expense.projectName ? (
                          <div className="text-muted-foreground text-sm">Project: {expense.projectName}</div>
                        ) : null}
                        {expense.clientName ? (
                          <div className="text-muted-foreground text-sm">Client: {expense.clientName}</div>
                        ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ExpenseCategoryBadge category={expense.category as ExpenseCategory} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
                        {formatAmount(String(expense.amount))}
                        <SarCurrencyIcon className="h-4 w-4 text-neutral-500" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {RECURRENCE_FREQUENCY_LABELS[expense.frequency] ?? expense.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(expense.nextDueDate)}</TableCell>
                    <TableCell>
                      {expense.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => void handleToggleActive(expense.id)}
                          title={expense.isActive ? "Pause" : "Activate"}
                        >
                          {expense.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => handleEdit(expense)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteId(expense.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NewRecurringExpenseDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingExpense(null);
        }}
        expense={editingExpense}
        projects={projects}
        clients={clients}
        teamMembers={teamMembers}
        onSuccess={handleSuccess}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recurring expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. Past expenses created from it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel type="button" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
