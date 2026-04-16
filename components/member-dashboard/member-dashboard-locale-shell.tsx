"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import arMessages from "@/messages/ar.json";

/** Forces Arabic messages for all client hooks in the member dashboard. */
export function MemberDashboardLocaleShell({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="ar" messages={arMessages as AbstractIntlMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
