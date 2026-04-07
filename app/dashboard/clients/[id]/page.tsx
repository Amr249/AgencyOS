import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getClientById, getClientServiceIds } from "@/actions/clients";
import { getProjectsByClientId, getProjectTaskCounts } from "@/actions/projects";
import { getInvoicesByClientId, getNextInvoiceNumber } from "@/actions/invoices";
import { getSettings } from "@/actions/settings";
import { getFiles } from "@/actions/files";
import { getTeamMembers } from "@/actions/team-members";
import { getExpensesByClientId, getClientCostSummary } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_BADGE_CLASS } from "@/types";
import { EditClientButton } from "@/components/modules/clients/edit-client-button";
import { ClientOverview } from "@/components/modules/clients/client-overview";
import { ClientProjectsTab } from "@/components/modules/clients/client-projects-tab";
import { ClientInvoicesTab } from "@/components/modules/clients/client-invoices-tab";
import { ClientExpensesTab } from "@/components/modules/clients/client-expenses-tab";
import { FileManager } from "@/components/modules/files/file-manager";
import { getServices } from "@/actions/services";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getClientById(id);
  if (!result.ok) return { title: "Client | AgencyOS" };
  return {
    title: `${result.data.companyName} | AgencyOS`,
    description: `Client profile for ${result.data.companyName}`,
  };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("clients");
  const isArabic = locale === "ar";
  const [
    clientResult,
    projectsResult,
    invoicesResult,
    settingsResult,
    nextNumResult,
    filesResult,
    teamMembersResult,
    servicesResult,
    clientServicesResult,
    clientExpensesResult,
    clientCostSummaryResult,
  ] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
    getInvoicesByClientId(id),
    getSettings(),
    getNextInvoiceNumber(),
    getFiles({ clientId: id }),
    getTeamMembers(),
    getServices(),
    getClientServiceIds(id),
    getExpensesByClientId(id),
    getClientCostSummary(id),
  ]);

  if (!clientResult.ok) {
    if (clientResult.error === "Client not found" || clientResult.error === "Invalid client id") {
      notFound();
    }
    return (
      <div>
        <p className="text-destructive">{clientResult.error}</p>
      </div>
    );
  }

  const client = clientResult.data;
  const statusLabelByKey: Record<string, string> = {
    lead: t("statusLeadFull"),
    active: t("statusActive"),
    on_hold: t("statusOnHold"),
    completed: t("statusCompleted"),
    closed: t("statusClosed"),
  };
  const statusLabel =
    statusLabelByKey[client.status] ??
    CLIENT_STATUS_LABELS[client.status] ??
    client.status;
  const projects = projectsResult.ok ? projectsResult.data : [];
  const projectIds = projects.map((p) => p.id);
  const taskCountsResult = projectIds.length > 0 ? await getProjectTaskCounts(projectIds) : { ok: true as const, data: {} as Record<string, { total: number; done: number }> };
  const taskCounts = taskCountsResult.ok ? taskCountsResult.data : {};
  const invoices = invoicesResult.ok ? invoicesResult.data : [];
  const settings = settingsResult.ok ? settingsResult.data : null;
  const nextInvoiceNumber = nextNumResult.ok
    ? nextNumResult.data
    : isArabic
      ? "فاتورة-001"
      : "INV-001";

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  for (const inv of invoices) {
    const t = Number(inv.total);
    totalInvoiced += t;
    if (inv.status === "paid") totalPaid += t;
    else totalOutstanding += t;
  }

  const clientsForDialog = [{ id: client.id, companyName: client.companyName }];
  const defaultCurrency = settings?.defaultCurrency ?? "SAR";
  const initialFiles = filesResult.ok ? filesResult.data : [];
  const teamMembers = teamMembersResult.ok ? teamMembersResult.data : [];
  const serviceOptions = servicesResult.ok ? servicesResult.data : [];
  const initialServiceIds = clientServicesResult.ok ? clientServicesResult.data : [];
  const clientExpenses = clientExpensesResult.ok ? clientExpensesResult.data : [];
  const clientCostSummary = clientCostSummaryResult.ok ? clientCostSummaryResult.data : null;
  const expenseDialogProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientId: p.clientId,
  }));

  return (
    <div className="flex flex-col gap-4" dir={isArabic ? "rtl" : "ltr"}>
      <Breadcrumb>
        <BreadcrumbList
          className={`flex justify-end ${isArabic ? "flex-row-reverse" : "flex-row"}`}
        >
          <BreadcrumbItem>
            <BreadcrumbPage>{client.companyName}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronLeft className="text-muted-foreground size-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/clients">{t("title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div
        className={`flex flex-col gap-4 sm:items-center sm:justify-between ${
          isArabic ? "sm:flex-row-reverse" : "sm:flex-row"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <EditClientButton
            client={client}
            serviceOptions={serviceOptions}
            initialServiceIds={initialServiceIds}
          />
          <Button variant="outline" asChild>
            <Link href="/dashboard/clients">{t("backToList")}</Link>
          </Button>
        </div>
        <div
          className={`flex flex-col gap-4 sm:items-center sm:gap-4 ${
            isArabic ? "sm:flex-row-reverse" : "sm:flex-row"
          }`}
        >
          <div className={isArabic ? "text-right" : "text-left"}>
            <h1 className="text-2xl font-bold tracking-tight">{client.companyName}</h1>
            <Badge
              variant="outline"
              className={CLIENT_STATUS_BADGE_CLASS[client.status] ?? undefined}
            >
              {statusLabel}
            </Badge>
          </div>
          <Avatar
            className={`size-20 shrink-0 ring-2 ring-border sm:self-center ${
              isArabic ? "self-end" : "self-start"
            }`}
          >
            {client.logoUrl ? (
              <AvatarImage src={client.logoUrl} alt={client.companyName} />
            ) : null}
            <AvatarFallback className="bg-muted text-muted-foreground text-2xl font-medium">
              {client.companyName
                ? client.companyName.charAt(0).toUpperCase()
                : "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList
          className="flex w-full flex-nowrap gap-1 overflow-x-auto p-1 whitespace-nowrap md:grid md:grid-cols-2 lg:grid-cols-4"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="notes">{t("tabNotes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <ClientOverview client={client} />
          <ClientProjectsTab
            clientId={id}
            clientName={client.companyName}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              endDate: p.endDate,
              budget: p.budget,
            }))}
            taskCounts={taskCounts}
            clients={clientsForDialog}
            teamMembers={teamMembers}
            defaultCurrency={defaultCurrency}
          />
          <ClientInvoicesTab
            clientId={id}
            clientName={client.companyName}
            invoices={invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              projectId: inv.projectId,
              projectName: inv.projectName,
              total: inv.total,
              status: inv.status,
              issueDate: inv.issueDate,
            }))}
            totalInvoiced={totalInvoiced}
            totalPaid={totalPaid}
            totalOutstanding={totalOutstanding}
            clients={clientsForDialog}
            settings={settings ? { invoicePrefix: settings.invoicePrefix, invoiceNextNumber: settings.invoiceNextNumber, defaultCurrency: settings.defaultCurrency, defaultPaymentTerms: settings.defaultPaymentTerms, invoiceFooter: settings.invoiceFooter } : null}
            nextInvoiceNumber={nextInvoiceNumber}
          />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ClientExpensesTab
            clientId={id}
            expenses={clientExpenses}
            costSummary={clientCostSummary}
            teamMembers={teamMembers}
            projects={expenseDialogProjects}
            clients={clientsForDialog}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <FileManager clientId={client.id} initialFiles={initialFiles} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {client.notes ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
              ) : (
                <p className="text-muted-foreground text-sm">{t("notesEmpty")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
