import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.legalPage");
  return {
    title: t("privacyTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function PrivacyPlaceholderPage() {
  const t = await getTranslations("marketing.legalPage");

  return (
    <main className="mx-auto max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t("privacyTitle")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("privacyBody")}</p>
    </main>
  );
}
