"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExpenseRow } from "@/actions/expenses";
import {
  NewExpenseDialog,
  type ExpenseDialogClient,
  type ExpenseDialogProject,
} from "./new-expense-dialog";

type TeamMemberOption = { id: string; name: string; role: string | null };

type ExpenseDetailHeaderProps = {
  expense: ExpenseRow;
  teamMembers: TeamMemberOption[];
  projects: ExpenseDialogProject[];
  clients: ExpenseDialogClient[];
};

export function ExpenseDetailHeader({
  expense,
  teamMembers,
  projects,
  clients,
}: ExpenseDetailHeaderProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <div dir="ltr" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-left">
          <h1 className="text-2xl font-bold tracking-tight">{expense.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Expense · {expense.date}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => setDialogOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
        expense={expense}
        teamMembers={teamMembers}
        projects={projects}
        clients={clients}
      />
    </>
  );
}
