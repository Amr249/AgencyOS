/**
 * Top bar: sidebar trigger, page title, language, global search, notifications.
 * Signed-in user identity (name, org, plan) lives in the sidebar {@link UserNav}.
 */
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/global-search";
import { LanguageToggle } from "@/components/language-toggle";
import { MemberHubHeaderTitle } from "@/components/member-dashboard/member-hub-header-title";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { TrialBanner } from "@/components/trial-banner";
import type { PlanTier } from "@/lib/plan-limits";

type SiteHeaderProps = {
  hideGlobalSearch?: boolean;
  hideLanguageToggle?: boolean;
  /** Shown above the main header row when set (non-internal orgs with trial metadata). */
  orgPlanBanner?: { plan: PlanTier; trialEndsAt: string | null } | null;
};

export function SiteHeader({
  hideGlobalSearch = false,
  hideLanguageToggle = false,
  orgPlanBanner = null,
}: SiteHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:border-b">
      {orgPlanBanner ? (
        <TrialBanner plan={orgPlanBanner.plan} trialEndsAt={orgPlanBanner.trialEndsAt} />
      ) : null}
      <header className="flex h-(--header-height) shrink-0 items-center gap-2">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="shrink-0 text-base font-medium">
            <MemberHubHeaderTitle />
          </h1>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {!hideLanguageToggle ? <LanguageToggle /> : null}
            {!hideGlobalSearch ? <GlobalSearch /> : null}
            <NotificationBell />
          </div>
        </div>
      </header>
    </div>
  );
}
