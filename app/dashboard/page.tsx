import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/actions/dashboard";
import { DashboardHome } from "@/components/dashboard-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardHome");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role === "member") redirect("/dashboard/me");

  const data = await getDashboardData();
  const t = await getTranslations("dashboardHome");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <DashboardHome data={data} />
    </div>
  );
}
