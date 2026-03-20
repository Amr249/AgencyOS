import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getClientsList, getArchivedClientsList, getServiceIdsByClientIds } from "@/actions/clients";
import { getServices } from "@/actions/services";
import ClientsDataTable from "./data-table";
import { ClientFormSheet } from "@/components/modules/clients/client-form-sheet";
import { ClientsPageFAB } from "@/components/modules/clients/clients-page-fab";
import { isDbErrorKey } from "@/lib/i18n-errors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return {
    title: t("title"),
    description: "Manage your agency clients",
  };
}

type PageProps = {
  searchParams: Promise<{ tab?: string; view?: string }>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const { tab, view } = await searchParams;
  const selectedTab = tab ?? (view === "archived" ? "archived" : "all");

  const t = await getTranslations("clients");
  const tErr = await getTranslations("errors");

  const [activeResult, archivedResult, servicesResult] = await Promise.all([
    getClientsList(),
    getArchivedClientsList(),
    getServices(),
  ]);

  if (!activeResult.ok || !archivedResult.ok) {
    const error = !activeResult.ok ? activeResult.error : archivedResult.error;
    const errStr = typeof error === "string" ? error : "";
    const displayError = isDbErrorKey(errStr) ? tErr(errStr) : errStr;
    return (
      <div className="flex flex-col gap-4" dir="auto">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-700">{displayError}</p>
        </div>
      </div>
    );
  }

  const activeClients = activeResult.data;
  const archivedClients = archivedResult.data;
  const serviceOptions = servicesResult.ok ? servicesResult.data : [];
  const clientServiceMapResult = await getServiceIdsByClientIds(
    [...activeClients, ...archivedClients].map((c) => c.id)
  );
  const clientServiceMap = clientServiceMapResult.ok ? clientServiceMapResult.data : {};
  const allClients = [...activeClients, ...archivedClients];

  const activeCount = allClients.filter((c) => c.status === "active").length;
  const completedCount = allClients.filter((c) => c.status === "completed").length;
  const totalCount = allClients.length;

  return (
    <div className="space-y-5" dir="auto">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-neutral-900">{t("title")}</h1>
        <ClientFormSheet
          trigger={
            <button
              type="button"
              className="hidden items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 sm:inline-flex"
            >
              + {t("newClient")}
            </button>
          }
          asChild
          serviceOptions={serviceOptions}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="block rounded-xl border border-neutral-100 bg-[rgba(164,254,25,1)] p-4 text-left">
          <p className="mb-1 text-xs font-semibold text-black">{t("totalClients")}</p>
          <p className="text-2xl font-bold text-black">{totalCount}</p>
          <p className="mt-1 text-xs text-black">{t("statsTotalSubtitle")}</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">{t("activeClients")}</p>
          <p className="text-2xl font-bold text-black">{activeCount}</p>
          <p className="mt-1 text-xs text-neutral-400">{t("statsActiveSubtitle")}</p>
        </div>
        <div className="rounded-xl border border-black bg-black p-4 text-left text-[#0a0a0a]">
          <p className="mb-1 text-xs font-semibold text-white">{t("completedClients")}</p>
          <p className="text-2xl font-semibold text-white">{completedCount}</p>
          <p className="mt-1 text-xs text-white">{t("statsCompletedSubtitle")}</p>
        </div>
        <div className="rounded-xl border border-[#bababa] bg-[#fafafa] p-4 text-left">
          <p className="mb-1 text-xs text-neutral-400">{t("avgValue")}</p>
          <p className="text-2xl font-medium text-neutral-900">—</p>
          <p className="mt-1 text-xs text-neutral-400">{t("notEnoughData")}</p>
        </div>
      </div>

      <ClientsDataTable
        activeClients={activeClients}
        archivedClients={archivedClients}
        selectedTab={selectedTab}
        serviceOptions={serviceOptions}
        clientServiceMap={clientServiceMap}
      />
      <ClientsPageFAB serviceOptions={serviceOptions} />
    </div>
  );
}
