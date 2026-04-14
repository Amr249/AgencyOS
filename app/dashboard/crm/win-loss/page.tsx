import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getWinLossStats } from "@/actions/win-loss";
import { WinLossReport } from "@/components/modules/crm/win-loss-report";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return {
    title: t("winLossReportTitle"),
    description: t("winLossReportSubtitle"),
  };
}

export default async function WinLossReportPage() {
  const t = await getTranslations("clients");
  const stats = await getWinLossStats();

  return (
    <div className="space-y-6" dir="auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ms-2 w-fit gap-1" asChild>
            <Link href="/dashboard/crm/pipeline">
              <ChevronLeft className="size-4" />
              {t("pipelineTitle")}
            </Link>
          </Button>
          <h1 className="text-2xl font-medium text-neutral-900">{t("winLossReportTitle")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("winLossReportSubtitle")}</p>
        </div>
      </div>
      <WinLossReport stats={stats} />
    </div>
  );
}
