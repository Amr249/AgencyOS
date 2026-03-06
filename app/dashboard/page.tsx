import type { Metadata } from "next";
import { getDashboardData } from "@/actions/dashboard";
import { DashboardHome } from "@/components/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "OnePixle Agency Operations Dashboard",
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Overview of revenue, projects, tasks, and invoices.
        </p>
      </div>
      <DashboardHome data={data} />
    </div>
  );
}
