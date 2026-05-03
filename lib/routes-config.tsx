import { evaluateFeatureAccess, type FeatureName } from "@/lib/feature-registry";
import type { PlanTier } from "@/lib/plan-limits";

type PageRouteItem = {
  title: string;
  href: string;
  icon?: string;
  isComing?: boolean;
  /** When set, hide this route unless the org has the feature (plan + JSON overrides). */
  feature?: Extract<FeatureName, "proposals">;
  items?: PageRouteItem[];
};

type PageRoutesType = {
  title: string;
  items: PageRouteItem[];
};

type PageRoutesItemType = PageRouteItem[];

export const page_routes: PageRoutesType[] = [
  {
    title: "Menu",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "PieChart" },
      { title: "Clients", href: "/dashboard/clients", icon: "Building" },
      { title: "Projects", href: "/dashboard/projects", icon: "Folder" },
      { title: "Workspace", href: "/dashboard/workspace", icon: "List" },
      { title: "Proposals", href: "/dashboard/proposals", icon: "FileText", feature: "proposals" },
      { title: "Services", href: "/dashboard/services", icon: "List" },
      { title: "Invoices", href: "/dashboard/invoices", icon: "Receipt" },
      { title: "Reports", href: "/dashboard/reports", icon: "Report" },
      { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
      { title: "Login", href: "/login" },
    ],
  },
];

function filterRouteItem(
  item: PageRouteItem,
  plan: PlanTier,
  features: Record<string, unknown>
): PageRouteItem | null {
  if (item.items?.length) {
    const nested = filterRouteItems(item.items, plan, features);
    if (!nested.length) return null;
    return { ...item, items: nested };
  }
  if (item.feature && !evaluateFeatureAccess(plan, features, item.feature)) return null;
  return item;
}

/** Filter marketing / legacy nav routes by org plan (client: pass session user plan + optional features from OrgPlanProvider). */
export function filterRouteItems(
  items: PageRoutesItemType,
  plan: PlanTier,
  features: Record<string, unknown> = {}
): PageRoutesItemType {
  const out: PageRouteItem[] = [];
  for (const item of items) {
    const next = filterRouteItem(item, plan, features);
    if (next) out.push(next);
  }
  return out;
}

export type { PageRouteItem, PageRoutesType, PageRoutesItemType };
