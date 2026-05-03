"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type UiLocale = "en" | "ar";

function OnboardingShellFrame({
  children,
  lang,
  isRTL,
  isPending,
  onSwitch,
}: {
  children: ReactNode;
  lang: UiLocale;
  isRTL: boolean;
  isPending: boolean;
  onSwitch: (next: UiLocale) => void;
}) {
  const t = useTranslations("onboarding");

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      lang={lang}
      className="flex h-[100vh] min-h-[100vh] flex-col overflow-hidden bg-gradient-to-b from-muted/50 via-background to-muted/30"
    >
      <div className="flex shrink-0 justify-end px-3 pt-2">
        <div
          className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
          dir="ltr"
          role="group"
          aria-label={t("languageToggle")}
        >
          <button
            type="button"
            onClick={() => onSwitch("ar")}
            disabled={isPending}
            data-active={lang === "ar"}
            aria-label={t("languageArabic")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              lang === "ar"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            ع
          </button>
          <button
            type="button"
            onClick={() => onSwitch("en")}
            disabled={isPending}
            data-active={lang === "en"}
            aria-label={t("languageEnglish")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              lang === "en"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            EN
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-3 pb-3 pt-1 md:max-w-xl">
        {children}
      </div>
    </div>
  );
}

export function OnboardingShell({
  children,
  defaultLocale,
  messagesEn,
  messagesAr,
}: {
  children: ReactNode;
  defaultLocale: UiLocale;
  messagesEn: AbstractIntlMessages;
  messagesAr: AbstractIntlMessages;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lang, setLang] = useState<UiLocale>(defaultLocale);

  useEffect(() => {
    setLang(defaultLocale);
  }, [defaultLocale]);

  const messages = lang === "ar" ? messagesAr : messagesEn;
  const isRTL = lang === "ar";

  const switchLocale = useCallback(
    async (next: UiLocale) => {
      if (next === lang) return;
      await fetch("/api/set-locale", {
        method: "POST",
        body: JSON.stringify({ locale: next }),
        headers: { "Content-Type": "application/json" },
      });
      setLang(next);
      startTransition(() => router.refresh());
    },
    [lang, router]
  );

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <OnboardingShellFrame lang={lang} isRTL={isRTL} isPending={isPending} onSwitch={switchLocale}>
        {children}
      </OnboardingShellFrame>
    </NextIntlClientProvider>
  );
}
