import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { getAppSiteUrl } from "@/lib/app-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("marketing.seo");
  const base = getAppSiteUrl().replace(/\/$/, "");
  const title = t("title");
  const description = t("description");
  const ogImageAlt = t("ogImageAlt");
  const ogImageUrl = `${base}/Logo1.png`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_SA" : "en_US",
      url: `${base}/`,
      siteName: "AgencyOS",
      title,
      description,
      images: [{ url: ogImageUrl, width: 512, height: 512, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: "/",
      languages: {
        ar: `${base}/`,
        en: `${base}/`,
      },
    },
  };
}

export default async function MarketingHomePage() {
  return (
    <main className="flex-1">
      <MarketingHero />
      <MarketingFeatures />
      <MarketingPricing />
    </main>
  );
}
