type PageRoutesType = {
  title: string;
  items: PageRoutesItemType;
};

type PageRoutesItemType = {
  title: string;
  href: string;
  icon?: string;
  isComing?: boolean;
  items?: PageRoutesItemType;
}[];

export const page_routes: PageRoutesType[] = [
  {
    title: "Menu",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "PieChart" },
      { title: "Clients", href: "/dashboard/clients", icon: "Building" },
      { title: "Projects", href: "/dashboard/projects", icon: "Folder" },
      { title: "Tasks", href: "/dashboard/tasks", icon: "List" },
      { title: "Invoices", href: "/dashboard/invoices", icon: "Receipt" },
      { title: "Reports", href: "/dashboard/reports", icon: "Report" },
      { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
      { title: "Login", href: "/login" },
    ],
  },
];
