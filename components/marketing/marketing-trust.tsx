import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function MarketingTrust() {
  const t = await getTranslations("marketing.trust");

  const points = ["rtl", "sar", "moyasar"] as const;

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          {t("sectionTitle")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">{t("sectionLead")}</p>
        <ul className="mb-12 grid gap-4 sm:grid-cols-3">
          {points.map((key) => (
            <li key={key}>
              <Card className="h-full border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">{t(`points.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`points.${key}.desc`)}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
        <Card className="border-dashed border-border bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">{t("testimonialsTitle")}</CardTitle>
            <CardDescription className="text-base">{t("testimonialsEmpty")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
