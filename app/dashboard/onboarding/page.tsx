import type { Metadata } from "next";
import type { AbstractIntlMessages } from "next-intl";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getOnboardingState } from "@/actions/onboarding";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getRequiredSession } from "@/lib/session";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: "Setup",
  description: "Agency onboarding",
};

const messagesEn = { onboarding: en.onboarding } as AbstractIntlMessages;
const messagesAr = { onboarding: ar.onboarding } as AbstractIntlMessages;

export default async function OnboardingPage() {
  const session = await getRequiredSession();
  if (session.user.orgRole === "member") {
    redirect("/dashboard");
  }

  const state = await getOnboardingState();
  if (!state.ok) {
    redirect("/dashboard");
  }
  if (state.data.onboardingCompleted) {
    redirect("/dashboard");
  }

  const locale = await getLocale();
  const defaultLocale = locale === "ar" ? "ar" : "en";

  return (
    <OnboardingShell defaultLocale={defaultLocale} messagesEn={messagesEn} messagesAr={messagesAr}>
      <OnboardingWizard initial={state.data} organizationId={session.user.organizationId} />
    </OnboardingShell>
  );
}
