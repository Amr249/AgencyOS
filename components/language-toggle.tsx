"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function switchLocale(next: "ar" | "en") {
    if (next === locale) return;
    await fetch("/api/set-locale", {
      method: "POST",
      body: JSON.stringify({ locale: next }),
      headers: { "Content-Type": "application/json" },
    });
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
      dir="ltr"
    >
      <button
        type="button"
        onClick={() => switchLocale("ar")}
        disabled={isPending}
        data-active={locale === "ar"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          locale === "ar"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100"
            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        )}
      >
        ع
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        disabled={isPending}
        data-active={locale === "en"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          locale === "en"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100"
            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        )}
      >
        EN
      </button>
    </div>
  );
}
