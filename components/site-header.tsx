import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/global-search";
import { LanguageToggle } from "@/components/language-toggle";
import { MemberHubHeaderTitle } from "@/components/member-dashboard/member-hub-header-title";
import { NotificationBell } from "@/components/notifications/notification-bell";

type SiteHeaderProps = {
  hideGlobalSearch?: boolean;
  hideLanguageToggle?: boolean;
};

export async function SiteHeader({
  hideGlobalSearch = false,
  hideLanguageToggle = false,
}: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
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
  );
}
