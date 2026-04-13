import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectById, getProjectBudgetSummary } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { getTasksByProjectId } from "@/actions/tasks";
import { getInvoicesByProjectId } from "@/actions/invoices";
import { getFiles } from "@/actions/files";
import { getProjectMembers, getTeamMembers } from "@/actions/team-members";
import { getExpensesByProjectId, getProjectCostSummary } from "@/actions/expenses";
import { getProjectTimeSummary } from "@/actions/time-tracking";
import { getMilestonesByProjectId } from "@/actions/milestones";
import { getProjectActivity } from "@/actions/activity-log";
import { getProjectHealth } from "@/actions/project-health";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PROJECT_STATUS_LABELS_EN, PROJECT_STATUS_PILL_CLASS } from "@/types";
import { ProjectCoverBanner } from "@/components/modules/projects/project-cover-banner";
import { ProjectOverviewTab } from "@/components/modules/projects/project-overview-tab";
import { ProjectTasksTab } from "@/components/modules/projects/project-tasks-tab";
import { ProjectInvoicesTab } from "@/components/modules/projects/project-invoices-tab";
import { ProjectNotesTab } from "@/components/modules/projects/project-notes-tab";
import { ProjectTeamTab } from "@/components/modules/projects/project-team-tab";
import { ProjectMilestonesTab } from "@/components/modules/projects/project-milestones-tab";
import {
  ProjectActivityFeed,
  type ActivityFeedEntry,
} from "@/components/modules/projects/project-activity-feed";
import { ProjectExpensesTab } from "@/components/modules/projects/project-expenses-tab";
import { FileManager } from "@/components/modules/files/file-manager";
import { SaveProjectTemplateDialog } from "@/components/modules/projects/save-project-template-dialog";
import { ProjectHealthBadge } from "@/components/modules/projects/project-health-badge";
import { BudgetAlert } from "@/components/modules/projects/budget-alert";
import { budgetAlertStateFromHealth } from "@/lib/budget-alert";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function toActivityFeedEntries(
  rows: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorName: string | null;
    actorId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }[]
): ActivityFeedEntry[] {
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    actorName: r.actorName,
    actorId: r.actorId,
    metadata: r.metadata ?? null,
    createdAt: r.createdAt,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProjectById(id);
  if (!result.ok) return { title: "Project | AgencyOS" };
  return {
    title: `${result.data.name} | AgencyOS`,
    description: `Project: ${result.data.name}`,
  };
}

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const defaultTab = tabParam === "activity" ? "activity" : "overview";
  const [projectResult, clientsResult, settingsResult] = await Promise.all([
    getProjectById(id),
    getClientsList(),
    getSettings(),
  ]);

  if (!projectResult.ok) {
    if (projectResult.error === "Project not found" || projectResult.error === "Invalid project id") {
      notFound();
    }
    return (
      <div>
        <p className="text-destructive">{projectResult.error}</p>
      </div>
    );
  }

  const project = projectResult.data;
  const clients = clientsResult.ok ? clientsResult.data : [];
  const defaultCurrency =
    settingsResult.ok && settingsResult.data?.defaultCurrency
      ? settingsResult.data.defaultCurrency
      : "USD";

  const [
    tasksResult,
    invoicesResult,
    filesResult,
    projectMembersResult,
    teamMembersResult,
    expensesResult,
    costSummaryResult,
    timeSummaryResult,
    milestonesResult,
    activityResult,
    budgetSummaryResult,
    healthResult,
  ] = await Promise.all([
    getTasksByProjectId(id),
    getInvoicesByProjectId(id),
    getFiles({ projectId: id }),
    getProjectMembers(id),
    getTeamMembers(),
    getExpensesByProjectId(id),
    getProjectCostSummary(id),
    getProjectTimeSummary(id),
    getMilestonesByProjectId(id),
    getProjectActivity(id, 21),
    getProjectBudgetSummary(id),
    getProjectHealth(id),
  ]);
  const tasks = tasksResult.ok ? tasksResult.data : [];
  const invoices = invoicesResult.ok ? invoicesResult.data : [];
  const initialFiles = filesResult.ok ? filesResult.data : [];
  const projectMembers = projectMembersResult.ok ? projectMembersResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];
  const projectExpenses = expensesResult.ok ? expensesResult.data : [];
  const costSummary = costSummaryResult.ok ? costSummaryResult.data : null;
  const timeSummary = timeSummaryResult.ok ? timeSummaryResult.data : null;
  const milestones = milestonesResult.ok ? milestonesResult.data : [];
  const activityRaw = activityResult.ok ? activityResult.data : [];
  const projectHealth = healthResult.ok ? healthResult.data : null;
  const activityMapped = toActivityFeedEntries(activityRaw);
  const activityForTab = activityMapped.slice(0, 20);
  const activityForOverview = activityMapped.slice(0, 5);
  const activityTabHasMore = activityMapped.length > 20;
  const activityOverviewHasMore = activityMapped.length > 5;
  const budgetSummary =
    budgetSummaryResult.ok && budgetSummaryResult.data ? budgetSummaryResult.data : null;

  const statusLabel = PROJECT_STATUS_LABELS_EN[project.status] ?? project.status;
  const budgetAlertState = projectHealth ? budgetAlertStateFromHealth(projectHealth) : null;

  return (
    <div className="flex flex-col gap-4" dir="ltr" lang="en">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ProjectCoverBanner projectId={id} coverImageUrl={project.coverImageUrl ?? null} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          <Avatar className="size-12 shrink-0 ring-2 ring-border">
            <AvatarImage src={project.clientLogoUrl ?? undefined} alt={project.clientName ?? undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {(project.clientName ?? "?").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  PROJECT_STATUS_PILL_CLASS[project.status] ?? "bg-neutral-100 text-neutral-600"
                )}
              >
                {statusLabel}
              </span>
              {projectHealth ? <ProjectHealthBadge health={projectHealth} /> : null}
              <Link
                href={`/dashboard/clients/${project.clientId}`}
                className="text-muted-foreground text-sm hover:underline"
              >
                {project.clientName ?? "—"}
              </Link>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <SaveProjectTemplateDialog projectId={id} defaultName={`${project.name} template`} />
          <Button variant="outline" asChild>
            <Link href="/dashboard/projects">Back to list</Link>
          </Button>
        </div>
      </div>

      <BudgetAlert projectId={id} state={budgetAlertState} currency={defaultCurrency} />

      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full" dir="ltr">
        <TabsList className="flex w-full overflow-x-auto p-1 gap-1 flex-nowrap whitespace-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <div className="mt-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/projects/${id}/gantt`}>Gantt</Link>
          </Button>
        </div>
        <TabsContent value="overview" className="mt-4">
          <ProjectOverviewTab
            project={{
              ...project,
              phases: project.phases ?? [],
            }}
            clients={clients.map((c) => ({
              id: c.id,
              companyName: c.companyName,
              logoUrl: c.logoUrl,
            }))}
            defaultCurrency={defaultCurrency}
            timeSummary={timeSummary}
            teamMembers={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
              avatarUrl: m.avatarUrl ?? null,
            }))}
            activityOverviewEntries={activityForOverview}
            activityOverviewHasMore={activityOverviewHasMore}
            budgetSummary={budgetSummary}
          />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <ProjectTasksTab
            projectId={id}
            milestones={milestones.map((m) => ({ id: m.id, name: m.name }))}
            initialTasks={tasks.map((t) => ({
              id: t.id,
              projectId: t.projectId,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate,
              milestoneId: t.milestoneId ?? null,
            }))}
          />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <ProjectTeamTab
            projectId={id}
            initialMembers={projectMembers}
            allTeamMembers={teamMembers}
          />
        </TabsContent>
        <TabsContent value="milestones" className="mt-4">
          <ProjectMilestonesTab
            projectId={id}
            initialMilestones={milestones.map((m) => ({
              id: m.id,
              projectId: m.projectId,
              name: m.name,
              description: m.description,
              startDate:
                typeof m.startDate === "string" ? m.startDate.slice(0, 10) : String(m.startDate).slice(0, 10),
              dueDate:
                typeof m.dueDate === "string" ? m.dueDate.slice(0, 10) : String(m.dueDate).slice(0, 10),
              status: m.status,
              taskProgress: m.taskProgress,
              assignees: m.assignees,
            }))}
            projectTeamMembers={projectMembers.map((pm) => ({
              teamMemberId: pm.teamMemberId,
              memberName: pm.memberName,
              memberAvatarUrl: pm.memberAvatarUrl ?? null,
            }))}
          />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ProjectExpensesTab
            projectId={id}
            projectName={project.name}
            projectCoverImageUrl={project.coverImageUrl}
            clientId={project.clientId}
            clientCompanyName={project.clientName ?? ""}
            clientLogoUrl={project.clientLogoUrl}
            expenses={projectExpenses}
            costSummary={costSummary}
            teamMembers={teamMembers}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <ProjectInvoicesTab
            projectId={id}
            invoices={invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              total: inv.total,
              status: inv.status,
              currency: inv.currency,
            }))}
            defaultCurrency={defaultCurrency}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <div className="rounded-lg border bg-card p-6">
            <FileManager projectId={id} initialFiles={initialFiles} />
          </div>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <ProjectNotesTab projectId={id} initialNotes={project.notes} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ProjectActivityFeed
            projectId={id}
            variant="full"
            entries={activityForTab}
            trailingHasMore={activityTabHasMore}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
