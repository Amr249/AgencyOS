"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type AiChatThinkingIndicatorProps = {
  className?: string;
};

const DOT_DELAYS_MS = [0, 150, 300] as const;

/** Inline typing state inside an assistant bubble (same chrome as real replies). */
export function AiChatThinkingIndicator({ className }: AiChatThinkingIndicatorProps) {
  const t = useTranslations("aiChat");

  return (
    <div
      className={cn("flex flex-col items-start gap-1.5 py-0.5", className)}
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="flex items-center gap-1 p-0.5" dir="ltr" aria-hidden>
        {DOT_DELAYS_MS.map((delayMs) => (
          <span
            key={delayMs}
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 animation-duration-[0.9s]"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs leading-none" dir="auto">
        {t("thinking")}
      </p>
    </div>
  );
}
