import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { GlowyWavesHero } from "@/components/ui/glowy-waves-hero-shadcnui";

export async function MarketingHero() {
  const t = await getTranslations("marketing.hero");
  const tn = await getTranslations("marketing.nav");
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const showDashboard = !!session?.user?.id && (role === "admin" || role === "member");
  const showPortal = !!session?.user?.id && role === "client_portal";

  const rawPills = t.raw("glowyPills");
  const pills = Array.isArray(rawPills) ? (rawPills as string[]) : [];

  const stats = [
    { label: t("glowyStat0Label"), value: t("glowyStat0Value") },
    { label: t("glowyStat1Label"), value: t("glowyStat1Value") },
    { label: t("glowyStat2Label"), value: t("glowyStat2Value") },
  ];

  return (
    <GlowyWavesHero
      pill={t("pill")}
      titleLine1={t("glowyTitleLine1")}
      titleLine2={t("glowyTitleLine2")}
      subtitle={t("subtitle")}
      ctaPrimary={t("ctaPrimary")}
      ctaPrimaryHref="/signup"
      ctaSecondary={t("ctaSecondary")}
      ctaSecondaryHref="#features"
      pills={pills}
      stats={stats}
      showDashboard={showDashboard}
      dashboardLabel={tn("dashboard")}
      dashboardHref="/dashboard"
      showPortal={showPortal}
      portalLabel={tn("portal")}
      portalHref="/portal"
    />
  );
}
