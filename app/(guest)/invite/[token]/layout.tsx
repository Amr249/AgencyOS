import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invitations");
  return { title: t("metaDefaultTitle") };
}

export default function InviteTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
