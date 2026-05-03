import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.legalPage");
  return {
    title: t("termsTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function TermsPlaceholderPage() {
  const t = await getTranslations("marketing.legalPage");

  return (
    <main className="mx-auto max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t("termsTitle")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("termsBody")}</p>
    </main>
  );
}
