"use client";

import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { IconChevronUp, IconLogout } from "@tabler/icons-react";
import { SessionPlanBadge } from "@/components/session-plan-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatarFallback } from "@/lib/utils";
import type { OrgMemberRole, OrgPlan } from "@/types/next-auth";

function initials(name: string) {
  return generateAvatarFallback(name.trim() || "?")
    .slice(0, 2)
    .toUpperCase();
}

export function UserNav() {
  const { data: session, status } = useSession();
  const t = useTranslations("common.userNav");
  const tPlan = useTranslations("common.userNav.plan");
  const tRole = useTranslations("common.userNav.orgRole");
  const tAuth = useTranslations("auth");
  const locale = useLocale();

  if (status === "loading" || !session?.user) return null;

  const user = session.user;
  const name = user.name?.trim() || (locale === "ar" ? "مستخدم" : "User");
  const email = user.email ?? "";
  const orgName = user.orgName?.trim() || (locale === "ar" ? "المنظمة" : "Organization");
  const orgLogoUrl = user.orgLogoUrl?.trim() || undefined;
  const userAvatarUrl = user.avatarUrl?.trim() || undefined;
  /** Account menu avatar: tenant logo first, then user photo. */
  const navAvatarSrc = orgLogoUrl ?? userAvatarUrl;
  const navAvatarAlt = orgLogoUrl ? orgName : name;
  const navFallbackInitials = orgLogoUrl ? initials(orgName) : initials(name);
  const plan = user.plan as OrgPlan;
  const planLabel = tPlan(plan);
  const orgRole = user.orgRole as OrgMemberRole;
  const roleLabel = tRole(orgRole);
  const isAr = locale === "ar";

  /** White ring + fixed inner diameter so `object-fit: cover` always has a real box to fill. */
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
    <DropdownMenu>
      <div className="flex items-center gap-2 border-t border-border px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            dir={isAr ? "rtl" : "ltr"}
            className="h-auto min-h-11 flex-1 justify-start gap-2 px-2 py-1.5 text-start font-normal hover:bg-muted/80 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
            aria-label={tAuth("accountMenu")}
          >
            <NavLogoAvatar size="sm" />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-tight">{name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <SessionPlanBadge plan={plan} label={planLabel} className="text-[9px]" />
                <span className="truncate">{orgName}</span>
              </p>
            </div>
            <IconChevronUp className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden rtl:rotate-180" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="w-64" side="top" align="start" sideOffset={6}>
        <DropdownMenuLabel className="space-y-2 font-normal">
          <div
            className="flex items-center gap-2"
            dir={isAr ? "rtl" : "ltr"}
          >
            <NavLogoAvatar size="md" />
            <div className="min-w-0 flex-1 space-y-0.5 text-start">
              <p className="truncate text-sm font-medium leading-none">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="rounded-md border bg-muted/50 px-2 py-2 text-xs" dir={isAr ? "rtl" : "ltr"}>
            <p className="text-muted-foreground">{t("organization")}</p>
            <p className="mt-1 min-w-0 truncate font-medium text-foreground">{orgName}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <SessionPlanBadge plan={plan} label={planLabel} className="text-[10px]" />
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground">{roleLabel}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <IconLogout className="size-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
