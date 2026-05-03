"use client";

import { IconDotsVertical, IconLogout } from "@tabler/icons-react";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";

import { SessionPlanBadge } from "@/components/session-plan-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { generateAvatarFallback } from "@/lib/utils";
import type { OrgPlan } from "@/types/next-auth";

function initialsFromName(name: string) {
  const s = generateAvatarFallback(name.trim() || "?").slice(0, 2);
  return s.length >= 1 ? s.toUpperCase() : "?";
}

/**
 * Sidebar user menu backed by NextAuth session (name, email, avatar, org, plan).
 * Prefer this or {@link UserNav} — do not pass hardcoded users.
 */
export function NavUser() {
  const { data: session, status } = useSession();
  const { isMobile } = useSidebar();
  const t = useTranslations("common.userNav");
  const tPlan = useTranslations("common.userNav.plan");
  const locale = useLocale();

  if (status === "loading") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="animate-pulse" disabled>
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="grid flex-1 gap-1">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-2 w-32 rounded bg-muted" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!session?.user) return null;

  const user = session.user;
  const name = user.name?.trim() || (locale === "ar" ? "مستخدم" : "User");
  const email = user.email ?? "";
  const orgName = user.orgName?.trim() || (locale === "ar" ? "المنظمة" : "Organization");
  const orgLogoUrl = user.orgLogoUrl?.trim() || undefined;
  const userAvatarUrl = user.avatarUrl?.trim() || undefined;
  const navAvatarSrc = orgLogoUrl ?? userAvatarUrl;
  const navAvatarAlt = orgLogoUrl ? orgName : name;
  const navFallbackInitials = orgLogoUrl ? initialsFromName(orgName) : initialsFromName(name);
  const plan = user.plan as OrgPlan;
  const planLabel = tPlan(plan);
  const isAr = locale === "ar";

  function NavLogoAvatar({ size }: { size: "sm" | "md" }) {
    const outer = size === "sm" ? "h-8 w-8" : "h-9 w-9";
    const inner = size === "sm" ? "h-[26px] w-[26px]" : "h-[30px] w-[30px]";
    return (
      <div
        className={`${outer} box-border flex shrink-0 items-center justify-center rounded-full bg-white p-[3px] shadow-sm ring-1 ring-black/10 dark:bg-white dark:ring-white/25`}
      >
        <div className={`relative ${inner} shrink-0 overflow-hidden rounded-full bg-muted/25`}>
          {navAvatarSrc ? (
            <img
              src={navAvatarSrc}
              alt={navAvatarAlt}
              className="block h-full w-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/15 text-[10px] font-semibold leading-none text-primary">
              {navFallbackInitials}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              dir={isAr ? "rtl" : "ltr"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <NavLogoAvatar size="sm" />
              <div className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <SessionPlanBadge plan={plan} label={planLabel} />
                  <span className="truncate">{orgName}</span>
                </span>
              </div>
              <IconDotsVertical className="ms-auto size-4 shrink-0 rtl:ms-0 rtl:me-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div
                className="flex flex-col gap-2 px-2 py-2 text-start text-sm"
                dir={isAr ? "rtl" : "ltr"}
              >
                <div className="flex items-center gap-2">
                  <NavLogoAvatar size="md" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-medium leading-none">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{email}</p>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                  <p className="text-muted-foreground">{t("organization")}</p>
                  <p className="mt-1 min-w-0 truncate font-medium text-foreground">{orgName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SessionPlanBadge plan={plan} label={planLabel} className="text-[10px]" />
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <IconLogout />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
