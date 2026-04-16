import { SidebarNav } from "./sidebar-nav";

const SETTINGS_NAV_ITEMS = [
  { href: "/dashboard/settings", title: "Settings", exact: true as const },
  { href: "/dashboard/settings/users", title: "Users" },
  { href: "/dashboard/settings/templates", title: "Templates" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:gap-10"
      dir="ltr"
      lang="en"
    >
      <aside className="shrink-0 lg:sticky lg:top-20 lg:w-52 lg:self-start">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Settings
        </p>
        <SidebarNav items={SETTINGS_NAV_ITEMS} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
