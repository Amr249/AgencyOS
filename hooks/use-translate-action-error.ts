"use client";

import { useTranslations } from "next-intl";
import { isDbErrorKey } from "@/lib/i18n-errors";

/** Maps server-returned DB error keys to localized messages; passes through other strings. */
export function useTranslateActionError() {
  const t = useTranslations("errors");
  return (msg: string) => {
    if (isDbErrorKey(msg)) return t(msg);
    if (msg === "trial_expired") return t("trial_expired");
    if (msg === "Forbidden") return t("forbidden");
    return msg;
  };
}
