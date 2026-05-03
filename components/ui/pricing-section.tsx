"use client";

import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { CheckCheck } from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { contactWhatsAppHref } from "@/lib/contact-links";
import { PLAN_LIMITS, PLAN_SAR_YEARLY_PER_MONTH } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

/** Brand accent — matches login / signup glows and marketing CTAs (`#a4fe19`). */
const BRAND = "#a4fe19";

const PLAN_KEYS = ["starter", "pro", "enterprise"] as const;

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.15,
      duration: 0.5,
    },
  }),
  hidden: {
    filter: "blur(10px)",
    y: -20,
    opacity: 0,
  },
};

function PricingSwitch({
  monthlyLabel,
  yearlyLabel,
  saveBadge,
  onSwitch,
}: {
  monthlyLabel: string;
  yearlyLabel: string;
  saveBadge: string;
  onSwitch: (value: string) => void;
}) {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  const activePill =
    "absolute inset-0 rounded-full border-2 border-black/15 bg-gradient-to-t from-[#8fd814] to-[#a4fe19] shadow-lg shadow-[#a4fe19]/40";

  return (
    <div className="flex justify-center">
      <div className="relative z-50 mx-auto flex w-fit rounded-full border border-border bg-muted/80 p-1 backdrop-blur-sm dark:bg-muted/50">
        <button
          type="button"
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 h-10 w-fit rounded-full px-3 py-1 text-sm font-medium transition-colors sm:h-12 sm:px-6 sm:py-2 sm:text-base",
            selected === "0" ? "text-black" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {selected === "0" ? (
            <motion.span
              layoutId="pricing-period-switch"
              className={activePill}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          ) : null}
          <span className="relative">{monthlyLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 flex h-10 w-fit shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium transition-colors sm:h-12 sm:px-6 sm:py-2 sm:text-base",
            selected === "1" ? "text-black" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {selected === "1" ? (
            <motion.span
              layoutId="pricing-period-switch"
              className={activePill}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          ) : null}
          <span className="relative flex items-center gap-2">
            {yearlyLabel}
            <span className="rounded-full bg-[#a4fe19]/25 px-2 py-0.5 text-xs font-medium text-foreground dark:bg-[#a4fe19]/20">
              {saveBadge}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const t = useTranslations("marketing.pricing");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const togglePricingPeriod = (value: string) => setIsYearly(Number.parseInt(value, 10) === 1);

  const waEnterprise = contactWhatsAppHref(
    isAr ? "مرحباً، أود التحدث عن خطة Enterprise لـ AgencyOS" : "Hi, I’d like to talk about the AgencyOS Enterprise plan."
  );

  return (
    <div
      ref={pricingRef}
      id="pricing"
      className="relative mx-auto min-h-0 bg-muted/40 px-4 py-16 sm:px-6 sm:py-20 dark:bg-muted/20"
    >
      <div
        className="pointer-events-none absolute start-[10%] end-[10%] top-0 z-0 h-full w-[80%]"
        style={{
          backgroundImage: "radial-gradient(circle at center, hsl(var(--primary) / 0.35) 0%, transparent 70%)",
          opacity: 0.45,
          mixBlendMode: "multiply",
        }}
      />

      <div className="relative z-[1] mx-auto mb-6 max-w-3xl text-center">
        <TimelineContent
          as="h2"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="mb-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
        >
          {t("showcaseTitleBefore")}{" "}
          <TimelineContent
            as="span"
            animationNum={1}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="inline-block rounded-xl border border-dashed border-[#a4fe19] bg-[#a4fe19]/15 px-2 py-1 capitalize dark:bg-[#a4fe19]/10"
          >
            {t("showcaseTitleHighlight")}
          </TimelineContent>
        </TimelineContent>

        <TimelineContent
          as="p"
          animationNum={2}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="mx-auto w-[90%] text-sm text-muted-foreground sm:w-[70%] sm:text-base"
        >
          {t("sectionLead")}
        </TimelineContent>
      </div>

      <TimelineContent as="div" animationNum={3} timelineRef={pricingRef} customVariants={revealVariants}>
        <PricingSwitch
          monthlyLabel={t("switchMonthly")}
          yearlyLabel={t("switchYearly")}
          saveBadge={t("switchSaveBadge")}
          onSwitch={togglePricingPeriod}
        />
      </TimelineContent>

      <div className="relative z-[1] mx-auto grid max-w-7xl gap-4 py-8 md:grid-cols-3">
        {PLAN_KEYS.map((planKey, index) => {
          const rawBullets = t.raw(`${planKey}.bullets`);
          const bullets = Array.isArray(rawBullets) ? (rawBullets as string[]) : [];
          const isEnterprise = planKey === "enterprise";
          const isPro = planKey === "pro";
          const ctaHref = isEnterprise ? waEnterprise : "/signup";
          const isExternal = isEnterprise;

          const limits = isEnterprise ? null : PLAN_LIMITS[planKey];
          const monthlySar = limits?.priceMonthly ?? 0;
          const yearlySar = limits?.priceYearly ?? 0;
          const yearlyPerMonth =
            planKey === "starter" || planKey === "pro" ? PLAN_SAR_YEARLY_PER_MONTH[planKey] : 0;

          const flowValue = isEnterprise ? 0 : isYearly ? yearlyPerMonth : monthlySar;

          const sarSuffix = isAr ? t("sarSuffixAr") : t("sarSuffixEn");

          return (
            <TimelineContent
              key={planKey}
              as="div"
              animationNum={4 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
            >
              <Card
                className={cn(
                  "relative gap-0 border-border py-0 shadow-sm",
                  isPro
                    ? "border-[#a4fe19]/45 bg-[#a4fe19]/[0.07] ring-2 ring-[#a4fe19]/35 dark:bg-[#a4fe19]/10"
                    : "bg-card"
                )}
              >
                <CardHeader className="text-start px-8 pb-4 pt-6 sm:px-10">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="mb-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {t(`${planKey}.name`)}
                    </h3>
                    {isPro ? (
                      <span className="shrink-0 rounded-full bg-[#a4fe19] px-3 py-1 text-xs font-semibold text-black">
                        {t("recommended")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">{t(`${planKey}.tagline`)}</p>

                  {!isEnterprise ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                        <span className="inline-flex items-baseline text-4xl font-semibold tabular-nums text-foreground">
                          <span dir="ltr" className="inline-flex items-baseline gap-1">
                            <NumberFlow value={flowValue} className="text-4xl font-semibold" />
                            <span className="text-2xl font-semibold">{sarSuffix}</span>
                          </span>
                        </span>
                        <span className="text-muted-foreground ms-1 text-sm">
                          {isYearly ? t("perMonthEquivalent") : t("perMonth")}
                        </span>
                      </div>
                      {isYearly ? (
                        <p className="text-sm text-muted-foreground">
                          {t("yearlyBilledTotal", {
                            amount: yearlySar.toLocaleString(isAr ? "ar-SA" : "en-US"),
                          })}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {isYearly ? t(`${planKey}.usdApproxYearly`) : t(`${planKey}.usdApproxMonthly`)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-3xl font-semibold text-foreground">{t(`${planKey}.price`)}</span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="px-8 pb-8 pt-0 sm:px-10">
                  <Button
                    asChild
                    size="lg"
                    variant={isPro ? "default" : "secondary"}
                    className={cn(
                      "mb-6 w-full rounded-xl px-4 text-base sm:text-lg",
                      isPro && "bg-[#a4fe19] font-semibold text-black hover:bg-[#a4fe19]/90"
                    )}
                  >
                    {isExternal ? (
                      <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                        {t(`${planKey}.cta`)}
                      </a>
                    ) : (
                      <Link href={ctaHref}>{t(`${planKey}.cta`)}</Link>
                    )}
                  </Button>

                  <div className="space-y-3 border-t border-border pt-4">
                    <h4 className="mb-2 text-base font-medium text-foreground">{t(`${planKey}.includesIntro`)}</h4>
                    <ul className="space-y-2 font-medium">
                      {bullets.map((line, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-6 shrink-0 place-content-center rounded-full border border-[#a4fe19]/50 bg-[#a4fe19]/12 dark:bg-[#a4fe19]/15">
                            <CheckCheck className="size-4 text-[#5a8f0f] dark:text-[#a4fe19]" aria-hidden />
                          </span>
                          <span className="text-sm leading-snug text-muted-foreground">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          );
        })}
      </div>
    </div>
  );
}
