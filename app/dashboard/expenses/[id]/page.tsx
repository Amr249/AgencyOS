import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpenseById } from "@/actions/expenses";
import { getFiles } from "@/actions/files";
import { getTeamMembers } from "@/actions/team-members";
import { getProjects } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { SarMoney } from "@/components/ui/sar-money";
import { ExpenseCategoryBadge } from "@/components/modules/expenses/expense-category-badge";
import { ExpenseDetailHeader } from "@/components/modules/expenses/expense-detail-header";
import { ExpenseAttachments } from "@/components/modules/expenses/expense-attachments";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getExpenseById(id);
  if (!result.ok) return { title: "Expense | AgencyOS" };
  return {
    title: `${result.data.title} | AgencyOS`,
    description: `Expense: ${result.data.title}`,
  };
}

export default async function ExpenseDetailPage({ params }: Props) {
  const { id } = await params;

  const [expenseResult, filesResult, teamMembersResult, projectsResult, clientsResult] = await Promise.all([
    getExpenseById(id),
    getFiles({ expenseId: id }),
    getTeamMembers(),
    getProjects({}),
    getClientsList(),
  ]);

  if (!expenseResult.ok) {
    if (expenseResult.error === "Expense not found" || expenseResult.error === "Invalid expense id") {
      notFound();
    }
    return (
      <div dir="ltr">
        <p className="text-destructive">{expenseResult.error}</p>
      </div>
    );
  }

  const expense = expenseResult.data;
  const attachmentFiles = filesResult.ok ? filesResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];
  const projects = projectsResult.ok
    ? projectsResult.data.map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        coverImageUrl: p.coverImageUrl,
        clientLogoUrl: p.clientLogoUrl,
      }))
    : [];
  const clients = clientsResult.ok
    ? clientsResult.data.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        logoUrl: c.logoUrl,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Breadcrumb dir="ltr">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/expenses">Expenses</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[min(60vw,28rem)] truncate">{expense.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ExpenseDetailHeader
        expense={expense}
        teamMembers={teamMembers}
        projects={projects}
        clients={clients}
      />

      <div dir="ltr" className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="grid gap-6 text-left sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Amount</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              <SarMoney value={expense.amount} iconClassName="h-4 w-4" />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Category</p>
            <div className="mt-2">
              <ExpenseCategoryBadge category={expense.category} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Date</p>
            <p className="mt-1 text-sm">{formatDate(expense.date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Billable</p>
            <p className="mt-1">
              {expense.isBillable ? (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Yes
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">No</span>
              )}
            </p>
          </div>
          {expense.teamMemberName ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">Team member</p>
              <p className="mt-1 text-sm">{expense.teamMemberName}</p>
            </div>
          ) : null}
          {expense.projectId && expense.projectName ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">Project</p>
              <p className="mt-1">
                <Link href={`/dashboard/projects/${expense.projectId}`} className="text-primary text-sm font-medium hover:underline">
                  {expense.projectName}
                </Link>
              </p>
            </div>
          ) : null}
          {expense.clientId && expense.clientName ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">Client</p>
              <p className="mt-1">
                <Link href={`/dashboard/clients/${expense.clientId}`} className="text-primary text-sm font-medium hover:underline">
                  {expense.clientName}
                </Link>
              </p>
            </div>
          ) : null}
        </div>

        {expense.notes ? (
          <div className="mt-6 border-t pt-6">
            <p className="text-muted-foreground text-xs font-medium uppercase">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{expense.notes}</p>
          </div>
        ) : null}

        {expense.receiptUrl ? (
          <div className="mt-6 border-t pt-6">
            <p className="text-muted-foreground text-xs font-medium uppercase">Receipt link</p>
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Open receipt URL
            </a>
          </div>
        ) : null}
      </div>

      <ExpenseAttachments expenseId={expense.id} initialFiles={attachmentFiles} />
    </div>
  );
}
