import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UpgradePlansSection } from "@/components/dashboard/upgrade-plans-section";

export const metadata: Metadata = {
  title: "Upgrade",
  description: "Plans and billing",
};

export default async function UpgradePage() {
  const t = await getTranslations("upgradePage");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm md:text-base">{t("subtitle")}</p>
      </div>

      <UpgradePlansSection />
    </div>
  );
}
