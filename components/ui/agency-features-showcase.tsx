"use client";

import { useTranslations } from "next-intl";
import {
  ArrowUp,
  CalendarCheck,
  Globe,
  Play,
  PenLine,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import CustomersTableCard from "@/components/ui/customers-table-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MESCHAC_AVATAR = "https://avatars.githubusercontent.com/u/47919550?v=4";

const softCard =
  "gap-0 border-border/60 bg-muted/30 py-0 shadow-none dark:bg-muted/15";

function CodeReviewIllustration({ reviewerLabel }: { reviewerLabel: string }) {
  return (
    <div aria-hidden className="relative mt-6">
      <Card
        className={cn(
          softCard,
          "aspect-video w-4/5 translate-y-4 p-3 transition-transform duration-200 ease-in-out group-hover:-rotate-3"
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-background size-6 rounded-full border p-0.5 shadow shadow-zinc-950/5">
            <img
              className="aspect-square rounded-full object-cover"
              src={MESCHAC_AVATAR}
              alt=""
              height={24}
              width={24}
            />
          </div>
          <span className="text-muted-foreground text-sm font-medium">{reviewerLabel}</span>
          <span className="text-muted-foreground/75 text-xs">2m</span>
        </div>
        <div className="ms-8 space-y-2">
          <div className="bg-foreground/10 h-2 rounded-full" />
          <div className="bg-foreground/10 h-2 w-3/5 rounded-full" />
          <div className="bg-foreground/10 h-2 w-1/2 rounded-full" />
        </div>
        <PenLine className="text-muted-foreground ms-8 mt-3 size-5" />
      </Card>
      <Card
        className={cn(
          softCard,
          "absolute -top-4 end-0 flex aspect-[3/5] w-2/5 translate-y-4 p-2 transition-transform duration-200 ease-in-out group-hover:rotate-3"
        )}
      >
        <div className="bg-foreground/5 m-auto flex size-10 rounded-full">
          <Play className="fill-foreground/50 stroke-foreground/50 m-auto size-4" />
        </div>
      </Card>
    </div>
  );
}

function AIAssistantIllustration({
  mockPrompt,
  mockCta,
}: {
  mockPrompt: string;
  mockCta: string;
}) {
  return (
    <Card
      aria-hidden
      className={cn(
        softCard,
        "mt-6 aspect-video translate-y-4 p-4 pb-6 transition-transform duration-200 group-hover:translate-y-0"
      )}
    >
      <div className="w-fit">
        <Sparkles className="size-3.5 fill-purple-300 stroke-purple-300" />
        <p className="mt-2 line-clamp-2 text-sm">{mockPrompt}</p>
      </div>
      <div className="bg-foreground/5 -mx-3 -mb-3 mt-3 space-y-3 rounded-lg p-3">
        <div className="text-muted-foreground text-sm">{mockCta}</div>
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="size-7 min-h-7 min-w-7 rounded-2xl bg-transparent shadow-none md:min-h-7 md:min-w-7"
            >
              <Plus />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="size-7 min-h-7 min-w-7 rounded-2xl bg-transparent shadow-none md:min-h-7 md:min-w-7"
            >
              <Globe />
            </Button>
          </div>
          <Button
            size="icon"
            type="button"
            className="size-7 min-h-7 min-w-7 rounded-2xl bg-black text-white hover:bg-black/90 md:min-h-7 md:min-w-7"
          >
            <ArrowUp strokeWidth={3} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AgencyFeaturesShowcase() {
  const t = useTranslations("marketing.features");

  return (
    <div className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <h2 className="text-foreground max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("sectionTitle")}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl text-pretty text-base sm:text-lg">
          {t("sectionLead")}
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:mt-16">
          <Card className={cn(softCard, "overflow-hidden p-6")}>
            <Users className="text-primary size-5" />
            <h3 className="text-foreground mt-5 text-lg font-semibold">{t("showcaseCard0Title")}</h3>
            <p className="text-muted-foreground mt-3 text-balance">{t("showcaseCard0Desc")}</p>
            <div className="mt-6 min-w-0 scale-[0.92] origin-top sm:scale-95">
              <CustomersTableCard
                title={t("showcaseTableTitle")}
                subtitle={t("showcaseTableSubtitle")}
                className="rounded-xl text-[11px] sm:text-sm"
              />
            </div>
          </Card>

          <Card className={cn(softCard, "group overflow-hidden px-6 pt-6")}>
            <CalendarCheck className="text-primary size-5" />
            <h3 className="text-foreground mt-5 text-lg font-semibold">{t("showcaseCard1Title")}</h3>
            <p className="text-muted-foreground mt-3 text-balance">{t("showcaseCard1Desc")}</p>
            <CodeReviewIllustration reviewerLabel={t("showcaseReviewerLabel")} />
          </Card>

          <Card className={cn(softCard, "group overflow-hidden px-6 pt-6 md:col-span-2 lg:col-span-1")}>
            <Sparkles className="text-primary size-5" />
            <h3 className="text-foreground mt-5 text-lg font-semibold">{t("showcaseCard2Title")}</h3>
            <p className="text-muted-foreground mt-3 text-balance">{t("showcaseCard2Desc")}</p>
            <div className="-mx-2 -mt-2 overflow-hidden rounded-b-xl px-2 pt-2">
              <AIAssistantIllustration
                mockPrompt={t("showcaseMockAiPrompt")}
                mockCta={t("showcaseMockAiCta")}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
