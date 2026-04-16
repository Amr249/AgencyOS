"use client";

import { useTranslations } from "next-intl";

export function MemberHubHeaderTitle() {
  const t = useTranslations("common");

  return <span className="shrink-0 text-base font-medium">{t("dashboard")}</span>;
}
