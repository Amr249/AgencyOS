import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { LanguageToggle } from "@/components/language-toggle";
import { MarketingNavMobile } from "@/components/marketing/marketing-nav-mobile";
import { Button } from "@/components/ui/button";

export async function MarketingNav() {
  const t = await getTranslations("marketing.nav");
  const locale = await getLocale();
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const showDashboard =
    !!session?.user?.id && (role === "admin" || role === "member");
  const showPortal = !!session?.user?.id && role === "client_portal";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-md outline-none ring-offset-black focus-visible:ring-2 focus-visible:ring-[#a4fe19]"
        >
          <Image src="/Logo1.png" alt="AgencyOS" width={36} height={36} className="size-9 shrink-0 rounded-md" />
          <span className="truncate text-base font-semibold tracking-tight sm:text-lg">AgencyOS</span>
        </Link>

        <nav
          className="hidden flex-1 justify-center gap-x-8 text-sm font-medium text-zinc-400 md:flex"
          aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary"}
        >
          <a href="#features" className="transition-colors hover:text-white">
            {t("features")}
          </a>
          <a href="#pricing" className="transition-colors hover:text-white">
            {t("pricing")}
          </a>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex md:gap-3">
          <LanguageToggle />
          {showDashboard ? (
            <Button size="sm" className="bg-[#a4fe19] text-black hover:bg-[#a4fe19]/90" asChild>
              <Link href="/dashboard">{t("dashboard")}</Link>
            </Button>
          ) : showPortal ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/portal">{t("portal")}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button size="sm" className="bg-[#a4fe19] text-black hover:bg-[#a4fe19]/90" asChild>
                <Link href="/signup">{t("signup")}</Link>
              </Button>
            </>
          )}
        </div>

        <MarketingNavMobile
          locale={locale}
          features={t("features")}
          pricing={t("pricing")}
          login={t("login")}
          signup={t("signup")}
          dashboard={t("dashboard")}
          portal={t("portal")}
          openMenu={t("openMenu")}
          languageLabel={t("language")}
          showDashboard={showDashboard}
          showPortal={showPortal}
        />
      </div>
    </header>
  );
}
