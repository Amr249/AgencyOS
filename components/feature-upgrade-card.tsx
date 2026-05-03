import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type FeatureUpgradeVariant = "proposals" | "services_module";

type FeatureUpgradeCardProps = {
  variant: FeatureUpgradeVariant;
};

export async function FeatureUpgradeCard({ variant }: FeatureUpgradeCardProps) {
  const t = await getTranslations("billing.upgrade");

  const isProposals = variant === "proposals";
  const title = isProposals ? t("titleProposals") : t("titleServices");
  const description = isProposals ? t("bodyProposals") : t("bodyServices");
  const ctaLabel = isProposals ? t("contactUs") : t("upgrade");
  const ctaHref = "/dashboard/settings";

  return (
    <Card className="mx-auto max-w-lg border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{t("hint")}</p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
