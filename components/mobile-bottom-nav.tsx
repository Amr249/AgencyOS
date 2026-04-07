"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  IconLayoutDashboard,
  IconUsers,
  IconFileText,
  IconFolder,
  IconReceipt,
  IconListDetails,
  IconLayoutKanban,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const dir = locale === "ar" ? "rtl" : "ltr";

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: IconLayoutDashboard },
    { href: "/dashboard/clients", label: t("clients"), icon: IconUsers },
    { href: "/dashboard/workspace", label: t("workspace"), icon: IconLayoutKanban },
    { href: "/dashboard/projects", label: t("projects"), icon: IconFolder },
    { href: "/dashboard/invoices", label: t("invoices"), icon: IconReceipt },
    { href: "/dashboard/tasks", label: t("allTasks"), icon: IconListDetails },
  ];

  return (
    <nav
      className="fixed bottom-0 start-0 end-0 z-40 flex items-center justify-around border-t border-zinc-800 bg-black px-2 py-2 md:hidden"
      dir={dir}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-xs transition-colors text-[#a4fe19]",
              isActive
                ? "bg-white/10 font-semibold text-[#a4fe19]"
                : "opacity-70 hover:opacity-100"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-6 shrink-0" />
            <span className="text-[15px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
