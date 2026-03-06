import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectById } from "@/actions/projects";
import { getClientsList } from "@/actions/clients";
import { getSettings } from "@/actions/settings";
import { getTasksByProjectId } from "@/actions/tasks";
import { getInvoicesByProjectId } from "@/actions/invoices";
import { getFiles } from "@/actions/files";
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
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { ProjectCoverBanner } from "@/components/modules/projects/project-cover-banner";
import { ProjectOverviewTab } from "@/components/modules/projects/project-overview-tab";
import { ProjectTasksTab } from "@/components/modules/projects/project-tasks-tab";
import { ProjectInvoicesTab } from "@/components/modules/projects/project-invoices-tab";
import { ProjectNotesTab } from "@/components/modules/projects/project-notes-tab";
import { FileManager } from "@/components/modules/files/file-manager";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProjectById(id);
  if (!result.ok) return { title: "Project | AgencyOS" };
  return {
    title: `${result.data.name} | AgencyOS`,
    description: `Project: ${result.data.name}`,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
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

  const [tasksResult, invoicesResult, filesResult] = await Promise.all([
    getTasksByProjectId(id),
    getInvoicesByProjectId(id),
    getFiles({ projectId: id }),
  ]);
  const tasks = tasksResult.ok ? tasksResult.data : [];
  const invoices = invoicesResult.ok ? invoicesResult.data : [];
  const initialFiles = filesResult.ok ? filesResult.data : [];

  const statusLabel = PROJECT_STATUS_LABELS[project.status] ?? project.status;

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/projects">المشاريع</Link>
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
        <div className="flex items-center gap-4">
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-2 justify-end">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                  PROJECT_STATUS_BADGE_CLASS[project.status] ?? "bg-muted"
                )}
              >
                {statusLabel}
              </span>
              <Link
                href={`/dashboard/clients/${project.clientId}`}
                className="text-muted-foreground text-sm hover:underline"
              >
                {project.clientName ?? "—"}
              </Link>
            </div>
          </div>
          <Avatar className="size-12 shrink-0 ring-2 ring-border">
            <AvatarImage src={project.clientLogoUrl ?? undefined} alt={project.clientName ?? undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {(project.clientName ?? "?").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/projects">العودة للقائمة</Link>
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full" dir="rtl">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="tasks">المهام</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير</TabsTrigger>
          <TabsTrigger value="files">الملفات</TabsTrigger>
          <TabsTrigger value="notes">ملاحظات</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <ProjectOverviewTab
            project={{
              ...project,
              phases: project.phases ?? [],
            }}
            clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))}
            defaultCurrency={defaultCurrency}
          />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <ProjectTasksTab
            projectId={id}
            initialTasks={tasks.map((t) => ({
              id: t.id,
              projectId: t.projectId,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate,
            }))}
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
      </Tabs>
    </div>
  );
}
