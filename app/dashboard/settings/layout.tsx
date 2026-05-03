import { getLocale, getTranslations } from "next-intl/server";
import { SidebarNav } from "./sidebar-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("settings");
  const dir = locale === "ar" ? "rtl" : "ltr";
  const navItems = [
    { href: "/dashboard/settings", title: t("title"), exact: true as const },
    { href: "/dashboard/settings/users", title: t("navUsers") },
  ];

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:gap-10"
      dir={dir}
      lang={locale}
    >
      <aside className="shrink-0 lg:sticky lg:top-20 lg:w-52 lg:self-start">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          {t("sidebarNavHeading")}
        </p>
        <SidebarNav items={navItems} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
