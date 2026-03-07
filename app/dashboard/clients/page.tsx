import { Metadata } from "next";
import Link from "next/link";
import { getClientsList, getArchivedClientsList } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import ClientsDataTable from "./data-table";
import { ClientFormSheet } from "@/components/modules/clients/client-form-sheet";
import { ClientsPageFAB } from "@/components/modules/clients/clients-page-fab";

export const metadata: Metadata = {
  title: "العملاء",
  description: "Manage your agency clients",
};

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const { view } = await searchParams;
  const showArchived = view === "archived";

  const result = showArchived
    ? await getArchivedClientsList()
    : await getClientsList();

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">العملاء</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{result.error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clients = result.data;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">العملاء</h1>
        <ClientFormSheet
          trigger={
            <Button variant="secondary" className="w-full sm:w-auto hidden sm:inline-flex">
              <PlusCircledIcon className="me-2 h-4 w-4" />
              عميل جديد
            </Button>
          }
          asChild
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={showArchived ? "ghost" : "secondary"} asChild>
          <Link href="/dashboard/clients">نشط</Link>
        </Button>
        <Button variant={showArchived ? "secondary" : "ghost"} asChild>
          <Link href="/dashboard/clients?view=archived">مؤرشف</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ClientsDataTable data={clients} showArchived={showArchived} />
        </CardContent>
      </Card>
      <ClientsPageFAB />
    </>
  );
}
