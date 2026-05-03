import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AgencyUsersManage } from "@/components/settings/agency-users-manage";
import { authOptions } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("settings.users");
  return { title: t("pageTitle") };
}

export default async function SettingsUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/settings/users");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard/me");
  }

  const t = await getTranslations("settings.users");
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="space-y-6" dir={dir} lang={locale}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("pageDescription")}</p>
      </div>
      <AgencyUsersManage currentUserId={session.user.id} showBackLink />
    </div>
  );
}
