import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Upgrade",
  description: "Plans and billing",
};

export default async function UpgradePage() {
  const t = await getTranslations("upgradePage");
  const mailSubject = encodeURIComponent("Enterprise plan — AgencyOS");
  const mailto = `mailto:support@onepixle.com?subject=${mailSubject}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm md:text-base">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["starter", "pro"] as const).map((key) => (
          <Card key={key} className="flex flex-col">
            <CardHeader>
              <CardTitle>{t(`plans.${key}.name`)}</CardTitle>
              <CardDescription>{t(`plans.${key}.tagline`)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
              <p>{t(`plans.${key}.comingSoon`)}</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="secondary" disabled>
                {t("comingSoonCta")}
              </Button>
            </CardFooter>
          </Card>
        ))}

        <Card className="flex flex-col border-primary/20 md:border-primary/30">
          <CardHeader>
            <CardTitle>{t("plans.enterprise.name")}</CardTitle>
            <CardDescription>{t("plans.enterprise.tagline")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("enterprise.title")}</p>
            <p>{t("enterprise.lead")}</p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:flex-1" variant="default">
              <a href={mailto}>{t("enterprise.contact")}</a>
            </Button>
            <Button asChild className="w-full sm:flex-1" variant="outline">
              <Link href="/dashboard/settings">{t("backToSettings")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
