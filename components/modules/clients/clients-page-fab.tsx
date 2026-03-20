"use client";

import { useTranslations } from "next-intl";
import { ClientFormSheet } from "./client-form-sheet";

export function ClientsPageFAB({
  serviceOptions,
}: {
  serviceOptions: { id: string; name: string; status: string }[];
}) {
  const t = useTranslations("clients");
  return (
    <ClientFormSheet
      asChild
      serviceOptions={serviceOptions}
      trigger={
        <button
          type="button"
          className="fixed bottom-24 start-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg md:hidden"
          aria-label={t("newClient")}
        >
          +
        </button>
      }
    />
  );
}
