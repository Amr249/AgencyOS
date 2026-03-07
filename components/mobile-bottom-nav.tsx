"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconFileText,
  IconFolder,
  IconReceipt,
  IconListDetails,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم", icon: IconLayoutDashboard },
  { href: "/dashboard/clients", label: "العملاء", icon: IconUsers },
  { href: "/dashboard/proposals", label: "العروض", icon: IconFileText },
  { href: "/dashboard/projects", label: "المشاريع", icon: IconFolder },
  { href: "/dashboard/invoices", label: "الفواتير", icon: IconReceipt },
  { href: "/dashboard/tasks", label: "المهام", icon: IconListDetails },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      dir="rtl"
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
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-xs transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-6 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
