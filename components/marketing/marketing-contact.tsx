import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function MarketingContact() {
  const t = await getTranslations("marketing.contact");

  return (
    <section id="contact" className="scroll-mt-24 border-t border-border/60 bg-muted/15 px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-2 text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h2>
        <p className="mb-6 text-muted-foreground">{t("lead")}</p>
        <Button variant="outline" size="lg" asChild>
          <a href="mailto:sales@onepixle.com?subject=AgencyOS">{t("emailCta")}</a>
        </Button>
      </div>
    </section>
  );
}
