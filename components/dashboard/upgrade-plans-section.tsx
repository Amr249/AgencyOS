"use client";

import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { contactWhatsAppHref } from "@/lib/contact-links";
import { PLAN_LIMITS, PLAN_SAR_YEARLY_PER_MONTH } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

const PAID_KEYS = ["starter", "pro"] as const;

export function UpgradePlansSection() {
  const t = useTranslations("upgradePage");
  const tp = useTranslations("marketing.pricing");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [isYearly, setIsYearly] = useState(false);

  const wa = contactWhatsAppHref(
    isAr ? "مرحباً، أود التحدث عن خطة Enterprise لـ AgencyOS" : "Hi, I’d like to talk about the AgencyOS Enterprise plan."
  );

  const sarSuffix = isAr ? tp("sarSuffixAr") : tp("sarSuffixEn");

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex rounded-full border border-border bg-muted/60 p-1 dark:bg-muted/40">
          <button
            type="button"
            onClick={() => setIsYearly(false)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !isYearly ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tp("switchMonthly")}
          </button>
          <button
            type="button"
            onClick={() => setIsYearly(true)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isYearly ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tp("switchYearly")}
            <span className="ms-2 rounded-full bg-[#a4fe19]/25 px-2 py-0.5 text-xs font-medium text-foreground dark:bg-[#a4fe19]/20">
              {tp("switchSaveBadge")}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PAID_KEYS.map((key) => {
          const limits = PLAN_LIMITS[key];
          const yearlyPer = PLAN_SAR_YEARLY_PER_MONTH[key];
          const flowVal = isYearly ? yearlyPer : limits.priceMonthly;
          const raw = tp.raw(`${key}.bullets`);
          const bullets = Array.isArray(raw) ? (raw as string[]) : [];
          const isPro = key === "pro";

          return (
            <Card
              key={key}
              className={cn(
                "flex flex-col",
                isPro && "border-[#a4fe19]/45 ring-2 ring-[#a4fe19]/30 dark:bg-[#a4fe19]/5"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{t(`plans.${key}.name`)}</CardTitle>
                  {isPro ? (
                    <span className="shrink-0 rounded-full bg-[#a4fe19] px-2 py-0.5 text-xs font-semibold text-black">
                      {tp("recommended")}
                    </span>
                  ) : null}
                </div>
                <CardDescription>{t(`plans.${key}.tagline`)}</CardDescription>
                <div className="pt-2 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-1 text-3xl font-semibold tabular-nums">
                    <span dir="ltr" className="inline-flex items-baseline gap-1">
                      <NumberFlow value={flowVal} />
                      <span className="text-xl">{sarSuffix}</span>
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {isYearly ? tp("perMonthEquivalent") : tp("perMonth")}
                    </span>
                  </div>
                  {isYearly ? (
                    <p className="text-sm text-muted-foreground">
                      {tp("yearlyBilledTotal", {
                        amount: limits.priceYearly.toLocaleString(isAr ? "ar-SA" : "en-US"),
                      })}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {isYearly ? tp(`${key}.usdApproxYearly`) : tp(`${key}.usdApproxMonthly`)}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                <p className="text-muted-foreground">{t(`plans.${key}.lead`)}</p>
                <ul className="space-y-2">
                  {bullets.map((line, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <CheckCheck className="mt-0.5 size-4 shrink-0 text-[#5a8f0f] dark:text-[#a4fe19]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant={isPro ? "default" : "secondary"}>
                  <Link href="/signup">{t("signupCta")}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        <Card className="flex flex-col border-primary/20 md:border-primary/30">
          <CardHeader>
            <CardTitle>{t("plans.enterprise.name")}</CardTitle>
            <CardDescription>{t("plans.enterprise.tagline")}</CardDescription>
            <p className="pt-2 text-2xl font-semibold">{t("plans.enterprise.priceLabel")}</p>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("enterprise.title")}</p>
            <p>{t("enterprise.lead")}</p>
            <ul className="space-y-2">
              {(Array.isArray(tp.raw("enterprise.bullets"))
                ? (tp.raw("enterprise.bullets") as string[])
                : []
              ).map((line, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:flex-1" variant="default">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                {t("enterprise.contact")}
              </a>
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
