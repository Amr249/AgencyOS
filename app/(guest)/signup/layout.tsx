import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupPageTitle") };
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
