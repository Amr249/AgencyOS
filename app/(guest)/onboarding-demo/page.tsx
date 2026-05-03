import type { Metadata } from "next";
import { OnboardingFlowExample } from "@/components/onboarding/onboarding-flow-example";

export const metadata: Metadata = {
  title: "Onboarding UI demo",
  description: "Animated multi-step form showcase (not connected to agency onboarding).",
  robots: { index: false, follow: false },
};

export default function OnboardingDemoPage() {
  return <OnboardingFlowExample />;
}
