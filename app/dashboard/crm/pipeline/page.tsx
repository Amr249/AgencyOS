import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getClientsForPipeline } from "@/actions/clients";
import { getWinLossReasons } from "@/actions/win-loss";
import { LeadPipeline } from "@/components/modules/crm/lead-pipeline";
import { isDbErrorKey } from "@/lib/i18n-errors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return {
    title: t("pipelineTitle"),
    description: t("pipelineSubtitle"),
  };
}

export default async function CrmPipelinePage() {
  const t = await getTranslations("clients");
  const tErr = await getTranslations("errors");

  const [result, wonReasonsResult] = await Promise.all([
    getClientsForPipeline(),
    getWinLossReasons("won"),
  ]);
  if (!result.ok || !wonReasonsResult.ok) {
    const errStr = !result.ok
      ? typeof result.error === "string"
        ? result.error
        : ""
      : typeof wonReasonsResult.error === "string"
        ? wonReasonsResult.error
        : "";
    const displayError = isDbErrorKey(errStr) ? tErr(errStr) : errStr;
    return (
      <div className="flex flex-col gap-4" dir="auto">
        <h1 className="text-2xl font-bold tracking-tight">{t("pipelineTitle")}</h1>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-700">{displayError}</p>
        </div>
      </div>
    );
  }

  const wonReasons = wonReasonsResult.data.map((r) => ({ id: r.id, reason: r.reason }));

  return (
    <div className="space-y-5" dir="auto">
      <div className="mb-2">
        <h1 className="text-2xl font-medium text-neutral-900">{t("pipelineTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pipelineSubtitle")}</p>
      </div>
      <LeadPipeline initialClients={result.data} wonReasons={wonReasons} />
    </div>
  );
}
